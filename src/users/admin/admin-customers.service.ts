import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ListAdminCustomersDto,
} from "../dto/list-admin-customers.dto.js";
import { GetAdminCustomerStatsDto } from "../dto/get-admin-customer-stats.dto.js";
import { UpdateAdminCustomerStatusDto } from "../dto/update-admin-customer-status.dto.js";
import {
  deriveCustomerStatus,
  serializeCustomerDetail,
  serializeCustomerSummary,
} from "./admin-customers.serializer.js";
import { DatabaseService } from "../../database/database.service.js";
import { AdminOrderPeriod } from "../../orders/dto/list-admin-orders.dto.js";
import { Prisma } from "../../generated/prisma/client.js";

@Injectable()
export class AdminCustomersService {
  constructor(private db: DatabaseService) {}

  // ─── Period helper (shared with orders) ─────────────────────
  private periodRange(period?: AdminOrderPeriod): { gte?: Date; lte?: Date } {
    const now = new Date();
    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const startOfWeek = (d: Date) => {
      const day = d.getDay();
      const diff = (day + 6) % 7;
      const x = startOfDay(d);
      x.setDate(x.getDate() - diff);
      return x;
    };
    const startOfMonth = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), 1);
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
        const last = new Date(
          now.getFullYear(),
          now.getMonth(),
          0,
          23,
          59,
          59,
        );
        return { gte: first, lte: last };
      }
      case "this_year":
        return { gte: startOfYear(now) };
      case "all_time":
      default:
        return {};
    }
  }

  // ─── Stats ─────────────────────────────────────────────────
  async stats(dto: GetAdminCustomerStatsDto) {
    const range = this.periodRange(dto.period);
    const dateWhere =
      range.gte || range.lte ? { createdAt: range } : {};

    const [totalCustomers, newCustomers, activeCustomers, members] =
      await Promise.all([
        this.db.user.count({
          where: { role: "CUSTOMER" },
        }),
        this.db.user.count({
          where: { role: "CUSTOMER", ...dateWhere },
        }),
        // "Active" = has ordered in the last 90 days
        this.db.user.count({
          where: {
            role: "CUSTOMER",
            customerStatus: "ACTIVE",
            orders: {
              some: {
                placedAt: {
                  gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                },
              },
            },
          },
        }),
        // Members = active subscription
        this.db.user.count({
          where: {
            role: "CUSTOMER",
            subscription: { is: { status: "ACTIVE" } },
          },
        }),
      ]);

    return {
      totalCustomers: { value: totalCustomers, changePercent: 0 },
      newCustomers: { value: newCustomers, changePercent: 0 },
      activeCustomers: { value: activeCustomers, changePercent: 0 },
      members: { value: members, changePercent: 0 },
    };
  }

  // ─── List ──────────────────────────────────────────────────
  async list(dto: ListAdminCustomersDto) {
    const page = dto.page ?? 1;
    const perPage = dto.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const range = this.periodRange(dto.period);

    const where: Prisma.UserWhereInput = {
      role: "CUSTOMER",
    };

    // Status filter:
    //   SUSPENDED → persisted
    //   INACTIVE → derived (no orders in 90 days) — but we can narrow with SQL
    //   ACTIVE → persisted ACTIVE and has ordered in last 90 days
    if (dto.status === "SUSPENDED") {
      where.customerStatus = "SUSPENDED";
    } else if (dto.status === "INACTIVE") {
      where.customerStatus = "ACTIVE";
      where.NOT = {
        orders: {
          some: {
            placedAt: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            },
          },
        },
      };
    } else if (dto.status === "ACTIVE") {
      where.customerStatus = "ACTIVE";
      where.orders = {
        some: {
          placedAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
      };
    }

    if (dto.isMember === true) {
      where.subscription = { is: { status: "ACTIVE" } };
    } else if (dto.isMember === false) {
      where.NOT = {
        ...(where.NOT as object),
        subscription: { is: { status: "ACTIVE" } },
      } as any;
    }

    if (range.gte || range.lte) {
      where.createdAt = range;
    }

    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: "insensitive" } },
        { email: { contains: dto.search, mode: "insensitive" } },
        { phone: { contains: dto.search, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await this.db.$transaction([
      this.db.user.count({ where }),
      this.db.user.findMany({
        where,
        include: {
          orders: { select: { id: true, total: true, placedAt: true } },
          subscription: { include: { plan: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: perPage,
      }),
    ]);

    return {
      items: rows.map(serializeCustomerSummary),
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      page,
    };
  }

  // ─── Detail ────────────────────────────────────────────────
  async findOne(id: string) {
    const user = await this.db.user.findFirst({
      where: { id, role: "CUSTOMER" },
      include: {
        orders: { select: { id: true, total: true, placedAt: true } },
        addresses: true,
        subscription: { include: { plan: true } },
        activities: {
          orderBy: { occurredAt: "desc" },
          take: 30,
        },
      },
    });
    if (!user) throw new NotFoundException("Customer not found");
    return serializeCustomerDetail(user);
  }

  // ─── Update status ─────────────────────────────────────────
  async updateStatus(id: string, dto: UpdateAdminCustomerStatusDto) {
    if (dto.status === "INACTIVE") {
      throw new BadRequestException(
        "INACTIVE is derived automatically and cannot be set manually",
      );
    }

    const user = await this.db.user.findFirst({
      where: { id, role: "CUSTOMER" },
    });
    if (!user) throw new NotFoundException("Customer not found");

    await this.db.user.update({
      where: { id },
      data: {
        customerStatus: dto.status,
        suspendedAt: dto.status === "SUSPENDED" ? new Date() : null,
      },
    });

    // Log the action so the activity feed reflects it
    await this.db.customerActivity.create({
      data: {
        userId: id,
        type: "OTHER",
        title:
          dto.status === "SUSPENDED"
            ? "Account suspended by staff"
            : "Account reactivated by staff",
      },
    });

    // Re-read for the drawer
    return this.findOne(id);
  }
}