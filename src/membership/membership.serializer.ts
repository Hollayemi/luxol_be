

// ─── Public / customer-facing ───────────────────────────────

import { Prisma } from "../generated/prisma/client.js";

export function serializePublicPlan(plan: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: Prisma.Decimal;
  interval: string;
  deliveryFrequency: string;
  supply: string[];
}) {
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description ?? "",
    price: Number(plan.price),
    interval: plan.interval.toLowerCase(),
    deliveryFrequency: plan.deliveryFrequency.toLowerCase(),
    supply: plan.supply,
  };
}

export function serializePublicProtein(p: {
  id: string;
  label: string;
  description: string;
  image: string | null;
}) {
  return {
    id: p.id,
    label: p.label,
    description: p.description,
    image: p.image,
  };
}

export function serializeMySubscription(
  sub: Prisma.SubscriptionGetPayload<{
    include: {
      plan: true;
      mix: { include: { protein: true } };
    };
  }>,
) {
  return {
    id: sub.id,
    status: sub.status.toLowerCase(),
    plan: serializePublicPlan(sub.plan),
    mix: sub.mix.map((m) => ({
      protein: serializePublicProtein(m.protein),
      percentage: m.percentage,
    })),
    deliveryFrequency: sub.deliveryFrequency.toLowerCase(),
    deliveryDay: sub.deliveryDay,
    deliveryWindow: sub.deliveryWindow,
    address: sub.addressId,
    startedAt: sub.startedAt.toISOString(),
    nextDeliveryAt: sub.nextDeliveryAt?.toISOString() ?? null,
    nextBillingAt: sub.nextBillingAt?.toISOString() ?? null,
  };
}

// ─── Admin ──────────────────────────────────────────────────

export function serializeAdminPlan(
  plan: Prisma.MembershipPlanGetPayload<{
    include: { _count: { select: { subscriptions: true } } };
  }>,
) {
  const membersCount = plan._count.subscriptions;
  const price = Number(plan.price);
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price,
    interval: plan.interval.toLowerCase(),
    deliveryFrequency: plan.deliveryFrequency.toLowerCase(),
    membersCount,
    monthlyRevenue: membersCount * price,
    status: plan.status.toLowerCase(),
  };
}

export function serializeAdminSubscriber(
  sub: Prisma.SubscriptionGetPayload<{
    include: {
      plan: true;
      user: { select: { id: true; name: true; image: true } };
    };
  }>,
) {
  return {
    id: sub.id,
    customer: {
      id: sub.user.id,
      fullName: sub.user.name,
      avatar: sub.user.image ?? null,
    },
    planId: sub.planId,
    planName: sub.plan.name,
    price: Number(sub.plan.price),
    interval: sub.plan.interval.toLowerCase(),
    nextDeliveryAt: sub.nextDeliveryAt?.toISOString() ?? null,
    nextDeliverySlot: sub.deliveryWindow ?? null,
    renewalAt: sub.nextBillingAt?.toISOString() ?? null,
    status: sub.status.toLowerCase(),
  };
}

export function serializeAdminProtein(
  protein: { id: string; label: string; description: string; image: string | null; status: string },
  soldPercentage: number,
) {
  return {
    id: protein.id,
    label: protein.label,
    description: protein.description,
    image: protein.image,
    status: protein.status.toLowerCase(),
    soldPercentage: Math.round(soldPercentage * 100) / 100,
  };
}