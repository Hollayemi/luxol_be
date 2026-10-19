import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import { allowedNextStatuses, canCancel, serializeOrderDetail, serializeOrderSummary } from "./meat-box.serializer.js";
import { periodRange } from "../../common/utils/period.util.js";
import { MeatBoxOrderStatus, Prisma } from "../../generated/prisma/client.js";
import { GetAdminMeatBoxStatsDto } from "../dto/get-admin-meat-box-stats.dto.js";
import { AdminMeatBoxPaymentStatusFilter, ListAdminMeatBoxOrdersDto } from "../dto/list-admin-meat-box-orders.dto.js";
import { UpdateMeatBoxStatusDto } from "../dto/update-meat-box-status.dto.js";
import { CancelMeatBoxOrderDto } from "../dto/cancel-meat-box-order.dto.js";

@Injectable()
export class AdminMeatBoxOrdersService {
  constructor(private db: DatabaseService) {}

  // ─── Stats ──────────────────────────────────────────────────
  async stats(dto: GetAdminMeatBoxStatsDto) {
    const range = periodRange(dto.period);
    const baseWhere: Prisma.MeatBoxOrderWhereInput = range.gte || range.lte ? { createdAt: range } : {};

    const [total, pendingPayment, processing, outForDelivery, completed] = await Promise.all([
      this.db.meatBoxOrder.count({ where: baseWhere }),
      this.db.meatBoxOrder.count({ where: { ...baseWhere, status: "PENDING_PAYMENT" } }),
      this.db.meatBoxOrder.count({ where: { ...baseWhere, status: "PROCESSING" } }),
      this.db.meatBoxOrder.count({ where: { ...baseWhere, status: "OUT_FOR_DELIVERY" } }),
      this.db.meatBoxOrder.count({ where: { ...baseWhere, status: "COMPLETED" } }),
    ]);

    return {
      totalOrders: { value: total, changePercent: 0 },
      pendingPayment: { value: pendingPayment, changePercent: 0 },
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
            option: { select: { image: true } },
          },
        },
        payments: true,
      },
    });
    if (!order) throw new NotFoundException("Meat box order not found");
    return serializeOrderDetail(order);
  }

  // ─── Update status ──────────────────────────────────────────
  async updateStatus(id: string, dto: UpdateMeatBoxStatusDto) {
    const order = await this.db.meatBoxOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Meat box order not found");

    if (dto.status === "CANCELLED") {
      throw new BadRequestException("Use the cancel endpoint to cancel an order");
    }
    if (dto.status === "PENDING_PAYMENT") {
      throw new BadRequestException("Status is set by the system when payment fails or is reset");
    }

    const allowed = allowedNextStatuses(order.status);
    if (!allowed.includes(dto.status as any)) {
      throw new BadRequestException(`Cannot move order from ${order.status} to ${dto.status}`);
    }

    // Guard: only paid orders can move forward
    if (!order.paidAt) {
      throw new BadRequestException("Order has not been paid — cannot advance status");
    }

    const updated = await this.db.$transaction(async (tx) => {
      const updatedOrder = await tx.meatBoxOrder.update({
        where: { id },
        data: {
          status: dto.status as MeatBoxOrderStatus,
          deliveredAt: dto.status === "COMPLETED" ? new Date() : undefined,
        },
      });

      if (dto.note) {
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
      throw new BadRequestException(`Order in ${order.status} cannot be cancelled`);
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
          // after: { reason: dto.reason } as Prisma.JsonValue,
        },
      });
    });

    return this.findOne(id);
  }
}