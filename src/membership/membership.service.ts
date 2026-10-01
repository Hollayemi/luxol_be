import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { DatabaseService } from "../database/database.service.js";
import { SubscribeDto } from "./dto/subscribe.dto.js";
import { ChangePlanDto } from "./dto/change-plan.dto.js";
import { UpdateMixDto } from "./dto/update-mix.dto.js";
import { CancelMembershipDto } from "./dto/cancel-membership.dto.js";
import {
  serializeMySubscription,
  serializePublicPlan,
  serializePublicProtein,
} from "./membership.serializer.js";
// import {
//   DELIVERY_DAYS,
//   DELIVERY_FREQUENCY_OPTIONS,
//   DELIVERY_WINDOWS,
// } from "../common/constants/membership.constants.js";
import { PaystackService } from "../payments/paystack.service.js";
import { ConfigService } from "@nestjs/config";
import { DELIVERY_DAYS, DELIVERY_FREQUENCY_OPTIONS, DELIVERY_WINDOWS } from "./dto/membership.constants.js";

@Injectable()
export class MembershipService {
  constructor(
    private db: DatabaseService,
    private paystack: PaystackService,
    private config: ConfigService,
  ) {}

  // ─── Catalogue (public) ─────────────────────────────────────

  async listPlans() {
    const rows = await this.db.membershipPlan.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    return { items: rows.map(serializePublicPlan) };
  }

  async getPlan(slugOrId: string) {
    const plan = await this.db.membershipPlan.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
        status: "ACTIVE",
      },
    });
    if (!plan) throw new NotFoundException("Plan not found");
    return serializePublicPlan(plan);
  }

  async listProteins() {
    const rows = await this.db.protein.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
    });
    return { items: rows.map(serializePublicProtein) };
  }


  options() {
    return {
      deliveryFrequencies: DELIVERY_FREQUENCY_OPTIONS.map((o) => ({
        id: o.id.toLowerCase(),
        label: o.label,
        deliveriesPerMonth: o.deliveriesPerMonth,
      })),
      deliveryDays: [...DELIVERY_DAYS],
      deliveryWindows: [...DELIVERY_WINDOWS],
    };
  }

  // ─── Subscribe ──────────────────────────────────────────────

  async subscribe(userId: string, dto: SubscribeDto) {
    // Validate mix sums to 100
    const total = dto.mix.reduce((s, m) => s + m.percentage, 0);
    if (total !== 100) {
      throw new BadRequestException(
        `Protein mix must add up to 100% (got ${total}%)`,
      );
    }

    // Validate plan exists and is active
    const plan = await this.db.membershipPlan.findFirst({
      where: { id: dto.planId, status: "ACTIVE" },
    });
    if (!plan) throw new NotFoundException("Plan not found or inactive");

    // Validate proteins exist and are active
    const proteinIds = [...new Set(dto.mix.map((m) => m.proteinId))];
    const proteins = await this.db.protein.findMany({
      where: { id: { in: proteinIds }, status: "ACTIVE" },
    });
    if (proteins.length !== proteinIds.length) {
      throw new BadRequestException("One or more proteins are unavailable");
    }

    // Refuse duplicate subscription
    const existing = await this.db.subscription.findUnique({
      where: { userId },
    });
    if (existing && existing.status === "ACTIVE") {
      throw new BadRequestException("You already have an active subscription");
    }
    if (existing && existing.status === "PENDING_PAYMENT") {
      // Restart payment for the pending one instead of creating a new one
      return this.startSubscriptionPayment(existing.id);
    }

    // Compute schedule
    const now = new Date();
    const nextDeliveryAt = this.nextDeliveryDate(now, dto.deliveryFrequency);
    const nextBillingAt = this.nextBillingDate(now, plan.interval);

    // Create subscription + mix in one transaction
    const subscription = await this.db.$transaction(async (tx) => {
      const sub = await tx.subscription.create({
        data: {
          userId,
          planId: plan.id,
          status: "PENDING_PAYMENT",
          deliveryFrequency: dto.deliveryFrequency.toUpperCase() as any,
          deliveryDay: dto.deliveryDay,
          deliveryWindow: dto.deliveryWindow,
          addressId: dto.addressId,
          nextDeliveryAt,
          nextBillingAt,
          mix: {
            create: dto.mix.map((m) => ({
              proteinId: m.proteinId,
              percentage: m.percentage,
            })),
          },
        },
      });

      return sub;
    });

    return this.startSubscriptionPayment(subscription.id);
  }

  private async startSubscriptionPayment(subscriptionId: string) {
    const sub = await this.db.subscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { plan: true, user: true },
    });

    const reference = `SUB-${sub.id}-${Date.now()}`;
    const amountKobo = Math.round(Number(sub.plan.price) * 100);

    let init;
    try {
      init = await this.paystack.initialize({
        email: sub.user.email,
        amountKobo,
        reference,
        callbackUrl: `${this.config.get("API_URL")}/payments/verify?subscriptionId=${sub.id}`,
        metadata: {
          subscriptionId: sub.id,
          id: sub.id,
          userId: sub.userId,
          planId: sub.planId,
        },
      });
    } catch (err: any) {
      throw new BadRequestException("Could not start payment. Please try again.");
    }

    await this.db.payment.create({
      data: {
        userId: sub.userId,
        subscriptionId: sub.id,
        provider: "PAYSTACK",
        providerRef: init.reference,
        amount: new Prisma.Decimal(Number(sub.plan.price)),
        currency: "NGN",
        status: "PENDING",
        metadata: { subscriptionId: sub.id },
      },
    });

    return {
      subscriptionId: sub.id,
      payment: {
        authorizationUrl: init.authorizationUrl,
        reference: init.reference,
      },
    };
  }

  // ─── My subscription ────────────────────────────────────────

  async getMine(userId: string) {
    const sub = await this.db.subscription.findUnique({
      where: { userId },
      include: {
        plan: true,
        mix: { include: { protein: true } },
      },
    });

    if (!sub) return null;
    return serializeMySubscription(sub);
  }

  async pause(userId: string, id: string) {
    const sub = await this.requireOwned(userId, id);
    if (sub.status !== "ACTIVE") {
      throw new BadRequestException("Only active subscriptions can be paused");
    }

    const updated = await this.db.subscription.update({
      where: { id },
      data: {
        status: "PAUSED",
        pausedAt: new Date(),
        nextDeliveryAt: null,
      },
      include: { plan: true, mix: { include: { protein: true } } },
    });

    return serializeMySubscription(updated);
  }

  async resume(userId: string, id: string) {
    const sub = await this.requireOwned(userId, id);
    if (sub.status !== "PAUSED") {
      throw new BadRequestException("Only paused subscriptions can be resumed");
    }

    const now = new Date();
    const nextDeliveryAt = this.nextDeliveryDate(now, sub.deliveryFrequency);
    const nextBillingAt = this.nextBillingDate(now, sub.plan.interval);

    const updated = await this.db.subscription.update({
      where: { id },
      data: {
        status: "ACTIVE",
        pausedAt: null,
        nextDeliveryAt,
        nextBillingAt,
      },
      include: { plan: true, mix: { include: { protein: true } } },
    });

    return serializeMySubscription(updated);
  }

  async skipDelivery(userId: string, id: string) {
    const sub = await this.requireOwned(userId, id);
    if (sub.status !== "ACTIVE") {
      throw new BadRequestException("Only active subscriptions can skip deliveries");
    }

    const now = new Date();
    const nextAfterSkip = this.nextDeliveryDate(
      this.nextDeliveryDate(now, sub.deliveryFrequency),
      sub.deliveryFrequency,
    );

    const updated = await this.db.subscription.update({
      where: { id },
      data: {
        nextDeliveryAt: nextAfterSkip,
        skipUntil: this.nextDeliveryDate(now, sub.deliveryFrequency),
      },
      include: { plan: true, mix: { include: { protein: true } } },
    });

    return serializeMySubscription(updated);
  }

  async changePlan(userId: string, id: string, dto: ChangePlanDto) {
    const sub = await this.requireOwned(userId, id);

    const newPlan = await this.db.membershipPlan.findFirst({
      where: { id: dto.planId, status: "ACTIVE" },
    });
    if (!newPlan) throw new NotFoundException("Plan not found or inactive");
    if (newPlan.id === sub.planId) {
      throw new BadRequestException("You are already on this plan");
    }

    // Upgrades/downgrades apply at next billing cycle
    const updated = await this.db.subscription.update({
      where: { id },
      data: { planId: newPlan.id },
      include: { plan: true, mix: { include: { protein: true } } },
    });

    return serializeMySubscription(updated);
  }

  async updateMix(userId: string, id: string, dto: UpdateMixDto) {
    const sub = await this.requireOwned(userId, id);

    const total = dto.mix.reduce((s, m) => s + m.percentage, 0);
    if (total !== 100) {
      throw new BadRequestException(
        `Protein mix must add up to 100% (got ${total}%)`,
      );
    }

    const proteinIds = [...new Set(dto.mix.map((m) => m.proteinId))];
    const proteins = await this.db.protein.findMany({
      where: { id: { in: proteinIds }, status: "ACTIVE" },
    });
    if (proteins.length !== proteinIds.length) {
      throw new BadRequestException("One or more proteins are unavailable");
    }

    const updated = await this.db.$transaction(async (tx) => {
      await tx.proteinMixItem.deleteMany({ where: { subscriptionId: id } });
      await tx.proteinMixItem.createMany({
        data: dto.mix.map((m) => ({
          subscriptionId: id,
          proteinId: m.proteinId,
          percentage: m.percentage,
        })),
      });
      return tx.subscription.findUniqueOrThrow({
        where: { id },
        include: { plan: true, mix: { include: { protein: true } } },
      });
    });

    return serializeMySubscription(updated);
  }

  async cancel(userId: string, id: string, dto: CancelMembershipDto) {
    const sub = await this.requireOwned(userId, id);
    if (sub.status === "CANCELLED") {
      throw new BadRequestException("Subscription is already cancelled");
    }

    const updated = await this.db.subscription.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: dto.reason ?? null,
        nextDeliveryAt: null,
        nextBillingAt: null,
      },
      include: { plan: true, mix: { include: { protein: true } } },
    });

    return serializeMySubscription(updated);
  }

  // ─── Helpers ────────────────────────────────────────────────

  private async requireOwned(userId: string, id: string) {
    const sub = await this.db.subscription.findFirst({
      where: { id, userId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException("Subscription not found");
    return sub;
  }

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

  private nextBillingDate(from: Date, interval: string): Date {
    const d = new Date(from);
    switch (interval) {
      case "WEEK":
        d.setDate(d.getDate() + 7);
        break;
      case "YEAR":
        d.setFullYear(d.getFullYear() + 1);
        break;
      case "MONTH":
      default:
        d.setMonth(d.getMonth() + 1);
    }
    return d;
  }
}