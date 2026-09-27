import { Prisma } from "../generated/prisma/client.js";
import { TrackStepId, TrackStepState } from "../generated/prisma/enums.js";


interface StepTemplate {
  stepId: TrackStepId;
  title: string;
  description: string;
  sortOrder: number;
}

const BASE_STEPS: StepTemplate[] = [
  { stepId: "PLACED", title: "Order Placed", description: "We received your order", sortOrder: 0 },
  { stepId: "PAYMENT", title: "Payment Confirmed", description: "Payment received successfully", sortOrder: 1 },
  { stepId: "PACKED", title: "Packed", description: "Your order has been packed", sortOrder: 2 },
  { stepId: "OUT_FOR_DELIVERY", title: "Out for Delivery", description: "On the way to you", sortOrder: 3 },
  { stepId: "RECEIVED", title: "Received", description: "Delivered", sortOrder: 4 },
  { stepId: "RATE", title: "Rate Order", description: "Tell us how we did", sortOrder: 5 },
];

export function buildInitialTrackSteps(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<any> {
  return tx.orderTrackStep.createMany({
    data: BASE_STEPS.map((s, i) => ({
      orderId,
      stepId: s.stepId,
      title: s.title,
      description: s.description,
      sortOrder: s.sortOrder,
      state: i === 0 ? TrackStepState.ACTIVE : TrackStepState.PENDING,
      occurredAt: i === 0 ? new Date() : null,
    })),
  });
}

/**
 * Mark a step as DONE, advance the next one to ACTIVE.
 * Steps are processed in sortOrder.
 */
export async function advanceTrack(
  tx: Prisma.TransactionClient,
  orderId: string,
  stepId: TrackStepId,
): Promise<void> {
  const all = await tx.orderTrackStep.findMany({
    where: { orderId },
    orderBy: { sortOrder: "asc" },
  });

  const index = all.findIndex((s) => s.stepId === stepId);
  if (index === -1) return;

  await tx.orderTrackStep.update({
    where: { id: all[index].id },
    data: { state: TrackStepState.DONE, occurredAt: new Date() },
  });

  const next = all[index + 1];
  if (next && next.state === TrackStepState.PENDING) {
    await tx.orderTrackStep.update({
      where: { id: next.id },
      data: { state: TrackStepState.ACTIVE },
    });
  }
}