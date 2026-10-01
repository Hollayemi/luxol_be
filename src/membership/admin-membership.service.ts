import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreatePlanDto } from "./dto/create-plan.dto.js";
import { UpdatePlanDto } from "./dto/update-plan.dto.js";
import { ListPlansDto } from "./dto/list-plans.dto.js";
import { ListSubscribersDto } from "./dto/list-subscribers.dto.js";
import { CreateProteinDto } from "./dto/create-protein.dto.js";
import { UpdateProteinDto } from "./dto/update-protein.dto.js";
import { ListProteinsDto } from "./dto/list-proteins.dto.js";
import {
  serializeAdminPlan,
  serializeAdminProtein,
  serializeAdminSubscriber,
} from "../membership/membership.serializer.js";
import { DatabaseService } from "../database/database.service.js";
import { slugify } from "../common/utils/slug.util.js";
import { Prisma } from "../generated/prisma/client.js";

@Injectable()
export class AdminMembershipService {
  constructor(
    private db: DatabaseService,
  ) {}

  // ─── Stats ──────────────────────────────────────────────────

  async stats() {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      activeMembers,
      upcomingDeliveries,
      renewalsDue,
      needsAttention,
    ] = await Promise.all([
      this.db.subscription.count({ where: { status: "ACTIVE" } }),

      this.db.subscription.count({
        where: {
          status: "ACTIVE",
          nextDeliveryAt: { gte: now, lte: in7Days },
        },
      }),

      this.db.subscription.count({
        where: {
          status: "ACTIVE",
          nextBillingAt: { gte: now, lte: in7Days },
        },
      }),

      this.db.subscription.count({
        where: {
          OR: [
            { status: "PENDING_PAYMENT" },
            { status: "PAUSED", pausedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
          ],
        },
      }),
    ]);

    // MRR: fetch active subscriptions with plans, sum in JS
    const activeSubs = await this.db.subscription.findMany({
      where: { status: "ACTIVE" },
      include: { plan: { select: { price: true, interval: true } } },
    });

    let mrr = 0;
    for (const s of activeSubs) {
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
      activeMembers: { value: activeMembers, changePercent: 0 },
      monthlyRecurringRevenue: { value: Math.round(mrr), changePercent: 0 },
      upcomingDeliveries: { value: upcomingDeliveries, change: 0 },
      renewalsDue: { value: renewalsDue, change: 0 },
      needsAttention: { value: needsAttention, change: 0 },
    };
  }

  // ─── Plans ──────────────────────────────────────────────────

  async listPlans(dto: ListPlansDto) {
    const where: Prisma.MembershipPlanWhereInput = {};
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: "insensitive" } },
        { slug: { contains: dto.search, mode: "insensitive" } },
      ];
    }

    const rows = await this.db.membershipPlan.findMany({
      where,
      include: { _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    });

    return { items: rows.map(serializeAdminPlan) };
  }

  async createPlan(dto: CreatePlanDto) {
    const slug = slugify(dto.name);
    const clash = await this.db.membershipPlan.findUnique({ where: { slug } });
    if (clash) throw new ConflictException("A plan with this name already exists");

    const created = await this.db.membershipPlan.create({
      data: {
        slug,
        name: dto.name,
        description: dto.description ?? null,
        price: new Prisma.Decimal(dto.price),
        interval: dto.interval,
        deliveryFrequency: dto.deliveryFrequency,
        supply: dto.supply ?? [],
        status: dto.status ?? "ACTIVE",
      },
      include: { _count: { select: { subscriptions: true } } },
    });

    return serializeAdminPlan(created);
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const existing = await this.db.membershipPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Plan not found");

    let slug: string | undefined;
    if (dto.name) {
      slug = slugify(dto.name);
      const clash = await this.db.membershipPlan.findFirst({
        where: { slug, NOT: { id } },
      });
      if (clash) throw new ConflictException("Plan name already in use");
    }

    const updated = await this.db.membershipPlan.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        slug: slug ?? undefined,
        description: dto.description === undefined ? undefined : dto.description,
        price: dto.price != null ? new Prisma.Decimal(dto.price) : undefined,
        interval: dto.interval ?? undefined,
        deliveryFrequency: dto.deliveryFrequency ?? undefined,
        supply: dto.supply ?? undefined,
        status: dto.status ?? undefined,
      },
      include: { _count: { select: { subscriptions: true } } },
    });

    return serializeAdminPlan(updated);
  }

  async deletePlan(id: string) {
    const plan = await this.db.membershipPlan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!plan) throw new NotFoundException("Plan not found");

    if (plan._count.subscriptions > 0) {
      throw new BadRequestException(
        `Cannot delete a plan with ${plan._count.subscriptions} subscription(s). Deactivate it instead.`,
      );
    }

    await this.db.membershipPlan.delete({ where: { id } });
    return { id };
  }

  // ─── Subscribers ────────────────────────────────────────────

  async listSubscribers(dto: ListSubscribersDto) {
    const page = dto.page ?? 1;
    const perPage = dto.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Prisma.SubscriptionWhereInput = {};
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { user: { name: { contains: dto.search, mode: "insensitive" } } },
        { plan: { name: { contains: dto.search, mode: "insensitive" } } },
      ];
    }

    const [total, rows] = await this.db.$transaction([
      this.db.subscription.count({ where }),
      this.db.subscription.findMany({
        where,
        include: {
          plan: true,
          user: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: perPage,
      }),
    ]);

    return {
      items: rows.map(serializeAdminSubscriber),
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      page,
    };
  }

  // ─── Proteins ───────────────────────────────────────────────

  async listProteins(dto: ListProteinsDto) {
    const where: Prisma.ProteinWhereInput = {};
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { label: { contains: dto.search, mode: "insensitive" } },
        { description: { contains: dto.search, mode: "insensitive" } },
      ];
    }

    const proteins = await this.db.protein.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
    });

    // % sold this month = sum of mix percentages across this protein
    // across all subscriptions, divided by total percentages across all proteins
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const grouped = await this.db.proteinMixItem.groupBy({
      by: ["proteinId"],
      _sum: { percentage: true },
      where: {
        subscription: { createdAt: { gte: monthStart } },
      },
    });

    const totalPct = grouped.reduce((sum, g) => sum + (g._sum.percentage ?? 0), 0);
    const byId = new Map(grouped.map((g) => [g.proteinId, g._sum.percentage ?? 0]));

    const items = proteins.map((p) => {
      const pct = byId.get(p.id) ?? 0;
      const share = totalPct > 0 ? (pct / totalPct) * 100 : 0;
      return serializeAdminProtein(p, share);
    });

    // Sort by % sold descending (backend default per your comment)
    items.sort((a, b) => b.soldPercentage - a.soldPercentage);

    return { items };
  }

  async createProtein(dto: CreateProteinDto, file?: Express.Multer.File) {
    const clash = await this.db.protein.findUnique({
      where: { label: dto.label },
    });
    const created = await this.db.protein.create({
      data: {
        ...dto,
        status: dto.status ?? "ACTIVE",
      },
    });

    return serializeAdminProtein(created, 0);
  }

  async updateProtein(
    id: string,
    dto: UpdateProteinDto,
  ) {
    const existing = await this.db.protein.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Protein not found");

    if (dto.label && dto.label !== existing.label) {
      const clash = await this.db.protein.findUnique({
        where: { label: dto.label },
      });
      if (clash) throw new ConflictException("Protein label already in use");
    }

    const updated = await this.db.protein.update({
      where: { id },
      data: {
        label: dto.label ?? undefined,
        description: dto.description ?? undefined,
        status: dto.status ?? undefined,
        image: dto.image ?? undefined ,
      },
    });

    // Reuse the same share calc as listProteins — extract to a helper if it grows
    const grouped = await this.db.proteinMixItem.groupBy({
      by: ["proteinId"],
      _sum: { percentage: true },
    });
    const totalPct = grouped.reduce((s, g) => s + (g._sum.percentage ?? 0), 0);
    const mine = grouped.find((g) => g.proteinId === id)?._sum.percentage ?? 0;
    const share = totalPct > 0 ? (mine / totalPct) * 100 : 0;

    return serializeAdminProtein(updated, share);
  }

  async deleteProtein(id: string) {
    const existing = await this.db.protein.findUnique({
      where: { id },
      include: { _count: { select: { mixItems: true } } },
    });
    if (!existing) throw new NotFoundException("Protein not found");

    if (existing._count.mixItems > 0) {
      throw new BadRequestException(
        `Cannot delete a protein used by ${existing._count.mixItems} subscription(s). Deactivate it instead.`,
      );
    }

    await this.db.protein.delete({ where: { id } });
    return { id };
  }
}