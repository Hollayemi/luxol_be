import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PlaceOrderDto } from "./dto/place-order.dto.js";
import { ListOrdersDto } from "./dto/list-orders.dto.js";
import { CancelOrderDto } from "./dto/cancel-order.dto.js";
import { RateOrderDto } from "./dto/rate-order.dto.js";
import { RequestReturnDto } from "./dto/request-return.dto.js";
import {
  readTimeline,
  serializeOrderDetail,
  serializeOrderSummary,
  serializeOrderTracking,
  toFrontendStatus,
} from "./orders.serializer.js";
import { DatabaseService } from "../database/database.service.js";
import { PaystackService } from "../payments/paystack.service.js";
import { Prisma, PromotionStatus } from "../generated/prisma/client.js";
import { nextOrderNumber } from "../common/utils/code.util.js";
import { cartDiscount } from "../promotions/promotion-calc.js";
import { buildTimeline, canRate, closeTimeline, markRated } from "./order-timeline.js";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private db: DatabaseService,
    private paystack: PaystackService,
    private config: ConfigService,
  ) { }

  // ─── Place order ────────────────────────────────────────────

 async placeOrder(userId: string, dto: PlaceOrderDto) {
    if (!dto.items.length) throw new BadRequestException("Cart is empty");

    console.log("Placing order for user", userId, "with items:", dto);

    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");


    const isDelivery = dto.deliveryMethod === "DELIVERY" || dto.deliveryMethod === "delivery";
    let addressRow: Awaited<ReturnType<typeof this.db.address.findFirst>> = null;
    let deliveryAddressText = "";

    if (isDelivery) {
      if (!dto.addressId) throw new BadRequestException("addressId is required for delivery orders");
      addressRow = await this.db.address.findFirst({ where: { id: dto.addressId, userId } });
      if (!addressRow) throw new NotFoundException("Address not found");
      deliveryAddressText = `${addressRow.fullName}, ${addressRow.address}, ${addressRow.region}`;
    }

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.db.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    type LineItem = {
      productId: string;
      variantId: string | null;
      productName: string;
      variantLabel: string | null;
      image: string | null;
      unitLabel: string | null;
      unitPrice: Prisma.Decimal;
      quantity: number;
      lineTotal: Prisma.Decimal;
      categoryId: string;
    };

    const lineItems: LineItem[] = [];
    let subtotal = 0;

    for (const line of dto.items) {
      const product = byId.get(line.productId);
      if (!product || product.status !== "ACTIVE") {
        throw new BadRequestException(`Product "${line.productId}" is not available`);
      }

      let unitPrice = Number(product.unitPrice);
      let variantId: string | null = null;
      let variantLabel: string | null = null;
      let stock = product.stock;

      if (product.variantOption === "PARENT" && line.variant) {
        const variant =
          product.variants.find((v) => v.id === line.variant) ??
          product.variants.find((v) => v.label === line.variant);
        if (!variant) {
          throw new BadRequestException(`Variant "${line.variant}" not found for ${product.name}`);
        }
        variantId = variant.id;
        variantLabel = variant.label;
        unitPrice = Number(variant.unitPrice);
        stock = variant.stock;
      }

      if (stock < line.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name} (available: ${stock})`);
      }

      const lineTotal = unitPrice * line.quantity;
      subtotal += lineTotal;

      lineItems.push({
        productId: product.id,
        variantId,
        productName: product.name,
        variantLabel,
        image: product.images?.[0] ?? null,
        unitLabel: product.unitType,
        unitPrice: new Prisma.Decimal(unitPrice),
        quantity: line.quantity,
        lineTotal: new Prisma.Decimal(lineTotal),
        categoryId: product.categoryId,
      });
    }

    const now = new Date();

    // ── 4. Coupon code promo (only when the customer supplies a code) ──
    let promo: any = null;
    let couponDiscount = 0;
    const couponCoversLines = new Set<number>();

    if (dto.promoCode) {
      promo = await this.db.promotion.findFirst({
        where: {
          code: dto.promoCode.toUpperCase(),
          status: PromotionStatus.ACTIVE,
          startAt: { lte: now },
          OR: [{ endAt: null }, { endAt: { gte: now } }],
        },
      });

      if (!promo) throw new BadRequestException("Invalid or expired promo code");
      if (promo.usageLimit != null && (promo.usedCount ?? 0) >= promo.usageLimit) {
        throw new BadRequestException("Promo code usage limit reached");
      }
      if (promo.minimumOrderAmount != null && subtotal < Number(promo.minimumOrderAmount)) {
        throw new BadRequestException(
          `Minimum order of ₦${Number(promo.minimumOrderAmount).toLocaleString()} required for this promo`,
        );
      }

      if (promo.appliesTo === "ALL_ORDERS") {
        lineItems.forEach((_, i) => couponCoversLines.add(i));
      } else if (promo.appliesTo === "CATEGORY") {
        lineItems.forEach((li, i) => {
          if (li.categoryId === promo.categoryId) couponCoversLines.add(i);
        });
      } else if (promo.appliesTo === "SPECIFIC_PRODUCTS") {
        const allowed = new Set<string>(promo.productIds);
        lineItems.forEach((li, i) => {
          if (allowed.has(li.productId)) couponCoversLines.add(i);
        });
      }

      if (couponCoversLines.size === 0) {
        throw new BadRequestException("This promo does not apply to any items in your cart");
      }

      const eligibleSubtotal = [...couponCoversLines]
        .reduce((sum, i) => sum + Number(lineItems[i].lineTotal), 0);

      if (promo.discountType === "PERCENTAGE") {
        couponDiscount = (eligibleSubtotal * Number(promo.discountValue)) / 100;
        if (promo.maximumDiscount != null) {
          couponDiscount = Math.min(couponDiscount, Number(promo.maximumDiscount));
        }
      } else if (promo.discountType === "FIXED_AMOUNT") {
        couponDiscount = Math.min(Number(promo.discountValue), eligibleSubtotal);
      } else if (promo.discountType === "FREE_DELIVERY") {
        if (!isDelivery) {
          throw new BadRequestException("This promo is for delivery orders only");
        }
      }
    }

    // ── 5. Auto-applied DISCOUNT_DEAL promos (per line) ──
    const autoPromos = await this.db.promotion.findMany({
      where: {
        type: "DISCOUNT_DEAL",
        status: "ACTIVE",
        startAt: { lte: now },
        OR: [{ endAt: null }, { endAt: { gte: now } }],
      },
      include: { productLinks: true },
    });

    type LineAuto = {
      promoId: string;
      discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_DELIVERY";
      discountValue: number;
      maximumDiscount: number | null;
      discount: number;
      deliveryWaived: boolean;
    };

    const lineAuto: Array<LineAuto | null> = lineItems.map((li) => {
      const candidates = autoPromos.filter((p) => {
        if (p.usageLimit != null && (p.usedCount ?? 0) >= p.usageLimit) return false;
        if (p.appliesTo === "ALL_ORDERS") return true;
        if (p.appliesTo === "CATEGORY") return p.categoryId === li.categoryId;
        if (p.appliesTo === "SPECIFIC_PRODUCTS") {
          return p.productIds.some((pl) => pl === li.productId);
        }
        return false;
      });


      if (candidates.length === 0) return null;

      const lineTotal = Number(li.lineTotal);
      const evaluated = candidates.map((p) => {
        let disc = 0;
        let waived = false;

        if (p.discountType === "PERCENTAGE") {
          disc = (lineTotal * Number(p.discountValue)) / 100;
          if (p.maximumDiscount != null) disc = Math.min(disc, Number(p.maximumDiscount));
        } else if (p.discountType === "FIXED_AMOUNT") {
          disc = Math.min(Number(p.discountValue), lineTotal);
        } else if (p.discountType === "FREE_DELIVERY") {
          waived = true;
        }

        return {
          promoId: p.id,
          discountType: p.discountType as LineAuto["discountType"],
          discountValue: Number(p.discountValue),
          maximumDiscount: p.maximumDiscount != null ? Number(p.maximumDiscount) : null,
          discount: disc,
          deliveryWaived: waived,
        };
      });

      evaluated.sort((a, b) => b.discount - a.discount);
      return evaluated[0];
    });


    // Combine — coupon wins on its lines, auto fills the rest
    let autoDiscount = 0;
    let deliveryWaived = false;


    lineItems.forEach((_, i) => {
      if (couponCoversLines.has(i)) return;
      const auto = lineAuto[i];
      if (!auto) return;
      autoDiscount += auto.discount;
      if (auto.deliveryWaived) deliveryWaived = true;
    });

    // Coupon FREE_DELIVERY also waives delivery
    if (promo?.discountType === "FREE_DELIVERY" && couponCoversLines.size > 0) {
      deliveryWaived = true;
    }

    const roundedDiscount = Math.round((couponDiscount + autoDiscount) * 100) / 100;

    // ── 6. Delivery + totals ──
    const FLAT_DELIVERY = Number(this.config.get("DELIVERY_FEE") ?? 2500);
    console.log("FLAT_DELIVERY", FLAT_DELIVERY)
    let deliveryFee = isDelivery ? FLAT_DELIVERY : 0;

    console.log("Delivery waived?", deliveryWaived, "Delivery fee before:", deliveryFee);

    if (deliveryWaived) deliveryFee = 0;

    const total = Math.max(0, subtotal - roundedDiscount + deliveryFee);

    // ── 7. Order number ──
    const orderNumber = await nextOrderNumber(this.db);

    // ── 8. Transaction ──
    const order = await this.db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId,
          addressId: addressRow?.id ?? null,
          promoCodeId: promo?.id ?? null,
          subtotal: new Prisma.Decimal(subtotal),
          discount: new Prisma.Decimal(roundedDiscount),
          deliveryFee: new Prisma.Decimal(deliveryFee),
          total: new Prisma.Decimal(total),
          status: "PENDING",
          type: "SHOP",
          deliveryType: isDelivery ? "DELIVERY" : "PICKUP",
          receiverName: addressRow?.fullName ?? user.name,
          receiverPhone: String(dto.phone),
          contactEmail: user.email,
          deliveryAddress: deliveryAddressText || null,
          timeline: buildTimeline() as unknown as Prisma.InputJsonValue,
          items: { create: lineItems.map(({ categoryId, ...rest }) => rest) },
        },
        include: {
          items: true,
          rating: true,
          returnRequests: { orderBy: { requestedAt: "desc" }, take: 1 },
        },
      });

      // Stock decrements + stock movements
      for (const line of lineItems) {
        if (line.variantId) {
          await tx.productVariant.update({
            where: { id: line.variantId },
            data: { stock: { decrement: line.quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: line.productId },
            data: { stock: { decrement: line.quantity } },
          });
        }
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            delta: -line.quantity,
            reason: "order",
            reference: created.id,
          },
        });
      }

      // Increment usedCount / aggregates on every promo that actually applied
      const promosUsed = new Map<string, number>();

      if (promo && (couponDiscount > 0 || promo.discountType === "FREE_DELIVERY")) {
        promosUsed.set(promo.id, couponDiscount);
      }

      lineItems.forEach((_, i) => {
        if (couponCoversLines.has(i)) return;
        const auto = lineAuto[i];
        if (!auto) return;
        if (auto.discount <= 0 && !auto.deliveryWaived) return;
        promosUsed.set(auto.promoId, (promosUsed.get(auto.promoId) ?? 0) + auto.discount);
      });

      for (const [promoId, contribution] of promosUsed) {
        await tx.promotion.update({
          where: { id: promoId },
          data: {
            usedCount: { increment: 1 },
            totalDiscountGiven: { increment: new Prisma.Decimal(contribution.toFixed(2)) },
            totalOrdersAffected: { increment: 1 },
            totalSalesMade: { increment: new Prisma.Decimal(total.toFixed(2)) },
          },
        });
      }

      const cart = await tx.cart.findUnique({
        where: { userId: userId  },
      });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

      return created;
    });

    // ── 9. Payment init ──
    const reference = `${orderNumber}-${Date.now()}`;
    const amountKobo = Math.round(total * 100);

    let init;
    try {
      init = await this.paystack.initialize({
        email: user.email,
        amountKobo,
        reference,
        callbackUrl: `${this.config.get("API_URL")}/payments/verify?orderId=${order.id}`,
        metadata: { orderId: order.id, orderNumber, userId },
      });
    } catch (err: any) {
      this.logger.error(`Paystack init failed: ${err.message}`);
      throw new BadRequestException("Could not start payment. Please try again.");
    }

    // ── 10. Payment row ──
    await this.db.payment.create({
      data: {
        orderId: order.id,
        userId,
        provider: "PAYSTACK",
        providerRef: init.reference,
        amount: new Prisma.Decimal(total),
        currency: "NGN",
        status: "PENDING",
        metadata: {
          orderNumber,
          amountKobo,
          discount: roundedDiscount,
          couponDiscount,
          autoDiscount,
          deliveryFee,
          subtotal,
        },
      },
    });

    return {
      id: order.id,
      orderNumber,
      subtotal,
      discount: roundedDiscount,
      discountBreakdown: {
        coupon: Math.round(couponDiscount * 100) / 100,
        auto: Math.round(autoDiscount * 100) / 100,
        deliveryWaived,
      },
      deliveryFee,
      total,
      payment: {
        reference: init.reference,
        authorizationUrl: init.authorizationUrl,
        amount: total,
        currency: "NGN",
      },
    };
  }

  // ─── Verify payment (called on redirect back) ──────────────

  async verifyPayment(userId: string, reference: string) {
    const payment = await this.db.payment.findUnique({
      where: { providerRef: reference },
      include: { order: true },
    });

    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.userId !== userId) {
      throw new ForbiddenException("Not your payment");
    }
    if (payment.status === "SUCCESS") {
      return { status: "SUCCESS", orderId: payment.orderId };
    }

    const result = await this.paystack.verify(reference);

    if (result.status === "success") {
      await this.db.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "SUCCESS",
            channel: result.channel,
            paidAt: result.paidAt ? new Date(result.paidAt) : new Date(),
          },
        });
        await tx.order.update({
          where: { id: payment.orderId! },
          data: { status: "PENDING" },
        });
        // await advanceTrack(tx, payment.orderId!, "PAYMENT");
      });

      return { status: "SUCCESS", orderId: payment.orderId };
    }

    if (result.status === "failed" || result.status === "abandoned") {
      await this.db.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failureReason: result.raw?.gateway_response ?? result.status,
        },
      });
    }

    return { status: result.status.toUpperCase(), orderId: payment.orderId };
  }

  // ─── Webhook handler (called by Paystack) ──────────────────

  async handleWebhook(event: any) {
    this.logger.log(`Paystack webhook: ${event.event}`);

    if (event.event !== "charge.success") return;

    const reference: string = event.data.reference;
    const payment = await this.db.payment.findUnique({
      where: { providerRef: reference },
    });
    if (!payment || payment.status === "SUCCESS") return;

    const paidAt = event.data.paid_at
      ? new Date(event.data.paid_at)
      : new Date();

    await this.db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCESS",
          channel: event.data.channel,
          paidAt,
        },
      });
      await tx.order.update({
        where: { id: payment.orderId! },
        data: { status: "PENDING" },
      });
    });
  }

  // ─── List ───────────────────────────────────────────────────

  async list(userId: string, dto: ListOrdersDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const skip = (page - 1) * pageSize;


    const where: Prisma.OrderWhereInput = { userId };

    if (dto.tab === "cancelled") {
      where.status = { in: ["CANCELLED", "RETURNED", "REFUNDED"] };
    } else if (dto.tab === "orders") {
      where.status = { in: ["PENDING", "DELIVERED", "OUT_FOR_DELIVERY", "PROCESSING"] };
    } else if (dto.status?.length) {
      where.status = { in: mapFrontendStatuses(dto.status) as any };
    }

    const [total, rows] = await this.db.$transaction([
      this.db.order.count({ where }),
      this.db.order.findMany({
        where,
        include: {
          items: { select: { quantity: true, lineTotal: true } },
        },
        orderBy: { placedAt: "desc" },
        skip,
        take: pageSize,
      }),
    ], { maxWait: 10000 });

    return {
      orders: rows.map(serializeOrderSummary),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // ─── Detail ─────────────────────────────────────────────────

  private detailInclude = {
    items: true,
    rating: true,
    returnRequests: {
      orderBy: { requestedAt: "desc" as const },
      take: 1,
    },
  };

  async findOne(userId: string, id: string) {
    const order = await this.db.order.findFirst({
      where: { id, userId },
      include: this.detailInclude,
    });
    if (!order) throw new NotFoundException("Order not found");
    return serializeOrderDetail(order);
  }

  async tracking(userId: string, id: string) {
    const order = await this.db.order.findFirst({
      where: { id, userId },
      include: {
        items: true,
        payments: true,
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    return serializeOrderTracking(order);
  }
  // ─── Cancel ─────────────────────────────────────────────────

  async cancel(userId: string, id: string, dto: CancelOrderDto) {
    const order = await this.db.order.findFirst({
      where: { id, userId },
      include: this.detailInclude, // make sure this no longer includes trackSteps
    });
    if (!order) throw new NotFoundException("Order not found");

    if (order.status !== "PENDING") {
      throw new BadRequestException(
        `Cannot cancel an order that is ${toFrontendStatus(order.status)}`,
      );
    }

    // Refuse to cancel once it's shipped — read from the timeline column
    const timeline = readTimeline(order.timeline);
    const shipped = timeline.some(
      (s) => s.stepId === "OUT_FOR_DELIVERY" && s.state === "DONE",
    );
    if (shipped) {
      throw new BadRequestException(
        "Order already out for delivery and cannot be cancelled",
      );
    }

    const updated = await this.db.$transaction(async (tx) => {
      // Restock
      for (const item of order.items) {
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
            reason: "cancel",
            reference: id,
          },
        });
      }

      // Close the timeline and stamp the cancellation
      const newTimeline = closeTimeline(
        timeline,
        `Order cancelled: ${dto.reason}`,
      );

      return tx.order.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: dto.reason,
          timeline: newTimeline as unknown as Prisma.InputJsonValue,
        },
        include: this.detailInclude,
      });
    });

    return serializeOrderDetail(updated);
  }

  // ─── Rate ───────────────────────────────────────────────────

  async rate(userId: string, id: string, dto: RateOrderDto) {
    const order = await this.db.order.findFirst({
      where: { id, userId },
      include: { rating: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== "DELIVERED") {
      throw new BadRequestException("You can only rate completed orders");
    }
    if (order.rating) {
      throw new BadRequestException("This order has already been rated");
    }

    const timeline = readTimeline(order.timeline);
    if (!canRate(timeline)) {
      throw new BadRequestException("This order cannot be rated yet");
    }

    const newTimeline = markRated(timeline);

    const [created] = await this.db.$transaction([
      this.db.orderRating.create({
        data: {
          orderId: id,
          userId,
          stars: dto.stars,
          comment: dto.comment,
        },
      }),
      this.db.order.update({
        where: { id },
        data: { timeline: newTimeline as unknown as Prisma.InputJsonValue },
      }),
    ]);

    return {
      stars: created.stars,
      comment: created.comment ?? undefined,
      submittedAt: created.submittedAt.toISOString(),
    };
  }

  // ─── Return ─────────────────────────────────────────────────

  async requestReturn(userId: string, id: string, dto: RequestReturnDto) {
    const order = await this.db.order.findFirst({
      where: { id, userId },
      include: { items: true, returnRequests: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== "DELIVERED") {
      throw new BadRequestException("Only completed orders can be returned");
    }
    if (order.returnRequests.length > 0) {
      throw new BadRequestException("A return has already been requested");
    }

    // Validate itemIds if present
    if (dto.itemIds?.length) {
      const valid = new Set(order.items.map((i) => i.id));
      const bad = dto.itemIds.filter((x) => !valid.has(x));
      if (bad.length) {
        throw new BadRequestException(
          `Invalid itemIds: ${bad.join(", ")}`,
        );
      }
    }

    // Refund amount: sum of selected lines (or full order)
    const selected = dto.itemIds?.length
      ? order.items.filter((i) => dto.itemIds!.includes(i.id))
      : order.items;
    const refundAmount = selected.reduce(
      (sum, i) => sum + Number(i.lineTotal),
      0,
    );

    const created = await this.db.returnRequest.create({
      data: {
        orderId: id,
        userId,
        status: "PENDING_REVIEW",
        reason: dto.reason,
        itemIds: dto.itemIds ?? [],
        refundAmount: new Prisma.Decimal(refundAmount),
      },
    });

    return {
      returnId: created.id,
      status: created.status.toLowerCase(),
      requestedAt: created.requestedAt.toISOString(),
    };
  }

  // ─── Reorder ────────────────────────────────────────────────

  async reorder(userId: string, id: string) {
    const order = await this.db.order.findFirst({
      where: { id, userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");

    const productIds = [...new Set(order.items.map((i) => i.productId))];
    const products = await this.db.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    // Ensure cart exists
    let cart = await this.db.cart.findUnique({ where: { userId } });
    if (!cart) cart = await this.db.cart.create({ data: { userId } });

    const added: string[] = [];
    const unavailable: string[] = [];

    await this.db.$transaction(async (tx) => {
      for (const line of order.items) {
        const product = byId.get(line.productId);
        if (!product || product.status !== "ACTIVE") {
          unavailable.push(line.id);
          continue;
        }

        let stock = product.stock;
        if (line.variantId) {
          const v = product.variants.find((x) => x.id === line.variantId);
          if (!v) {
            unavailable.push(line.id);
            continue;
          }
          stock = v.stock;
        }

        if (stock < line.quantity) {
          unavailable.push(line.id);
          continue;
        }

        const existing = await tx.cartItem.findFirst({
          where: {
            cartId: cart!.id,
            productId: line.productId,
            variantId: line.variantId,
          },
        });

        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + line.quantity },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: cart!.id,
              productId: line.productId,
              variantId: line.variantId,
              quantity: line.quantity,
            },
          });
        }
        added.push(line.id);
      }
    });

    return {
      cartItemsAdded: added.length,
      unavailableItemIds: unavailable,
    };
  }
}

function mapFrontendStatuses(fe: string[]): string[] {
  const map: Record<string, string> = {
    "in-progress": "IN_PROGRESS",
    completed: "COMPLETED",
    cancelled: "CANCELLED",
    returned: "RETURNED",
  };
  return fe.map((s) => map[s] ?? s);
}