import { Prisma } from "../generated/prisma/client.js";


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

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: true;
    trackSteps: { orderBy: { sortOrder: "asc" } };
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
    track: o.trackSteps.map((t) => ({
      id: toFrontendTrackStepId(t.stepId),
      title: t.title,
      description: t.description,
      occurredAt: t.occurredAt?.toISOString() ?? null,
      state: toFrontendTrackState(t.state),
    })),
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

export function serializeOrderTracking(o: {
  id: string;
  status: string;
  trackSteps: { stepId: string; title: string; description: string; state: string; occurredAt: Date | null }[];
}) {
  return {
    id: o.id,
    status: toFrontendStatus(o.status),
    track: o.trackSteps.map((t) => ({
      id: toFrontendTrackStepId(t.stepId),
      title: t.title,
      description: t.description,
      occurredAt: t.occurredAt?.toISOString() ?? null,
      state: toFrontendTrackState(t.state),
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

  if (o.status !== "COMPLETED" || !o.deliveredAt) {
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