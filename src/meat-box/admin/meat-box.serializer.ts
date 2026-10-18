import { Prisma } from "../../generated/prisma/client.js";
import { MeatBoxOrderStatus, PaymentStatus } from "../../generated/prisma/enums.js";
import { readTimeline, sortTimeline } from "../../orders/order-timeline.js";


const lc = (s: string) => s.toLowerCase();

// ─── Payment status ─────────────────────────────────────────

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

// ─── Allowed next statuses ──────────────────────────────────

const ALLOWED_NEXT: Record<MeatBoxOrderStatus, MeatBoxOrderStatus[]> = {
    PENDING_WEIGHING: [],
    PRICE_CONFIRMED: [],
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

export function canUpdatePrice(order: {
    status: MeatBoxOrderStatus;
    paidAt: Date | null;
}): boolean {
    if (order.paidAt) return false;
    return (
        order.status === "PENDING_WEIGHING" ||
        order.status === "PRICE_CONFIRMED"
    );
}

export function canCancel(status: MeatBoxOrderStatus): boolean {
    return status !== "COMPLETED" && status !== "CANCELLED";
}

// ─── Summary (table row) ────────────────────────────────────

type OrderForSummary = Prisma.MeatBoxOrderGetPayload<{
    include: {
        user: { select: { id: true; name: true; image: true } };
        items: true;
        payments: { select: { status: true } };
    };
}>;

export function serializeOrderSummary(order: OrderForSummary) {
    const finalWeightKg = order.finalWeightKg
        ? Number(order.finalWeightKg)
        : null;

    return {
        id: order.id,
        code: order.code, // no leading "#" — the frontend adds it
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
        confirmedTotal:
            order.confirmedTotal != null ? Number(order.confirmedTotal) : null,
        estimatedTotal:
            order.estimatedMinTotal != null && order.estimatedMaxTotal != null
                ? {
                    min: Number(order.estimatedMinTotal),
                    max: Number(order.estimatedMaxTotal),
                }
                : null,
        finalWeightKg,
        nextDeliveryAt: order.nextDeliveryAt?.toISOString() ?? null,
        deliveredAt: order.deliveredAt?.toISOString() ?? null,
    };
}

// ─── Detail (drawer) ────────────────────────────────────────

type OrderForDetail = Prisma.MeatBoxOrderGetPayload<{
    include: {
        user: true;
        items: { include: { option: { select: { image: true; estimatedMinKg: true; estimatedMaxKg: true } } } };
        payments: true;
    };
}> & {
    // MeatBoxOrder does not currently persist a timeline JSON column in Prisma,
    // but some callers may attach one for admin notes or future compatibility.
    timeline?: unknown;
};

export function serializeOrderDetail(order: OrderForDetail) {
    // Build a small timeline from the order's timestamps, then blend in the
    // standard steps from the shared `timeline` JSON column if present.
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
            id: "price",
            title: "Final weight & price confirmed",
            description: order.priceConfirmedAt
                ? "Staff weighed the meat and set the final price."
                : "Waiting on staff to weigh and price this order.",
            occurredAt: order.priceConfirmedAt?.toISOString() ?? null,
            state: order.priceConfirmedAt
                ? ("done" as const)
                : order.status === "PENDING_WEIGHING"
                    ? ("active" as const)
                    : ("pending" as const),
        },
        {
            id: "paid",
            title: "Payment confirmed",
            description: order.paidAt
                ? "Customer has paid for this order."
                : "Waiting for the customer to pay.",
            occurredAt: order.paidAt?.toISOString() ?? null,
            state: order.paidAt
                ? ("done" as const)
                : order.status === "PRICE_CONFIRMED"
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
            state:
                order.status === "COMPLETED"
                    ? ("done" as const)
                    : ("pending" as const),
        },
    ];

    // If the shared JSON timeline has custom admin notes, append them
    // rather than replacing the meat-box-specific steps above.
    for (const step of jsonTimeline) {
        timeline.push({
            id: `note_${step.stepId}`,
            title: `Note · ${step.stepId}`,
            description: step.note,
            occurredAt: step.at,
            state: step.state.toLowerCase() as "done" | "active" | "pending",
        });
    }

    const itemsTotal = order.confirmedTotal != null ? Number(order.confirmedTotal) : null;

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
        confirmedTotal: order.confirmedTotal != null ? Number(order.confirmedTotal) : null,
        estimatedTotal:
            order.estimatedMinTotal != null && order.estimatedMaxTotal != null
                ? { min: Number(order.estimatedMinTotal), max: Number(order.estimatedMaxTotal) }
                : null,
        finalWeightKg: order.finalWeightKg != null ? Number(order.finalWeightKg) : null,
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
            unit: i.unit,
            quantity: i.quantity,
            pricePerKg: i.pricePerKg != null ? Number(i.pricePerKg) : null,
            estimatedWeightKg:
                i.option?.estimatedMinKg != null && i.option?.estimatedMaxKg != null
                    ? { min: Number(i.option.estimatedMinKg), max: Number(i.option.estimatedMaxKg) }
                    : null,
            finalWeightKg: i.finalWeightKg != null ? Number(i.finalWeightKg) : null,
            lineTotal: i.lineTotal != null ? Number(i.lineTotal) : null,
        })),

        estimatedWeightKg:
            order.estimatedMinKg != null && order.estimatedMaxKg != null
                ? { min: Number(order.estimatedMinKg), max: Number(order.estimatedMaxKg) }
                : null,

        timeline,

        priceConfirmedAt: order.priceConfirmedAt?.toISOString() ?? null,
        paidAt: order.paidAt?.toISOString() ?? null,

        itemsTotal,
        discount: 0,
        deliveryFee: 0,
        total: itemsTotal,

        allowedNextStatuses: allowedNextStatuses(order.status),
        canUpdatePrice: canUpdatePrice(order),
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

// ─── Catalogue ──────────────────────────────────────────────

type CategoryWithOptions = Prisma.MeatBoxCategoryGetPayload<{
    include: { options: true };
}>;

export function serializeCategory(cat: CategoryWithOptions) {
    return {
        id: cat.id,
        label: cat.label,
        slug: cat.slug,
        image: cat.image,
        status: cat.status,
        displayOrder: cat.displayOrder,
        createdAt: cat.createdAt.toISOString(),
        updatedAt: cat.updatedAt.toISOString(),
        options: [...cat.options]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((o) => ({
                id: o.id,
                categoryId: o.categoryId,
                label: o.label,
                image: o.image,
                unit: o.unit,
                pricePerKg: o.pricePerKg != null ? Number(o.pricePerKg) : null,
                estimatedMinKg: o.estimatedMinKg != null ? Number(o.estimatedMinKg) : null,
                estimatedMaxKg: o.estimatedMaxKg != null ? Number(o.estimatedMaxKg) : null,
                estimatedMinPrice: o.estimatedMinPrice != null ? Number(o.estimatedMinPrice) : null,
                estimatedMaxPrice: o.estimatedMaxPrice != null ? Number(o.estimatedMaxPrice) : null,
                maxQuantity: o.maxQuantity,
                status: o.status,
                displayOrder: o.displayOrder,
                createdAt: o.createdAt.toISOString(),
                updatedAt: o.updatedAt.toISOString(),
            })),
    };
}

type OptionRow = Prisma.MeatBoxOptionGetPayload<{}>;

export function serializeOption(o: OptionRow) {
    return {
        id: o.id,
        categoryId: o.categoryId,
        label: o.label,
        image: o.image,
        unit: o.unit,
        pricePerKg: o.pricePerKg != null ? Number(o.pricePerKg) : null,
        estimatedMinKg: o.estimatedMinKg != null ? Number(o.estimatedMinKg) : null,
        estimatedMaxKg: o.estimatedMaxKg != null ? Number(o.estimatedMaxKg) : null,
        estimatedMinPrice: o.estimatedMinPrice != null ? Number(o.estimatedMinPrice) : null,
        estimatedMaxPrice: o.estimatedMaxPrice != null ? Number(o.estimatedMaxPrice) : null,
        maxQuantity: o.maxQuantity,
        status: o.status,
        displayOrder: o.displayOrder,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
    };
}