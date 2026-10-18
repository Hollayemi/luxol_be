

// ─── Catalogue ──────────────────────────────────────────────

import { Prisma } from "../generated/prisma/client.js";

type CategoryWithOptions = Prisma.MeatBoxCategoryGetPayload<{
  include: { options: true };
}>;

export function serializeCategory(cat: CategoryWithOptions) {
  return {
    id: cat.id,
    label: cat.label,
    image: cat.image,
    options: cat.options
      .filter((o) => o.status === "ACTIVE")
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(serializeOption),
  };
}

type OptionRow = Prisma.MeatBoxOptionGetPayload<{}>;

export function serializeOption(opt: OptionRow) {
  return {
    id: opt.id,
    label: opt.label,
    image: opt.image,
    unit: opt.unit.toLowerCase() as "animal" | "kg",
    pricePerKg: opt.pricePerKg != null ? Number(opt.pricePerKg) : null,
    estimatedWeightKg:
      opt.estimatedMinKg != null && opt.estimatedMaxKg != null
        ? {
            min: Number(opt.estimatedMinKg),
            max: Number(opt.estimatedMaxKg),
          }
        : null,
    estimatedPrice:
      opt.estimatedMinPrice != null && opt.estimatedMaxPrice != null
        ? {
            min: Number(opt.estimatedMinPrice),
            max: Number(opt.estimatedMaxPrice),
          }
        : null,
    maxQuantity: opt.maxQuantity,
  };
}

// ─── Order ──────────────────────────────────────────────────

type OrderWithItems = Prisma.MeatBoxOrderGetPayload<{
  include: { items: true };
}>;

export function serializeMeatBoxOrder(order: OrderWithItems) {
  return {
    id: order.id,
    code: `#${order.code}`,
    status: order.status.toLowerCase() as Lowercase<
      typeof order.status
    >,
    items: order.items.map((i) => ({
      optionId: i.optionId,
      label: i.label,
      unit: i.unit.toLowerCase() as "animal" | "kg",
      quantity: i.quantity,
      pricePerKg: i.pricePerKg != null ? Number(i.pricePerKg) : null,
      finalWeightKg: i.finalWeightKg != null ? Number(i.finalWeightKg) : null,
      lineTotal: i.lineTotal != null ? Number(i.lineTotal) : null,
    })),

    deliveryFrequency: {
      id: order.deliveryFrequency,
      label: labelForFrequency(order.deliveryFrequency),
      recurring: order.deliveryFrequency !== "ONE_TIME",
    },
    deliveryDay: order.deliveryDay,
    deliveryWindow: order.deliveryWindow,
    address: order.deliveryAddress ?? "",
    fullName: order.fullName,
    phone: order.phone,
    butcheryGuidelines: order.butcheryGuidelines,

    estimatedTotal:
      order.estimatedMinTotal != null && order.estimatedMaxTotal != null
        ? {
            min: Number(order.estimatedMinTotal),
            max: Number(order.estimatedMaxTotal),
          }
        : null,
    estimatedWeightKg:
      order.estimatedMinKg != null && order.estimatedMaxKg != null
        ? {
            min: Number(order.estimatedMinKg),
            max: Number(order.estimatedMaxKg),
          }
        : null,

    confirmedTotal:
      order.confirmedTotal != null ? Number(order.confirmedTotal) : null,
    finalWeightKg:
      order.finalWeightKg != null ? Number(order.finalWeightKg) : null,
    priceConfirmedAt: order.priceConfirmedAt?.toISOString() ?? null,
    paidAt: order.paidAt?.toISOString() ?? null,

    nextDeliveryAt: order.nextDeliveryAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
  };
}

function labelForFrequency(id: string): string {
  const map: Record<string, string> = {
    ONE_TIME: "One-Time",
    WEEKLY: "Weekly",
    EVERY_2_WEEKS: "Every 2 weeks",
    MONTHLY: "Monthly",
  };
  return map[id] ?? id;
}