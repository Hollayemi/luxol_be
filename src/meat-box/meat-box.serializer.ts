// src/meat-box/meat-box.serializer.ts

import { MeatBoxOrderStatus, PaymentStatus, Prisma } from "../generated/prisma/client.js";
import { readTimeline, sortTimeline } from "../orders/order-timeline.js";

const lc = (s: string) => s.toLowerCase();

// ─────────────────────────────────────────────────────────────
// CUSTOMER SERIALIZERS
// ─────────────────────────────────────────────────────────────

type CustomerOrder = Prisma.MeatBoxOrderGetPayload<{
  include: { items: true };
}>;

export function serializeMeatBoxOrder(order: CustomerOrder) {
  return {
    id: order.id,
    code: `#${order.code}`, // Customer UI expects the leading #
    status: order.status.toLowerCase() as Lowercase<MeatBoxOrderStatus>,
    items: order.items.map((i) => ({
      optionId: i.optionId,
      label: i.label,
      weightKg: Number(i.weightKg),
      pricePerKg: Number(i.pricePerKg),
      quantity: i.quantity,
      lineTotal: Number(i.lineTotal),
    })),

    deliveryFrequency: order.deliveryFrequency,
    deliveryDay: order.deliveryDay,
    deliveryWindow: order.deliveryWindow,
    address: order.deliveryAddress ?? "",
    fullName: order.fullName,
    phone: order.phone,
    butcheryGuidelines: order.butcheryGuidelines,

    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.deliveryFee),
    total: Number(order.total),

    paidAt: order.paidAt?.toISOString() ?? null,
    nextDeliveryAt: order.nextDeliveryAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// ADMIN CATALOGUE SERIALIZERS
// ─────────────────────────────────────────────────────────────

export function serializeCategory(cat: any) {
  return {
    id: cat.id,
    label: cat.label,
    slug: cat.slug,
    image: cat.image,
    pricePerKg: Number(cat.pricePerKg), // Required for the admin form
    status: cat.status,
    displayOrder: cat.displayOrder,
    createdAt: cat.createdAt.toISOString(),
    updatedAt: cat.updatedAt.toISOString(),
    options: cat.options.map((o: any) => serializeOption(o, cat.pricePerKg)),
  };
}

export function serializeOption(o: any, categoryPricePerKg: number) {
  const weight = Number(o.weightKg);
  const pricePerKg = Number(categoryPricePerKg);

  return {
    id: o.id,
    categoryId: o.categoryId,
    label: o.label,
    image: o.image,
    weightKg: weight,
    price: weight * pricePerKg, // Computed dynamically
    maxQuantity: o.maxQuantity,
    status: o.status,
    displayOrder: o.displayOrder,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// ADMIN ORDERS SERIALIZERS
// ─────────────────────────────────────────────────────────────

export function derivePaymentStatus(order: {
  paidAt: Date | null;
  payments?: Array<{ status: PaymentStatus }>;
}): "UNPAID" | "PAID" | "REFUNDED" {
  const refunded = order.payments?.some((p) => p.status === "REFUNDED");
  if (refunded) return "REFUNDED";
  if (order.paidAt) return "PAID";
  const paid = order.payments?.some((p) => p.status === "SUCCESS");
  return paid ? "PAID" : "UNPAID";
}

const ALLOWED_NEXT: Record<MeatBoxOrderStatus, MeatBoxOrderStatus[]> = {
  PENDING_PAYMENT: [],
  PROCESSING: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function allowedNextStatuses(
  status: MeatBoxOrderStatus,
): Array<"PROCESSING" | "OUT_FOR_DELIVERY" | "COMPLETED"> {
  return ALLOWED_NEXT[status].filter(
    (s): s is "PROCESSING" | "OUT_FOR_DELIVERY" | "COMPLETED" =>
      s === "PROCESSING" || s === "OUT_FOR_DELIVERY" || s === "COMPLETED",
  );
}

export function canCancel(status: MeatBoxOrderStatus): boolean {
  return status !== "COMPLETED" && status !== "CANCELLED";
}

type AdminOrderSummary = Prisma.MeatBoxOrderGetPayload<{
  include: {
    user: { select: { id: true; name: true; image: true } };
    items: true;
    payments: { select: { status: true } };
  };
}>;

export function serializeOrderSummary(order: AdminOrderSummary) {
  const totalWeightKg = order.items.reduce(
    (sum, i) => sum + Number(i.weightKg) * i.quantity,
    0
  );

  return {
    id: order.id,
    code: order.code,
    status: order.status,
    paymentStatus: derivePaymentStatus(order),
    customer: {
      id: order.user.id,
      fullName: order.user.name,
      avatar: order.user.image ?? null,
    },
    placedAt: order.createdAt.toISOString(),
    itemsCount: order.items.length,
    deliveryFrequency: order.deliveryFrequency,
    total: Number(order.total),
    totalWeightKg,
    nextDeliveryAt: order.nextDeliveryAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
  };
}

type AdminOrderDetail = Prisma.MeatBoxOrderGetPayload<{
  include: {
    user: true;
    items: { include: { option: { select: { image: true } } } };
    payments: true;
    timeline: true;
  };
}>;

export function serializeOrderDetail(order: AdminOrderDetail) {
  const jsonTimeline = sortTimeline(readTimeline(order.timeline));

  const timeline = [
    {
      id: "placed",
      title: "Order has been made",
      description: `Order ${order.code} placed.`,
      occurredAt: order.createdAt.toISOString(),
      state: "done" as const,
    },
    {
      id: "paid",
      title: "Payment confirmed",
      description: order.paidAt ? "Customer has paid for this order." : "Waiting for the customer to pay.",
      occurredAt: order.paidAt?.toISOString() ?? null,
      state: order.paidAt
        ? ("done" as const)
        : order.status === "PENDING_PAYMENT"
          ? ("active" as const)
          : ("pending" as const),
    },
    {
      id: "processing",
      title: "Meat box prepared",
      description: "Cut, weighed and packaged.",
      occurredAt: null,
      state:
        order.status === "PROCESSING"
          ? ("active" as const)
          : ["OUT_FOR_DELIVERY", "COMPLETED"].includes(order.status)
            ? ("done" as const)
            : ("pending" as const),
    },
    {
      id: "out_for_delivery",
      title: "Out for delivery",
      description: "The rider is on the way.",
      occurredAt: null,
      state:
        order.status === "OUT_FOR_DELIVERY"
          ? ("active" as const)
          : order.status === "COMPLETED"
            ? ("done" as const)
            : ("pending" as const),
    },
    {
      id: "delivered",
      title: "Delivered",
      description: "Order received by the customer.",
      occurredAt: order.deliveredAt?.toISOString() ?? null,
      state: order.status === "COMPLETED" ? ("done" as const) : ("pending" as const),
    },
  ];

  // Append any admin notes from the JSON timeline
  for (const step of jsonTimeline) {
    timeline.push({
      id: `note_${step.stepId}`,
      title: `Note · ${step.stepId}`,
      description: step.note,
      occurredAt: step.at,
      state: step.state.toLowerCase() as "done" | "active" | "pending",
    });
  }

  return {
    id: order.id,
    code: order.code,
    status: order.status,
    paymentStatus: derivePaymentStatus(order),
    customer: {
      id: order.user.id,
      fullName: order.user.name,
      avatar: order.user.image ?? null,
      email: order.user.email,
      phone: order.user.phone ?? "",
    },
    placedAt: order.createdAt.toISOString(),
    itemsCount: order.items.length,
    deliveryFrequency: order.deliveryFrequency,
    total: Number(order.total),
    nextDeliveryAt: order.nextDeliveryAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,

    deliveryAddress: order.deliveryAddress ?? "",
    deliveryDay: order.deliveryDay,
    deliveryWindow: order.deliveryWindow,
    butcheryGuidelines: order.butcheryGuidelines,

    items: order.items.map((i) => ({
      id: i.id,
      optionId: i.optionId,
      label: i.label,
      image: i.option?.image ?? null,
      weightKg: Number(i.weightKg),
      pricePerKg: Number(i.pricePerKg),
      quantity: i.quantity,
      lineTotal: Number(i.lineTotal),
    })),

    timeline,
    paidAt: order.paidAt?.toISOString() ?? null,

    itemsTotal: Number(order.subtotal),
    discount: 0, // update if you add discounts to meat boxes
    deliveryFee: Number(order.deliveryFee),

    allowedNextStatuses: allowedNextStatuses(order.status),
    canCancel: canCancel(order.status),
    cancellation:
      order.status === "CANCELLED" && order.cancelledAt
        ? {
          reason: order.cancelReason ?? "No reason provided",
          cancelledAt: order.cancelledAt.toISOString(),
        }
        : null,
  };
}