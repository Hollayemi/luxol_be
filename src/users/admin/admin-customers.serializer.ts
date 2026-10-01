import { CustomerActivityType, Prisma } from "../../generated/prisma/client.js";


// Lowercase helper for the frontend's string unions
const lc = (s: string) => s.toLowerCase();

// ─── Derived status ──────────────────────────────────────────
/**
 * ACTIVE   → default
 * SUSPENDED → staff-set, persisted
 * INACTIVE → derived: no orders in 90 days
 */
export function deriveCustomerStatus(
  persisted: "ACTIVE" | "INACTIVE" | "SUSPENDED",
  lastOrderAt: Date | null,
): "active" | "inactive" | "suspended" {
  if (persisted === "SUSPENDED") return "suspended";
  if (!lastOrderAt) return "inactive";
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  return lastOrderAt >= cutoff ? "active" : "inactive";
}

// ─── Summary (table row) ────────────────────────────────────
type UserForSummary = Prisma.UserGetPayload<{
  include: {
    orders: { select: { id: true; total: true; placedAt: true } };
    subscription: { include: { plan: true } };
  };
}>;

export function serializeCustomerSummary(user: UserForSummary) {
  const ordersCount = user.orders.length;
  const totalSpent = user.orders.reduce((sum, o) => sum + Number(o.total), 0);
  const lastOrderAt =
    user.orders.length > 0
      ? user.orders
          .slice()
          .sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime())[0]
          .placedAt
      : null;

  const membershipName =
    user.subscription && user.subscription.status === "ACTIVE"
      ? user.subscription.plan.name
      : null;

  return {
    id: user.id,
    fullName: user.name,
    avatar: user.image ?? null,
    email: user.email,
    phone: user.phone ?? "",
    ordersCount,
    totalSpent: Math.round(totalSpent * 100) / 100,
    membership: membershipName,
    lastOrderAt: lastOrderAt?.toISOString() ?? null,
    status: deriveCustomerStatus(user.customerStatus, lastOrderAt),
  };
}

// ─── Membership block (detail page) ─────────────────────────
type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: { plan: true };
}>;

export function serializeCustomerMembership(sub: SubscriptionWithPlan | null) {
  if (!sub) return null;

  // Map PENDING_PAYMENT → "paused" for the UI? No — treat it as "active" is wrong.
  // Frontend's AdminMembershipStatus is "active"|"paused"|"cancelled"|"expired".
  // PENDING_PAYMENT is the odd one out. We collapse it to "paused" so the UI
  // has a defined state; keep an eye out if product wants a 5th state.
  const statusMap: Record<string, "active" | "paused" | "cancelled" | "expired"> = {
    ACTIVE: "active",
    PAUSED: "paused",
    CANCELLED: "cancelled",
    EXPIRED: "expired",
    PENDING_PAYMENT: "paused",
  };

  return {
    id: sub.id,
    planName: `${sub.plan.name} Membership`,
    amount: Number(sub.plan.price),
    interval: sub.plan.interval.toLowerCase() as "week" | "month" | "year",
    status: statusMap[sub.status],
    startedAt: sub.startedAt.toISOString(),
    nextBillingAt: sub.nextBillingAt?.toISOString() ?? null,
    nextDeliveryAt: sub.nextDeliveryAt?.toISOString() ?? null,
    deliveryFrequency: capitalize(sub.deliveryFrequency),
  };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ─── Activity feed ──────────────────────────────────────────
type ActivityRow = {
  id: string;
  type: CustomerActivityType;
  title: string;
  occurredAt: Date;
};

export function serializeActivity(rows: ActivityRow[]) {
  return rows.map((r) => ({
    id: r.id,
    type: lc(r.type) as string,
    title: r.title,
    occurredAt: r.occurredAt.toISOString(),
  }));
}

// ─── Detail ─────────────────────────────────────────────────
type UserForDetail = Prisma.UserGetPayload<{
  include: {
    orders: { select: { id: true; total: true; placedAt: true } };
    addresses: true;
    subscription: { include: { plan: true } };
    activities: { orderBy: { occurredAt: "desc" }; take: 30 };
  };
}>;

export function serializeCustomerDetail(user: UserForDetail) {
  const ordersCount = user.orders.length;
  const totalSpent = user.orders.reduce((sum, o) => sum + Number(o.total), 0);
  const lastOrderAt =
    user.orders.length > 0
      ? user.orders
          .slice()
          .sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime())[0]
          .placedAt
      : null;

  return {
    id: user.id,
    fullName: user.name,
    avatar: user.image ?? null,
    email: user.email,
    phone: user.phone ?? "",
    status: deriveCustomerStatus(user.customerStatus, lastOrderAt),

    totalSpent: Math.round(totalSpent * 100) / 100,
    totalOrders: ordersCount,
    loyaltyPoints: user.loyaltyPoints,
    customerSince: user.createdAt.toISOString(),

    addresses: user.addresses.map((a) => ({
      id: a.id,
      address: `${a.address}, ${a.region}`,
      isDefault: a.isDefault,
    })),

    membership: serializeCustomerMembership(user.subscription),

    activity: serializeActivity(user.activities),
  };
}