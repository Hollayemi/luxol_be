import {
  OrderStatus,
  OrderType,
  PaymentStatus,
  Prisma,
} from "../generated/prisma/client.js";
import { OrderStep, sortTimeline, STEP_META } from "./order-timeline.js";

const ALLOWED_NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PROCESSING"],
  PROCESSING: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
  REFUNDED: [],
};

const TERMINAL: OrderStatus[] = [
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "REFUNDED",
];

export function lowercaseStatus(s: OrderStatus): string {
  return s.toLowerCase();
}

export function lowercaseType(t: OrderType): string {
  return t.toLowerCase();
}

export function lowercasePaymentStatus(s: PaymentStatus): string {
  return s.toLowerCase();
}

export function allowedNextStatuses(current: OrderStatus): OrderStatus[] {
  return ALLOWED_NEXT[current] ?? [];
}

export function canCancel(current: OrderStatus): boolean {
  return !TERMINAL.includes(current);
}


export function serializeTimeline(timeline: unknown) {
  const steps = (Array.isArray(timeline) ? timeline : []) as OrderStep[];
  return sortTimeline(steps).map((s) => {
    const meta = STEP_META[s.stepId];
    return {
      id: s.stepId,
      title: meta.title,
      description: s.note || meta.defaultNote,
      occurredAt: s.at,
      state: s.state.toLowerCase() as "done" | "active" | "pending",
    };
  });
}
// ─── customer ──────────────────────────────────────────────────────

export function serializeCustomerBrief(user: {
  id: string;
  name: string;
  image: string | null;
}) {
  return {
    id: user.id,
    fullName: user.name,
    avatar: user.image ?? null,
  };
}

export function serializeCustomer(user: {
  id: string;
  name: string;
  image: string | null;
  email: string;
  phone: string | null;
}) {
  return {
    id: user.id,
    fullName: user.name,
    avatar: user.image ?? null,
    email: user.email,
    phone: user.phone ?? "",
  };
}

// ─── items ─────────────────────────────────────────────────────────

export function serializeItem(item: {
  id: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  image: string | null;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  product?: { sku: string | null } | null;
}) {
  return {
    id: item.id,
    productId: item.productId,
    name: item.variantLabel
      ? `${item.productName} — ${item.variantLabel}`
      : item.productName,
    sku: item.product?.sku ?? item.productId.slice(0, 8).toUpperCase(),
    image: item.image,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    lineTotal: Number(item.lineTotal),
  };
}

// ─── summary (table row) ───────────────────────────────────────────

type OrderForSummary = Prisma.OrderGetPayload<{
  include: {
    user: { select: { id: true; name: true; image: true } };
    items: true;
    payments: true;
  };
}>;

export function serializeOrderSummary(order: OrderForSummary) {
  const latestPayment = order.payments
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  const itemsCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    id: order.id,
    orderNumber: `#${order.orderNumber}`,
    type: lowercaseType(order.type),
    status: lowercaseStatus(order.status),
    paymentStatus: latestPayment
      ? lowercasePaymentStatus(latestPayment.status)
      : "pending",
    customer: serializeCustomerBrief(order.user),
    placedAt: order.placedAt.toISOString(),
    totalAmount: Number(order.total),
    itemsCount,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
  };
}

// ─── detail (drawer) ───────────────────────────────────────────────

type OrderForDetail = Prisma.OrderGetPayload<{
  include: {
    user: true;
    items: { include: { product: { select: { sku: true } } } };
    payments: true;
    address: true;
  };
}>;

export function serializeOrderDetail(order: OrderForDetail) {
  const latestPayment = order.payments
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  const itemsCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

  const next = allowedNextStatuses(order.status);

  return {
    id: order.id,
    orderNumber: `#${order.orderNumber}`,
    type: lowercaseType(order.type),
    status: lowercaseStatus(order.status),
    paymentStatus: latestPayment
      ? lowercasePaymentStatus(latestPayment.status)
      : "pending",
    customer: serializeCustomer(order.user),
    placedAt: order.placedAt.toISOString(),
    totalAmount: Number(order.total),
    itemsCount,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,

    shippingAddress:
      order.deliveryAddress ??
      (order.address
        ? `${order.address.fullName}, ${order.address.address}, ${order.address.region}`
        : ""),

    items: order.items.map(serializeItem),
    timeline: serializeTimeline(order.timeline),

    itemsTotal: Number(order.subtotal),
    discount: Number(order.discount),
    deliveryFee: Number(order.deliveryFee),
    total: Number(order.total),

    allowedNextStatuses: next,
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