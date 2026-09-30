import { Prisma } from "../generated/prisma/client.js";
import { serializeTimeline } from "./admin-orders.serializer.js";
import { OrderStep, sortTimeline, STEP_META } from "./order-timeline.js";


const STATUS_MAP: Record<string, string> = {
  IN_PROGRESS: "in-progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  RETURNED: "returned",
};

const TRACK_STEP_MAP: Record<string, string> = {
  PLACED: "placed",
  PAYMENT: "payment",
  PACKED: "packed",
  OUT_FOR_DELIVERY: "out-for-delivery",
  RECEIVED: "received",
  RATE: "rate",
};

const TRACK_STATE_MAP: Record<string, string> = {
  DONE: "done",
  ACTIVE: "active",
  PENDING: "pending",
};

export function toFrontendStatus(s: string): string {
  return STATUS_MAP[s] ?? "in-progress";
}

export function toFrontendTrackStepId(s: string): string {
  return TRACK_STEP_MAP[s] ?? s.toLowerCase();
}

export function toFrontendTrackState(s: string): string {
  return TRACK_STATE_MAP[s] ?? "pending";
}

// orders/order-timeline.ts
export function readTimeline(raw: unknown): OrderStep[] {
  if (!Array.isArray(raw)) return [];
  // Light validation — drop anything that isn't shaped right
  return raw.filter(
    (s): s is OrderStep =>
      s &&
      typeof s === "object" &&
      "stepId" in s &&
      "state" in s &&
      "at" in s &&
      "note" in s,
  );
}

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: true;
    rating: true;
    returnRequests: { orderBy: { requestedAt: "desc" }; take: 1 };
  };
}>;

export function serializeOrderSummary(o: {
  id: string;
  placedAt: Date;
  status: string;
  deliveryType: string;
  items: { quantity: number; lineTotal: Prisma.Decimal }[];
  subtotal: Prisma.Decimal;
}) {
  const itemsCount = o.items.reduce((sum, i) => sum + i.quantity, 0);
  return {
    id: o.id,
    placedAt: o.placedAt.toISOString(),
    status: toFrontendStatus(o.status),
    deliveryType: o.deliveryType,
    itemsCount,
    itemsTotal: Number(o.subtotal),
  };
}


export function serializeOrderDetail(o: OrderWithRelations) {
  return {
    id: o.id,
    placedAt: o.placedAt.toISOString(),
    status: toFrontendStatus(o.status),
    deliveryType: o.deliveryType,
    receiverPhone: o.receiverPhone,
    deliveryAddress: o.deliveryAddress ?? "",
    email: o.contactEmail ?? "",
    items: o.items.map((i) => ({
      id: i.id,
      name: i.productName,
      image: i.image ?? "",
      price: Number(i.unitPrice),
      quantity: i.quantity,
      unitLabel: i.unitLabel ?? undefined,
    })),
    itemsTotal: Number(o.subtotal),
    discount: Number(o.discount),
    deliveryFee: Number(o.deliveryFee),
    total: Number(o.total),
    timeline: serializeTimeline(readTimeline(o.timeline)),
    rating: o.rating
      ? {
          stars: o.rating.stars,
          comment: o.rating.comment ?? undefined,
          submittedAt: o.rating.submittedAt.toISOString(),
        }
      : null,
    return: computeReturnEligibility(o),
  };
}
type OrderForTracking = Prisma.OrderGetPayload<{
  include: {
    items: true;
    payments: true;
  };
}>;

export function serializeOrderTracking(order: OrderForTracking) {
  const timeline = sortTimeline(readTimeline(order.timeline));

  // Latest payment attempt — the customer sees its status
  const latestPayment = order.payments
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  // Current step = the ACTIVE one, or the last DONE one if the timeline is closed
  const activeStep =
    timeline.find((s) => s.state === "ACTIVE") ??
    [...timeline].reverse().find((s) => s.state === "DONE");

  return {
    id: order.id,
    orderNumber: `#${order.orderNumber}`,
    status: order.status.toLowerCase(),
    placedAt: order.placedAt.toISOString(),
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancelReason: order.cancelReason ?? null,

    deliveryType: order.deliveryType.toLowerCase(),
    deliveryAddress: order.deliveryAddress ?? null,
    deliveryWindow: order.deliveryWindow ?? null,
    deliveryNotes: order.deliveryNotes ?? null,
    receiverName: order.receiverName,
    receiverPhone: order.receiverPhone,

    // Money — customer sees the breakdown
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    deliveryFee: Number(order.deliveryFee),
    total: Number(order.total),
    currency: "NGN",

    paymentStatus: latestPayment
      ? latestPayment.status.toLowerCase()
      : "pending",

    itemsCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.variantLabel
        ? `${i.productName} — ${i.variantLabel}`
        : i.productName,
      image: i.image,
      unitLabel: i.unitLabel,
      unitPrice: Number(i.unitPrice),
      quantity: i.quantity,
      lineTotal: Number(i.lineTotal),
    })),

    // The tracker itself
    currentStep: activeStep
      ? {
          stepId: activeStep.stepId,
          title: STEP_META[activeStep.stepId].title,
          note: activeStep.note,
          state: activeStep.state.toLowerCase(),
          at: activeStep.at,
        }
      : null,

    timeline: timeline.map((s) => ({
      id: s.stepId,
      stepId: s.stepId,
      title: STEP_META[s.stepId].title,
      description: s.note || STEP_META[s.stepId].defaultNote,
      state: s.state.toLowerCase() as "done" | "active" | "pending",
      occurredAt: s.at,
    })),
  };
}

function computeReturnEligibility(o: OrderWithRelations) {
  const latest = o.returnRequests?.[0];
  if (latest) {
    return {
      eligible: false,
      reason: `Return already ${latest.status.toLowerCase().replace("_", " ")}`,
    };
  }

  if (o.status !== "DELIVERED" || !o.deliveredAt) {
    return {
      eligible: false,
      reason: "Return window opens once the order is delivered",
    };
  }

  const closes = new Date(o.deliveredAt);
  closes.setDate(closes.getDate() + o.returnWindowDays);

  if (new Date() > closes) {
    return {
      eligible: false,
      reason: "Return window has closed",
    };
  }

  return {
    eligible: true,
    windowClosesAt: closes.toISOString(),
  };
}