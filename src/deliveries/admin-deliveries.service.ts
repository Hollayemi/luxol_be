import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { GetDeliveryCalendarDto } from "./dto/get-delivery-calendar.dto.js";
import { ListDeliveriesDto } from "./dto/list-deliveries.dto.js";
import { UpdateDeliveryStatusDto } from "./dto/update-delivery-status.dto.js";
import {
  deriveDeliveryStatus,
  serializeDelivery,
  serializeDeliveryPreview,
} from "./admin-deliveries.serializer.js";
import {
  eachDayInclusive,
  endOfDay,
  startOfDay,
  toDateKey,
} from "./delivery-dates.util.js";
import { DatabaseService } from "../database/database.service.js";
import { DeliveryStatus } from "../generated/prisma/enums.js";
import { Prisma } from "../generated/prisma/client.js";

@Injectable()
export class AdminDeliveriesService {
  constructor(private db: DatabaseService) {}

  // ─── Shared filter builder ──────────────────────────────────

  private subscriptionWhere(
    from: Date,
    to: Date,
    type?: string,
    status?: DeliveryStatus,
  ): Prisma.SubscriptionWhereInput {
    const where: Prisma.SubscriptionWhereInput = {
      nextDeliveryAt: { gte: from, lte: to },
      status: { in: ["ACTIVE", "PAUSED"] },
    };

    // v1: only membership
    if (type && type !== "membership") {
      // Impossible clause — no rows
      where.id = "__no_match__";
    }

    // Status filter is applied post-derivation, since the DB value may differ
    // from the derived status (e.g. MISSED is derived from date). We handle
    // this in the caller by filtering after we compute.
    // For efficiency we can pre-filter obvious cases:
    if (status === "DELIVERED") {
      where.currentDeliveryStatus = "DELIVERED";
    } else if (status === "OUT_FOR_DELIVERY") {
      where.currentDeliveryStatus = "OUT_FOR_DELIVERY";
    } else if (status === "MISSED") {
      // MISSED is either explicitly marked or derived from past date
      where.OR = [
        { currentDeliveryStatus: "MISSED" },
        {
          currentDeliveryStatus: "SCHEDULED",
          nextDeliveryAt: { lt: new Date() },
        },
      ];
    } else if (status === "SCHEDULED") {
      where.currentDeliveryStatus = "SCHEDULED";
      where.nextDeliveryAt = { gte: new Date(), lte: to };
    } else if (status === "SKIPPED") {
      where.currentDeliveryStatus = "SKIPPED";
    }

    return where;
  }

  // ─── Calendar ───────────────────────────────────────────────

  async calendar(dto: GetDeliveryCalendarDto) {
    const from = startOfDay(dto.from);
    const to = endOfDay(dto.to);

    const subs = await this.db.subscription.findMany({
      where: this.subscriptionWhere(from, to, dto.type, dto.status),
      include: {
        plan: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });

    // Group by day
    const buckets = new Map<
      string,
      Array<{
        id: string;
        type: "membership";
        startTime: string;
        status: string;
      }>
    >();

    for (const sub of subs) {
      if (!sub.nextDeliveryAt) continue;
      const key = toDateKey(sub.nextDeliveryAt);
      const preview = serializeDeliveryPreview(sub);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(preview);
    }

    const days = eachDayInclusive(dto.from, dto.to)
      .map((date) => {
        const list = buckets.get(date) ?? [];
        list.sort((a, b) => a.startTime.localeCompare(b.startTime));

        return {
          date,
          total: list.length,
          previews: list.slice(0, 3), // first 3 chips
        };
      })
      .filter((d) => d.total > 0); // skip empty days

    return { days };
  }

  // ─── List ───────────────────────────────────────────────────

  async list(dto: ListDeliveriesDto) {
    const page = dto.page ?? 1;
    const perPage = dto.perPage ?? 20;
    const skip = (page - 1) * perPage;

    // Day view vs. range view
    let from: Date;
    let to: Date;

    if (dto.date) {
      from = startOfDay(dto.date);
      to = endOfDay(dto.date);
    } else if (dto.from && dto.to) {
      from = startOfDay(dto.from);
      to = endOfDay(dto.to);
    } else {
      // Default: today
      const today = toDateKey(new Date());
      from = startOfDay(today);
      to = endOfDay(today);
    }

    const where = this.subscriptionWhere(from, to, dto.type, dto.status);

    const [total, rows] = await this.db.$transaction([
      this.db.subscription.count({ where }),
      this.db.subscription.findMany({
        where,
        include: {
          plan: true,
          user: { select: { id: true, name: true, image: true } },
        },
        orderBy: { nextDeliveryAt: "asc" },
        skip,
        take: perPage,
      }),
    ]);

    // Serialize + sort within the page by start time
    const items = rows
      .map(serializeDelivery)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return {
      items,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      page,
    };
  }

  // ─── Update status ──────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateDeliveryStatusDto) {
    if (
      dto.status !== "OUT_FOR_DELIVERY" &&
      dto.status !== "DELIVERED" &&
      dto.status !== "MISSED"
    ) {
      throw new BadRequestException(
        "Only OUT_FOR_DELIVERY, DELIVERED and MISSED can be set manually",
      );
    }

    // `id` is the subscription id in v1
    const sub = await this.db.subscription.findUnique({
      where: { id },
      include: {
        plan: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });
    if (!sub) throw new NotFoundException("Delivery not found");
    if (!sub.nextDeliveryAt) {
      throw new BadRequestException("This subscription has no scheduled delivery");
    }

    const current = deriveDeliveryStatus(sub);
    const allowed = new Set([
      "SCHEDULED" as DeliveryStatus,
      "OUT_FOR_DELIVERY" as DeliveryStatus,
    ]);

    // Don't allow re-marking a delivered delivery
    if (current === "DELIVERED") {
      throw new BadRequestException("Delivery is already marked delivered");
    }

    const updated = await this.db.$transaction(async (tx) => {
      if (dto.status === "DELIVERED") {
        // Advance to next cycle and reset the override
        const nextDeliveryAt = this.nextDeliveryDate(
          sub.nextDeliveryAt!,
          sub.deliveryFrequency,
        );

        return tx.subscription.update({
          where: { id },
          data: {
            nextDeliveryAt,
            currentDeliveryStatus: "SCHEDULED",
            currentDeliveryMarkedAt: null,
          },
          include: {
            plan: true,
            user: { select: { id: true, name: true, image: true } },
          },
        });
      }

      // OUT_FOR_DELIVERY and MISSED just stamp the override
      return tx.subscription.update({
        where: { id },
        data: {
          currentDeliveryStatus: dto.status,
          currentDeliveryMarkedAt: new Date(),
        },
        include: {
          plan: true,
          user: { select: { id: true, name: true, image: true } },
        },
      });
    });

    return serializeDelivery(updated);
  }

  // ─── Helpers ────────────────────────────────────────────────

  private nextDeliveryDate(from: Date, frequency: string): Date {
    const d = new Date(from);
    switch (frequency) {
      case "WEEKLY":
        d.setDate(d.getDate() + 7);
        break;
      case "FORTNIGHTLY":
        d.setDate(d.getDate() + 14);
        break;
      case "MONTHLY":
      default:
        d.setMonth(d.getMonth() + 1);
    }
    return d;
  }
}