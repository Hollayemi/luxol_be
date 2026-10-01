
import { Prisma } from "../generated/prisma/client.js";
import { DeliveryStatus } from "../generated/prisma/enums.js";
import {
  parseDeliveryWindow,
  toDateKey,
  toTimeKey,
} from "./delivery-dates.util.js";

// ─── Status mapping ─────────────────────────────────────────

/**
 * Given a subscription's current delivery state + date, compute the
 * delivery status shown to the admin.
 */
export function deriveDeliveryStatus(
  sub: {
    currentDeliveryStatus: DeliveryStatus;
    currentDeliveryMarkedAt: Date | null;
    skipUntil: Date | null;
    nextDeliveryAt: Date | null;
  },
): DeliveryStatus {
  if (!sub.nextDeliveryAt) return "SCHEDULED";

  // Skip takes precedence
  if (
    sub.skipUntil &&
    toDateKey(sub.skipUntil) === toDateKey(sub.nextDeliveryAt)
  ) {
    return "SKIPPED";
  }

  // Staff override wins — but only if it was set for the current cycle
  if (sub.currentDeliveryMarkedAt) {
    return sub.currentDeliveryStatus;
  }

  // Otherwise derive from date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = new Date(sub.nextDeliveryAt);
  delivery.setHours(0, 0, 0, 0);

  if (delivery < today) return "MISSED";
  return "SCHEDULED";
}

// ─── Allowed next statuses ──────────────────────────────────

const ALLOWED_NEXT: Record<DeliveryStatus, DeliveryStatus[]> = {
  SCHEDULED: ["OUT_FOR_DELIVERY", "MISSED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "MISSED"],
  DELIVERED: [],
  MISSED: ["OUT_FOR_DELIVERY"], // allow re-attempt
  SKIPPED: [],
};

export function allowedNextStatuses(
  current: DeliveryStatus,
): Array<"out_for_delivery" | "delivered" | "missed"> {
  return (ALLOWED_NEXT[current] ?? [])
    .filter(
      (s): s is "OUT_FOR_DELIVERY" | "DELIVERED" | "MISSED" =>
        s !== "SCHEDULED" && s !== "SKIPPED",
    )
    .map((s) => s.toLowerCase() as "out_for_delivery" | "delivered" | "missed");
}

// ─── Delivery card ──────────────────────────────────────────

type SubscriptionForDelivery = Prisma.SubscriptionGetPayload<{
  include: {
    plan: true;
    user: { select: { id: true; name: true; image: true } };
  };
}>;

export function serializeDelivery(sub: SubscriptionForDelivery) {
  const status = deriveDeliveryStatus(sub);
  const at = sub.nextDeliveryAt!;
  const { startTime, endTime } = parseDeliveryWindow(sub.deliveryWindow);

  return {
    id: sub.id, // subscription id doubles as delivery id in v1
    type: "membership" as const,
    status: status.toLowerCase(),
    customer: {
      id: sub.user.id,
      fullName: sub.user.name,
      avatar: sub.user.image ?? null,
    },
    date: toDateKey(at),
    startTime,
    endTime,
    allowedNextStatuses: allowedNextStatuses(status),
  };
}

// ─── Calendar preview ───────────────────────────────────────

export function serializeDeliveryPreview(sub: SubscriptionForDelivery) {
  const status = deriveDeliveryStatus(sub);
  const { startTime } = parseDeliveryWindow(sub.deliveryWindow);
  return {
    id: sub.id,
    type: "membership" as const,
    startTime,
    status: status.toLowerCase(),
  };
}