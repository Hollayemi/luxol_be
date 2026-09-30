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

/** Build the full initial timeline for a fresh order. */
export function buildTimeline(
  opts: { paymentAlreadyConfirmed?: boolean } = {},
): OrderStep[] {
  const now = new Date().toISOString();

  const steps: OrderStep[] = [
    { stepId: "PLACED", state: "DONE", at: now, note: STEP_META.PLACED.defaultNote },
    {
      stepId: "PAYMENT",
      state: opts.paymentAlreadyConfirmed ? "DONE" : "ACTIVE",
      at: opts.paymentAlreadyConfirmed ? now : null,
      note: STEP_META.PAYMENT.defaultNote,
    },
    { stepId: "PACKED", state: "PENDING", at: null, note: STEP_META.PACKED.defaultNote },
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
    { stepId: "RATE", state: "PENDING", at: null, note: STEP_META.RATE.defaultNote },
  ];

  return steps;
}

/**
 * Advance the timeline to the step matching `status`.
 * Marks the target step DONE, activates the next one (unless terminal),
 * and preserves any existing notes.
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
    if (i < targetIdx) return { ...s, state: "DONE" as const };

    if (i === targetIdx) {
      return {
        ...s,
        state: "DONE" as const,
        at: s.at ?? now,
        note: opts.note ?? s.note,
      };
    }

    // First pending step after the target becomes ACTIVE; rest stay PENDING
    if (i === targetIdx + 1 && !isTerminalStatus(status)) {
      return { ...s, state: "ACTIVE" as const };
    }

    return { ...s, state: "PENDING" as const };
  });
}

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
  return status === "DELIVERED" || status === "CANCELLED" || status === "RETURNED";
}

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

/** Force-close the timeline on cancel/return. */
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

/** Sort for output (defensive; array is already ordered by construction). */
export function sortTimeline(timeline: OrderStep[]): OrderStep[] {
  return [...timeline].sort(
    (a, b) => STEP_META[a.stepId].order - STEP_META[b.stepId].order,
  );
}