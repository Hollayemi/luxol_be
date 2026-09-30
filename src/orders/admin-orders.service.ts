import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import {
    Prisma,
    OrderStatus,
} from "../generated/prisma/client.js";
import {
    AdminOrderPeriod,
    ListAdminOrdersDto,
} from "./dto/list-admin-orders.dto.js";
import { CancelAdminOrderDto } from "./dto/cancel-admin-order.dto.js";
import {
    allowedNextStatuses,
    canCancel,
    serializeOrderDetail,
    serializeOrderSummary,
} from "./admin-orders.serializer.js";
import { DatabaseService } from "../database/database.service.js";
import { GetAdminOrderStatsDto } from "./dto/get-admin-order-stats.dto.js";
import { UpdateAdminOrderStatusDto } from "./dto/update-admin-order-status.dto.js";
import { advanceTimeline, OrderStep } from "./order-timeline.js";

@Injectable()
export class AdminOrdersService {
    private readonly logger = new Logger(AdminOrdersService.name);

    constructor(private db: DatabaseService) { }

    // ─── Period helpers ─────────────────────────────────────────

    private periodRange(period?: AdminOrderPeriod): { gte?: Date; lte?: Date } {
        const now = new Date();
        const startOfDay = (d: Date) =>
            new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const startOfWeek = (d: Date) => {
            const day = d.getDay(); // 0 = Sun
            const diff = (day + 6) % 7; // treat Monday as start
            const x = startOfDay(d);
            x.setDate(x.getDate() - diff);
            return x;
        };
        const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
        const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);

        switch (period) {
            case "today":
                return { gte: startOfDay(now) };
            case "this_week":
                return { gte: startOfWeek(now) };
            case "this_month":
                return { gte: startOfMonth(now) };
            case "last_month": {
                const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const last = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                return { gte: first, lte: last };
            }
            case "this_year":
                return { gte: startOfYear(now) };
            case "all_time":
            default:
                return {};
        }
    }

    // ─── Stats ──────────────────────────────────────────────────

    async stats(dto: GetAdminOrderStatsDto) {
        const range = this.periodRange(dto.period);
        const baseWhere: Prisma.OrderWhereInput = {
            ...(dto.type ? { type: dto.type } : {}),
            ...(range.gte || range.lte ? { placedAt: range } : {}),
        };

        const [total, pending, processing, outForDelivery, completed, tabGroups] =
            await Promise.all([
                this.db.order.count({ where: baseWhere }),
                this.db.order.count({ where: { ...baseWhere, status: "PENDING" } }),
                this.db.order.count({ where: { ...baseWhere, status: "PROCESSING" } }),
                this.db.order.count({
                    where: { ...baseWhere, status: "OUT_FOR_DELIVERY" },
                }),
                this.db.order.count({ where: { ...baseWhere, status: "DELIVERED" } }),
                this.db.order.groupBy({
                    by: ["type"],
                    where: {
                        // Tab counts are always for "attention needed" — pending + processing
                        status: { in: ["PENDING", "PROCESSING"] },
                        ...(dto.type ? {} : {}), // NOTE: tab counts are across all types
                    },
                    _count: { _all: true },
                }),
            ]);

        // Build tabCounts — missing types default to 0
        const tabCounts = { shop: 0, meat_box: 0, freezer_planner: 0 };
        for (const g of tabGroups) {
            const key = g.type.toLowerCase() as keyof typeof tabCounts;
            tabCounts[key] = g._count._all;
        }

        // Change % is out of scope for v1 (needs historical snapshots).
        // Return zeroes so the UI still renders.
        return {
            totalOrders: { value: total, changePercent: 0 },
            pendingOrders: { value: pending, changePercent: 0 },
            processing: { value: processing, changePercent: 0 },
            outForDelivery: { value: outForDelivery, changePercent: 0 },
            completed: { value: completed, changePercent: 0 },
            tabCounts,
        };
    }

    // ─── List ───────────────────────────────────────────────────

    async list(dto: ListAdminOrdersDto) {
        const page = dto.page ?? 1;
        const perPage = dto.perPage ?? 20;
        const skip = (page - 1) * perPage;

        const range = this.periodRange(dto.period);

        const where: Prisma.OrderWhereInput = {
            ...(dto.type ? { type: dto.type } : {}),
            ...(dto.status ? { status: dto.status } : {}),
            ...(range.gte || range.lte ? { placedAt: range } : {}),
            ...(dto.paymentStatus
                ? { payments: { some: { status: dto.paymentStatus } } }
                : {}),
            ...(dto.search
                ? {
                    OR: [
                        { orderNumber: { contains: dto.search, mode: "insensitive" } },
                        {
                            user: {
                                name: { contains: dto.search, mode: "insensitive" },
                            },
                        },
                    ],
                }
                : {}),
        };

        const [total, rows] = await this.db.$transaction([
            this.db.order.count({ where }),
            this.db.order.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, image: true } },
                    items: true,
                    payments: true,
                },
                orderBy: { placedAt: "desc" },
                skip,
                take: perPage,
            }),
        ]);

        return {
            items: rows.map(serializeOrderSummary),
            total,
            totalPages: Math.max(1, Math.ceil(total / perPage)),
            page,
        };
    }

    // ─── Detail ─────────────────────────────────────────────────

    async findOne(id: string) {
        const order = await this.db.order.findUnique({
            where: { id },
            include: {
                user: true,
                items: { include: { product: { select: { sku: true } } } },
                payments: true,
                address: true,
            },
        });

        if (!order) throw new NotFoundException("Order not found");
        return serializeOrderDetail(order);
    }

    // ─── Update status ──────────────────────────────────────────

    async updateStatus(id: string, dto: UpdateAdminOrderStatusDto) {
        const order = await this.db.order.findUnique({ where: { id } });
        if (!order) throw new NotFoundException("Order not found");

        if (dto.status === "CANCELLED") {
            throw new BadRequestException(
                "Use the cancel endpoint to cancel an order",
            );
        }

        const allowed = allowedNextStatuses(order.status);
        if (!allowed.includes(dto.status)) {
            throw new BadRequestException(
                `Cannot move order from ${order.status} to ${dto.status}`,
            );
        }

        const updated = await this.db.$transaction(async (tx) => {
            const now = new Date();

            const updatedOrder = await tx.order.update({
                where: { id },
                data: {
                    status: dto.status,
                    deliveredAt: dto.status === "DELIVERED" ? now : undefined,
                },
            });

            // Update the track step that corresponds to the new status
            const stepIdMap: Record<OrderStatus, string> = {
                PENDING: "PLACED",
                PROCESSING: "PACKED",
                OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
                DELIVERED: "RECEIVED",
                CANCELLED: "PLACED",
                RETURNED: "PLACED",
                REFUNDED: "REFUNDED",
            };

            const stepId = stepIdMap[dto.status];
            if (stepId) {
                const newTimeline = advanceTimeline(
                    order.timeline as unknown as OrderStep[],
                    dto.status,
                    { note: dto.note },
                );

                await tx.order.update({
                    where: { id },
                    data: {
                        status: dto.status,
                        deliveredAt: dto.status === "DELIVERED" ? now : undefined,
                        timeline: newTimeline as unknown as Prisma.InputJsonValue,
                    },
                });
            }

            // Append note to timeline via a generic notification / audit log
            if (dto.note) {
                await tx.auditLog.create({
                    data: {
                        action: "order.status_update",
                        entityType: "Order",
                        entityId: id,
                        after: {
                            status: dto.status,
                            note: dto.note,
                        } as Prisma.InputJsonValue,
                    },
                });
            }

            return updatedOrder;
        });

        // Re-read full detail for the drawer
        return this.findOne(updated.id);
    }

    // ─── Cancel ─────────────────────────────────────────────────

    async cancel(id: string, dto: CancelAdminOrderDto) {
        const order = await this.db.order.findUnique({ where: { id } });
        if (!order) throw new NotFoundException("Order not found");

        if (!canCancel(order.status)) {
            throw new BadRequestException(
                `Order in ${order.status} cannot be cancelled`,
            );
        }

        await this.db.$transaction(async (tx) => {
            await tx.order.update({
                where: { id },
                data: {
                    status: "CANCELLED",
                    cancelledAt: new Date(),
                    cancelReason: dto.reason,
                },
            });

            // Restock items (reverse the decrements done in placeOrder)
            const items = await tx.orderItem.findMany({ where: { orderId: id } });
            for (const item of items) {
                if (item.variantId) {
                    await tx.productVariant.update({
                        where: { id: item.variantId },
                        data: { stock: { increment: item.quantity } },
                    });
                } else {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quantity } },
                    });
                }
                await tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        delta: item.quantity,
                        reason: "order_cancelled",
                        reference: id,
                    },
                });
            }

            await tx.auditLog.create({
                data: {
                    action: "order.cancelled",
                    entityType: "Order",
                    entityId: id,
                    after: { reason: dto.reason } as Prisma.InputJsonValue,
                },
            });
        });

        return this.findOne(id);
    }
}