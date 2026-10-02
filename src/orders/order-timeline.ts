import { OrderStatus } from "../generated/prisma/enums.js";

export type OrderStepId =
  | "PLACED"
  | "PAYMENT"
  | "PACKED"
  | "OUT_FOR_DELIVERY"
  | "RECEIVED"
  | "RATE";

export type OrderStepState = "DONE" | "ACTIVE" | "PENDING";

export type OrderStep = {
  stepId: OrderStepId;
  state: OrderStepState;
  /** ISO string when the step was completed; null for pending steps. */
  at: string | null;
  /** Default or admin-supplied note for this step. */
  note: string;
};

export const STEP_META: Record<
  OrderStepId,
  { title: string; defaultNote: string; order: number }
> = {
  PLACED: {
    title: "Order placed",
    defaultNote: "We've received your order and it's awaiting confirmation.",
    order: 1,
  },
  PAYMENT: {
    title: "Payment confirmed",
    defaultNote: "Your payment has been confirmed successfully.",
    order: 2,
  },
  PACKED: {
    title: "Order packed",
    defaultNote: "Your items are packed and ready to be dispatched.",
    order: 3,
  },
  OUT_FOR_DELIVERY: {
    title: "Out for delivery",
    defaultNote: "The order is with the rider and on the way.",
    order: 4,
  },
  RECEIVED: {
    title: "Order delivered",
    defaultNote: "The order has been received by the customer.",
    order: 5,
  },
  RATE: {
    title: "Rate your order",
    defaultNote: "Share feedback about your experience.",
    order: 6,
  },
};

// ─────────────────────────────────────────────────────────────
// BUILDERS
// ─────────────────────────────────────────────────────────────

/** Build the full initial timeline for a fresh order. */
export function buildTimeline(
  opts: { paymentAlreadyConfirmed?: boolean } = {},
): OrderStep[] {
  const now = new Date().toISOString();

  const steps: OrderStep[] = [
    {
      stepId: "PLACED",
      state: "DONE",
      at: now,
      note: STEP_META.PLACED.defaultNote,
    },
    {
      stepId: "PAYMENT",
      state: opts.paymentAlreadyConfirmed ? "DONE" : "ACTIVE",
      at: opts.paymentAlreadyConfirmed ? now : null,
      note: STEP_META.PAYMENT.defaultNote,
    },
    {
      stepId: "PACKED",
      state: "PENDING",
      at: null,
      note: STEP_META.PACKED.defaultNote,
    },
    {
      stepId: "OUT_FOR_DELIVERY",
      state: "PENDING",
      at: null,
      note: STEP_META.OUT_FOR_DELIVERY.defaultNote,
    },
    {
      stepId: "RECEIVED",
      state: "PENDING",
      at: null,
      note: STEP_META.RECEIVED.defaultNote,
    },
    {
      stepId: "RATE",
      state: "PENDING",
      at: null,
      note: STEP_META.RATE.defaultNote,
    },
  ];

  return steps;
}

// ─────────────────────────────────────────────────────────────
// STATUS → STEP MAPPING
// ─────────────────────────────────────────────────────────────

export function statusToStep(status: OrderStatus): OrderStepId | null {
  switch (status) {
    case "PENDING":
      return "PLACED";
    case "PROCESSING":
      return "PACKED";
    case "OUT_FOR_DELIVERY":
      return "OUT_FOR_DELIVERY";
    case "DELIVERED":
      return "RECEIVED";
    case "CANCELLED":
    case "RETURNED":
      return null; // handled separately
    default:
      return null;
  }
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return (
    status === "DELIVERED" ||
    status === "CANCELLED" ||
    status === "RETURNED"
  );
}

// ─────────────────────────────────────────────────────────────
// ADVANCE
// ─────────────────────────────────────────────────────────────

/**
 * Advance the timeline to the step matching `status`.
 *
 * - Steps before the target → DONE
 * - Target step             → DONE (timestamped)
 * - Trailing steps          → PENDING, except RATE which becomes ACTIVE
 *                             when the order is terminal (so the customer
 *                             can still rate a delivered order).
 */
export function advanceTimeline(
  timeline: OrderStep[],
  status: OrderStatus,
  opts: { at?: string; note?: string } = {},
): OrderStep[] {
  const targetStep = statusToStep(status);
  if (!targetStep) return timeline;

  const now = opts.at ?? new Date().toISOString();
  const targetIdx = timeline.findIndex((s) => s.stepId === targetStep);
  if (targetIdx === -1) return timeline;

  return timeline.map((s, i) => {
    // Everything before the target: DONE
    if (i < targetIdx) return { ...s, state: "DONE" as const };

    // The target itself: DONE
    if (i === targetIdx) {
      return {
        ...s,
        state: "DONE" as const,
        at: s.at ?? now,
        note: opts.note ?? s.note,
      };
    }

    // Trailing steps on a terminal status
    if (isTerminalStatus(status)) {
      // Let the customer rate a delivered order
      if (s.stepId === "RATE") {
        return { ...s, state: "ACTIVE" as const };
      }
      return { ...s, state: "PENDING" as const };
    }

    // Non-terminal: activate the step right after the target
    if (i === targetIdx + 1) {
      return { ...s, state: "ACTIVE" as const };
    }

    return { ...s, state: "PENDING" as const };
  });
}

// ─────────────────────────────────────────────────────────────
// PAYMENT
// ─────────────────────────────────────────────────────────────

/** Mark the PAYMENT step done when Paystack confirms. */
export function markPaymentConfirmed(
  timeline: OrderStep[],
  at?: string,
): OrderStep[] {
  const now = at ?? new Date().toISOString();
  const idx = timeline.findIndex((s) => s.stepId === "PAYMENT");
  if (idx === -1 || timeline[idx].state === "DONE") return timeline;

  return timeline.map((s, i) => {
    if (i === idx) return { ...s, state: "DONE" as const, at: now };
    if (i === idx + 1) return { ...s, state: "ACTIVE" as const };
    return s;
  });
}

// ─────────────────────────────────────────────────────────────
// CLOSE (cancel / return)
// ─────────────────────────────────────────────────────────────

/**
 * Force-close the timeline on cancel/return.
 * Any still-PENDING step gets the supplied note (or keeps its own).
 * RATE stays PENDING — you can't rate a cancelled order.
 */
export function closeTimeline(
  timeline: OrderStep[],
  note?: string,
): OrderStep[] {
  return timeline.map((s) =>
    s.state === "PENDING"
      ? { ...s, state: "PENDING" as const, note: note ?? s.note }
      : s,
  );
}

// ─────────────────────────────────────────────────────────────
// RATE
// ─────────────────────────────────────────────────────────────

/** True when the customer can rate this order right now. */
export function canRate(timeline: OrderStep[]): boolean {
  const rate = timeline.find((s) => s.stepId === "RATE");
  return rate?.state === "ACTIVE";
}

/** Mark the RATE step done once the customer submits a rating. */
export function markRated(
  timeline: OrderStep[],
  at?: string,
): OrderStep[] {
  const now = at ?? new Date().toISOString();
  return timeline.map((s) =>
    s.stepId === "RATE"
      ? { ...s, state: "DONE" as const, at: now }
      : s,
  );
}

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────

/** Sort for output (defensive; array is already ordered by construction). */
export function sortTimeline(timeline: OrderStep[]): OrderStep[] {
  return [...timeline].sort(
    (a, b) => STEP_META[a.stepId].order - STEP_META[b.stepId].order,
  );
}

/** Type guard for reading the JSON column safely. */
export function readTimeline(raw: unknown): OrderStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is OrderStep =>
      s !== null &&
      typeof s === "object" &&
      "stepId" in s &&
      "state" in s &&
      "at" in s &&
      "note" in s,
  );
}