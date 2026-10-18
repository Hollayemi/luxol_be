import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  allowedNextStatuses,
  canCancel,
  derivePaymentStatus,
  serializeOrderDetail,
  serializeOrderSummary,
} from "./meat-box.serializer.js";
import { periodRange } from "../../common/utils/period.util.js";
import { DatabaseService } from "../../database/database.service.js";
import { GetAdminMeatBoxStatsDto } from "../dto/get-admin-meat-box-stats.dto.js";
import { MeatBoxOrderStatus, Prisma } from "../../generated/prisma/client.js";
import { AdminMeatBoxPaymentStatusFilter, ListAdminMeatBoxOrdersDto } from "../dto/list-admin-meat-box-orders.dto.js";
import { UpdateMeatBoxPriceDto } from "../dto/update-meat-box-price.dto.js";
import { UpdateMeatBoxStatusDto } from "../dto/update-meat-box-status.dto.js";
import { CancelMeatBoxOrderDto } from "../dto/cancel-meat-box-order.dto.js";

@Injectable()
export class AdminMeatBoxOrdersService {
  constructor(private db: DatabaseService) {}

  // ─── Stats ──────────────────────────────────────────────────

  async stats(dto: GetAdminMeatBoxStatsDto) {
    const range = periodRange(dto.period);
    const baseWhere: Prisma.MeatBoxOrderWhereInput = range.gte || range.lte
      ? { createdAt: range }
      : {};

    const [total, pendingWeighing, priceConfirmed, processing, outForDelivery, completed] =
      await Promise.all([
        this.db.meatBoxOrder.count({ where: baseWhere }),
        this.db.meatBoxOrder.count({ where: { ...baseWhere, status: "PENDING_WEIGHING" } }),
        this.db.meatBoxOrder.count({ where: { ...baseWhere, status: "PRICE_CONFIRMED" } }),
        this.db.meatBoxOrder.count({ where: { ...baseWhere, status: "PROCESSING" } }),
        this.db.meatBoxOrder.count({ where: { ...baseWhere, status: "OUT_FOR_DELIVERY" } }),
        this.db.meatBoxOrder.count({ where: { ...baseWhere, status: "COMPLETED" } }),
      ]);

    return {
      totalOrders: { value: total, changePercent: 0 },
      pendingWeighing: { value: pendingWeighing, changePercent: 0 },
      priceConfirmed: { value: priceConfirmed, changePercent: 0 },
      processing: { value: processing, changePercent: 0 },
      outForDelivery: { value: outForDelivery, changePercent: 0 },
      completed: { value: completed, changePercent: 0 },
    };
  }

  // ─── List ───────────────────────────────────────────────────

  async list(dto: ListAdminMeatBoxOrdersDto) {
    const page = dto.page ?? 1;
    const perPage = dto.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const range = periodRange(dto.period);

    const where: Prisma.MeatBoxOrderWhereInput = {
      ...(dto.status ? { status: dto.status } : {}),
      ...(range.gte || range.lte ? { createdAt: range } : {}),
    };

    if (dto.paymentStatus === AdminMeatBoxPaymentStatusFilter.PAID) {
      where.paidAt = { not: null };
    } else if (dto.paymentStatus === AdminMeatBoxPaymentStatusFilter.UNPAID) {
      where.paidAt = null;
    } else if (dto.paymentStatus === AdminMeatBoxPaymentStatusFilter.REFUNDED) {
      where.payments = { some: { status: "REFUNDED" } };
    }

    if (dto.search) {
      where.OR = [
        { code: { contains: dto.search, mode: "insensitive" } },
        { user: { name: { contains: dto.search, mode: "insensitive" } } },
      ];
    }

    const [total, rows] = await this.db.$transaction([
      this.db.meatBoxOrder.count({ where }),
      this.db.meatBoxOrder.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, image: true } },
          items: true,
          payments: { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
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
    const order = await this.db.meatBoxOrder.findUnique({
      where: { id },
      include: {
        user: true,
        items: {
          include: {
            option: {
              select: { image: true, estimatedMinKg: true, estimatedMaxKg: true },
            },
          },
        },
        payments: true,
      },
    });
    if (!order) throw new NotFoundException("Meat box order not found");
    return serializeOrderDetail(order);
  }

  // ─── Update price (weighing step) ───────────────────────────

  async updatePrice(id: string, dto: UpdateMeatBoxPriceDto) {
    const order = await this.db.meatBoxOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Meat box order not found");

    if (order.paidAt) {
      throw new BadRequestException(
        "Cannot change the price after the customer has paid",
      );
    }
    if (
      order.status !== "PENDING_WEIGHING" &&
      order.status !== "PRICE_CONFIRMED"
    ) {
      throw new BadRequestException(
        `Cannot set a price when the order is ${order.status}`,
      );
    }

    // Every line on the order must be present in the payload
    const orderItemIds = new Set(order.items.map((i) => i.id));
    const payloadIds = new Set(dto.items.map((i) => i.itemId));
    const missing = [...orderItemIds].filter((x) => !payloadIds.has(x));
    const unknown = [...payloadIds].filter((x) => !orderItemIds.has(x));

    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing price for ${missing.length} line(s): ${missing.join(", ")}`,
      );
    }
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown item ids: ${unknown.join(", ")}`,
      );
    }

    const result = await this.db.$transaction(async (tx) => {
      let confirmedTotal = 0;
      let finalWeightKg = 0;

      for (const line of dto.items) {
        const lineTotal = new Prisma.Decimal(line.lineTotal.toFixed(2));
        const weight = new Prisma.Decimal(line.finalWeightKg.toFixed(3));

        await tx.meatBoxOrderItem.update({
          where: { id: line.itemId },
          data: {
            finalWeightKg: weight,
            lineTotal,
          },
        });

        confirmedTotal += line.lineTotal;
        finalWeightKg += line.finalWeightKg;
      }

      return tx.meatBoxOrder.update({
        where: { id },
        data: {
          confirmedTotal: new Prisma.Decimal(confirmedTotal.toFixed(2)),
          finalWeightKg: new Prisma.Decimal(finalWeightKg.toFixed(3)),
          priceConfirmedAt: new Date(),
          // Move forward only if this is the first confirmation
          status:
            order.status === "PENDING_WEIGHING"
              ? "PRICE_CONFIRMED"
              : order.status,
        },
        include: {
          user: true,
          items: {
            include: {
              option: {
                select: { image: true, estimatedMinKg: true, estimatedMaxKg: true },
              },
            },
          },
          payments: true,
        },
      });
    });

    return serializeOrderDetail(result);
  }

  // ─── Update status (post-payment lifecycle) ─────────────────

  async updateStatus(id: string, dto: UpdateMeatBoxStatusDto) {
    const order = await this.db.meatBoxOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Meat box order not found");

    if (dto.status === "CANCELLED") {
      throw new BadRequestException(
        "Use the cancel endpoint to cancel an order",
      );
    }
    if (
      dto.status === "PENDING_WEIGHING" ||
      dto.status === "PRICE_CONFIRMED"
    ) {
      throw new BadRequestException(
        `${dto.status} is set by the system, not manually`,
      );
    }

    const allowed = allowedNextStatuses(order.status);
    if (!allowed.includes(dto.status as any)) {
      throw new BadRequestException(
        `Cannot move order from ${order.status} to ${dto.status}`,
      );
    }

    // Guard: only paid orders can move to PROCESSING or beyond
    if (
      (dto.status === "PROCESSING" ||
        dto.status === "OUT_FOR_DELIVERY" ||
        dto.status === "COMPLETED") &&
      !order.paidAt
    ) {
      throw new BadRequestException(
        "Order has not been paid — cannot advance status",
      );
    }

    const updated = await this.db.$transaction(async (tx) => {
      const now = new Date();

      const updatedOrder = await tx.meatBoxOrder.update({
        where: { id },
        data: {
          status: dto.status as MeatBoxOrderStatus,
          deliveredAt: dto.status === "COMPLETED" ? now : undefined,
        },
      });

      // Append a note to the timeline JSON if one was supplied
      if (dto.note) {
        // NOTE: readTimeline + append + write, if you want the note to
        // show up in the drawer's "Note · ..." section.
        // For v1 we skip persisting the note and rely on audit logs.
        await tx.auditLog.create({
          data: {
            action: "meat_box_order.status_update",
            entityType: "MeatBoxOrder",
            entityId: id,
            after: { status: dto.status, note: dto.note } as Prisma.InputJsonValue,
          },
        });
      }

      return updatedOrder;
    });

    return this.findOne(updated.id);
  }

  // ─── Cancel ─────────────────────────────────────────────────

  async cancel(id: string, dto: CancelMeatBoxOrderDto) {
    const order = await this.db.meatBoxOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Meat box order not found");

    if (!canCancel(order.status)) {
      throw new BadRequestException(
        `Order in ${order.status} cannot be cancelled`,
      );
    }

    await this.db.$transaction(async (tx) => {
      await tx.meatBoxOrder.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: dto.reason,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "meat_box_order.cancelled",
          entityType: "MeatBoxOrder",
          entityId: id,
          after: { reason: dto.reason } as Prisma.InputJsonValue,
        },
      });
    });

    return this.findOne(id);
  }
}