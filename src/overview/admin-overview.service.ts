
import { Injectable } from "@nestjs/common";
import {
  currentWeekRange,
  periodRange,
  previousWeekRange,
  toDateKey,
} from "../common/utils/period.util.js";
import { DatabaseService } from "../database/database.service.js";
import { AdminOrderPeriod } from "../orders/dto/list-admin-orders.dto.js";
import { GetTopProductsDto } from "./dto/get-top-products.dto.js";

/** Multiplier for "running low" band — anything below this is running low. */
const RUNNING_LOW_MULTIPLIER = 2;

@Injectable()
export class AdminOverviewService {
  constructor(private db: DatabaseService) { }

  // ─── GET /admin/overview ────────────────────────────────────

  async summary() {
    const week = currentWeekRange();
    const lastWeek = previousWeekRange();
    const thisMonth = periodRange("this_month" as AdminOrderPeriod);
    const lastMonth = periodRange("last_month" as AdminOrderPeriod);

    const [
      weekDays,
      weekTotal,
      lastWeekTotal,
      completedOrdersThis,
      completedOrdersLast,
      totalSalesThis,
      totalSalesLast,
      activeCustomersThis,
      activeCustomersLast,
      activeMemberships,
      membershipStats,
      inventoryStats,
      meatBoxStats,
      orderStats, // <- NEW
      attention,
    ] = await Promise.all([
      this.weekBarData(week.start),
      this.db.order.count({
        where: { placedAt: { gte: week.start, lte: week.end } },
      }),
      this.db.order.count({
        where: { placedAt: { gte: lastWeek.start, lte: lastWeek.end } },
      }),

      this.db.order.count({
        where: { status: "DELIVERED", placedAt: thisMonth },
      }),
      this.db.order.count({
        where: { status: "DELIVERED", placedAt: lastMonth },
      }),

      this.db.order.aggregate({
        where: { status: "DELIVERED", placedAt: thisMonth },
        _sum: { total: true },
      }),
      this.db.order.aggregate({
        where: { status: "DELIVERED", placedAt: lastMonth },
        _sum: { total: true },
      }),

      this.db.user.count({
        where: {
          role: "CUSTOMER",
          orders: {
            some: {
              placedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
            },
          },
        },
      }),
      // Snapshot gap: cannot reconstruct last month's active customers without history
      Promise.resolve(0),

      this.db.subscription.count({ where: { status: "ACTIVE" } }),
      this.membershipCard(),
      this.inventoryCard(),
      this.meatBoxCard(),
      this.orderCard(), // <- NEW
      this.attentionList(),
    ]);

    return {
      week: {
        total: weekTotal,
        lastWeekTotal,
        rangeStart: toDateKey(week.start),
        rangeEnd: toDateKey(week.end),
        days: weekDays,
      },

      stats: {
        completedOrders: pctChange(completedOrdersThis, completedOrdersLast),
        totalSales: pctChange(
          Number(totalSalesThis._sum.total ?? 0),
          Number(totalSalesLast._sum.total ?? 0),
        ),
        activeCustomers: {
          value: activeCustomersThis,
          change: activeCustomersThis - activeCustomersLast,
        },
        activeMemberships: {
          value: activeMemberships,
          change: membershipStats.newMembers,
        },
      },

      modules: {
        meatBox: meatBoxStats,
        // Replacing freezerPlanner with live Order stats, mapped to the same shape
        order: orderStats,
        membership: membershipStats.card,
        inventory: inventoryStats,
      },

      attention,
    };
  }

  private async orderCard() {
    const now = new Date();

    const [activeOrders, processing, completed] = await Promise.all([
      // Active orders in the system
      this.db.order.count({
        where: { status: { in: ["PENDING", "PROCESSING", "OUT_FOR_DELIVERY"] } },
      }),
      // Currently processing
      this.db.order.count({ where: { status: "PROCESSING" } }),
      // No "completed" shop orders in your schema, so hardcode 0
       this.db.order.count({
        where: { status: { in: ["DELIVERED"] } },
      }),

    ]);

    return {
      activeOrders,
      processing,
      completed,
    };
  }

  // ─── Week bar chart (Mon–Sun) ───────────────────────────────

  private async weekBarData(monday: Date) {
    const days: Array<{ date: string; orders: number }> = [];
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }

    const counts = await this.db.order.groupBy({
      by: ["placedAt"],
      _count: { _all: true },
      where: {
        placedAt: {
          gte: dates[0],
          lte: (() => {
            const end = new Date(dates[6]);
            end.setHours(23, 59, 59, 999);
            return end;
          })(),
        },
      },
    });

    const byDay = new Map<string, number>();
    for (const c of counts) {
      const key = toDateKey(c.placedAt);
      byDay.set(key, (byDay.get(key) ?? 0) + c._count._all);
    }

    for (const d of dates) {
      const key = toDateKey(d);
      days.push({ date: key, orders: byDay.get(key) ?? 0 });
    }

    return days;
  }

  // ─── Membership card ────────────────────────────────────────

  private async membershipCard() {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thisMonth = periodRange("this_month" as AdminOrderPeriod);

    const [activeMembers, newMembers, renewals, activePlans] =
      await Promise.all([
        this.db.subscription.count({ where: { status: "ACTIVE" } }),
        this.db.subscription.count({
          where: { status: "ACTIVE", startedAt: thisMonth },
        }),
        this.db.subscription.count({
          where: {
            status: "ACTIVE",
            nextBillingAt: { gte: now, lte: in7 },
          },
        }),
        this.db.subscription.findMany({
          where: { status: "ACTIVE" },
          include: { plan: { select: { price: true, interval: true } } },
        }),
      ]);

    let mrr = 0;
    for (const s of activePlans) {
      const p = Number(s.plan.price);
      switch (s.plan.interval) {
        case "WEEK":
          mrr += p * 4.33;
          break;
        case "YEAR":
          mrr += p / 12;
          break;
        case "MONTH":
        default:
          mrr += p;
      }
    }

    return {
      card: {
        activeMembers,
        newMembers,
        renewals,
        expectedRecurringRevenue: Math.round(mrr),
      },
      newMembers,
    };
  }

  // ─── Meat Box Card ──────────────────────────────────────────

  private async meatBoxCard() {
    // Active = PENDING_PAYMENT + PROCESSING + OUT_FOR_DELIVERY
    const [activeOrders, pendingPayment, processing, nextDelivery] = await Promise.all([
      this.db.meatBoxOrder.count({
        where: { status: { in: ["PENDING_PAYMENT", "PROCESSING", "OUT_FOR_DELIVERY"] } },
      }),
      this.db.meatBoxOrder.count({ where: { status: "PENDING_PAYMENT" } }),
      this.db.meatBoxOrder.count({ where: { status: "PROCESSING" } }),
      this.db.meatBoxOrder.findFirst({
        where: { status: "PROCESSING", nextDeliveryAt: { gte: new Date() } },
        orderBy: { nextDeliveryAt: "asc" },
        select: { nextDeliveryAt: true, deliveryWindow: true },
      }),
    ]);

    let nextDeliveryWindow: string | null = null;
    if (nextDelivery) {
      // Format as "Today: 10:00 AM - 2:00 PM" or "Tomorrow: ..." if preferred
      const dateStr = nextDelivery.nextDeliveryAt!.toLocaleDateString("en-NG", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      nextDeliveryWindow = `${dateStr} · ${nextDelivery.deliveryWindow}`;
    }

    return {
      activeOrders,
      preparing: processing,
      awaitingWeight: pendingPayment, // Repurposed to mean "awaiting payment" in the new flow
      nextDeliveryWindow,
    };
  }

  // ─── Inventory card ─────────────────────────────────────────

  private async inventoryCard() {
    const products = await this.db.product.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, stock: true, reorderLevel: true },
    });

    let outOfStock = 0;
    let lowStock = 0;
    let runningLow = 0;

    for (const p of products) {
      if (p.stock <= 0) outOfStock++;
      else if (p.stock <= p.reorderLevel) lowStock++;
      else if (p.stock <= p.reorderLevel * RUNNING_LOW_MULTIPLIER) runningLow++;
    }

    return {
      lowStock,
      outOfStock,
      runningLow,
      immediateAttention: outOfStock + lowStock,
    };
  }

  // ─── Needs your attention ───────────────────────────────────

  private async attentionList(limit = 10) {
    const items: Array<{
      id: string;
      reference: string;
      customer: { id: string; fullName: string; avatar: string | null; email: string };
      kind: "SHOP" | "MEAT_BOX" | "FREEZER_PLANNER" | "MEMBERSHIP";
      amount: number | null;
      status: "AWAITING_WEIGHT" | "PAYMENT_ISSUE" | "PROCESSING" | "PENDING";
      createdAt: string;
      _sortKey: number;
    }> = [];

    // 1. Shop Orders (pending, processing, failed payment)
    const pendingOrders = await this.db.order.findMany({
      where: {
        OR: [
          { status: "PENDING" },
          { status: "PROCESSING" },
          { payments: { some: { status: "FAILED" } } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, image: true, email: true } },
        payments: { select: { status: true } },
      },
      orderBy: { placedAt: "desc" },
      take: limit * 2,
    });

    for (const o of pendingOrders) {
      const hasFailedPayment = o.payments.some((p) => p.status === "FAILED");
      const status = hasFailedPayment
        ? "PAYMENT_ISSUE"
        : o.status === "PENDING"
          ? "PENDING"
          : "PROCESSING";

      items.push({
        id: o.id,
        reference: `#${o.orderNumber}`,
        customer: {
          id: o.user.id,
          fullName: o.user.name,
          avatar: o.user.image ?? null,
          email: o.user.email,
        },
        kind: "SHOP",
        amount: Number(o.total),
        status,
        createdAt: o.placedAt.toISOString(),
        _sortKey: hasFailedPayment ? 0 : o.status === "PENDING" ? 1 : 2,
      });
    }

    // 2. Meat Box Orders (pending payment, processing)
    const meatBoxOrders = await this.db.meatBoxOrder.findMany({
      where: {
        OR: [
          { status: "PENDING_PAYMENT" },
          { status: "PROCESSING" },
        ],
      },
      include: {
        user: { select: { id: true, name: true, image: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    for (const o of meatBoxOrders) {
      items.push({
        id: o.id,
        reference: `#${o.code}`,
        customer: {
          id: o.user.id,
          fullName: o.user.name,
          avatar: o.user.image ?? null,
          email: o.user.email,
        },
        kind: "MEAT_BOX",
        amount: Number(o.total),
        status: o.status === "PENDING_PAYMENT" ? "PENDING" : "PROCESSING",
        createdAt: o.createdAt.toISOString(),
        _sortKey: o.status === "PENDING_PAYMENT" ? 1 : 2,
      });
    }

    // 3. Memberships (past-due / paused-too-long)
    const attentionSubs = await this.db.subscription.findMany({
      where: {
        OR: [
          { status: "PAUSED" },
          { status: "ACTIVE", payments: { some: { status: "FAILED" } } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, image: true, email: true } },
        plan: { select: { name: true, price: true } },
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    });

    for (const s of attentionSubs) {
      items.push({
        id: s.id,
        reference: `${s.plan.name} Subscription`,
        customer: {
          id: s.user.id,
          fullName: s.user.name,
          avatar: s.user.image ?? null,
          email: s.user.email,
        },
        kind: "MEMBERSHIP",
        amount: Number(s.plan.price),
        status: "PROCESSING",
        createdAt: s.updatedAt.toISOString(),
        _sortKey: 3,
      });
    }

    // Sort by urgency, then by newest
    items.sort((a, b) => {
      if (a._sortKey !== b._sortKey) return a._sortKey - b._sortKey;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return items.slice(0, limit).map(({ _sortKey, ...rest }) => rest);
  }

  // ─── GET /admin/overview/top-products ──────────────────────

  async topProducts(dto: GetTopProductsDto) {
    const limit = dto.limit ?? 4;
    const range = periodRange(dto.period);

    const grouped = await this.db.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      where: range.gte
        ? { order: { placedAt: { gte: range.gte, lte: range.lte } } }
        : undefined,
      orderBy: { _sum: { quantity: "desc" } },
      take: limit,
    });

    if (grouped.length === 0) {
      const fallback = await this.db.product.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return {
        items: fallback.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          image: p.images?.[0] || null,
          totalOrders: 0,
          periodOrders: 0,
          price: Number(p.unitPrice),
        })),
      };
    }

    const productIds = grouped.map((g) => g.productId);

    const [products, allTimeSums] = await Promise.all([
      this.db.product.findMany({
        where: { id: { in: productIds } },
        // select: { id: true, name: true, sku: true, image: true, unitPrice: true },
      }),
      this.db.orderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
        where: { productId: { in: productIds } },
      }),
    ]);

    const productById = new Map(products.map((p) => [p.id, p]));
    const allTimeById = new Map(
      allTimeSums.map((a) => [a.productId, a._sum.quantity ?? 0]),
    );

    const items = grouped
      .map((g) => {
        const p = productById.get(g.productId);
        if (!p) return null;
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          image: p.images?.[0],
          totalOrders: allTimeById.get(p.id) ?? 0,
          periodOrders: g._sum.quantity ?? 0,
          price: Number(p.unitPrice),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return { items };
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function pctChange(current: number, previous: number) {
  if (previous === 0) {
    return { value: current, changePercent: current > 0 ? 100 : 0 };
  }
  const pct = ((current - previous) / previous) * 100;
  return { value: current, changePercent: Math.round(pct * 10) / 10 };
}