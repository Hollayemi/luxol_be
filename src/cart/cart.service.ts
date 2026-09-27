import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SyncCartDto } from "./dto/sync-cart.dto.js";
import { MergeCartDto } from "./dto/merge-cart.dto.js";
import { ValidatePromoDto } from "./dto/validate-promo.dto.js";
import { ValidateCartDto } from "./dto/validate-cart.dto.js";
import { DatabaseService } from "../database/database.service.js";
import { PromotionStatus } from "../generated/prisma/enums.js";
import { Prisma } from "../generated/prisma/client.js";

type ServerCartShape = {
  items: { productId: string; quantity: number; variant?: string }[];
  updatedAt: string;
};

@Injectable()
export class CartService {
  constructor(private db: DatabaseService) {}

  // ─── GET /cart ──────────────────────────────────────────────

  async getCart(userId: string): Promise<ServerCartShape> {
    const cart = await this.db.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      return {
        items: [],
        updatedAt: new Date().toISOString(),
      };
    }

    return this.serializeCart(cart);
  }

  // ─── PUT /cart ──────────────────────────────────────────────

  async syncCart(userId: string, dto: SyncCartDto): Promise<ServerCartShape> {

    const cart = await this.db.$transaction(async (tx) => {
      let userCart = await tx.cart.findUnique({ where: { userId } });

      if(!userCart){
        userCart = await tx.cart.create({
            data: {
              userId,
            },
          });
        }

      // Replace items wholesale — simpler, matches client behavior
      await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });

      if (dto.items.length) {
        // Validate products exist
        const productIds = [...new Set(dto.items.map((i) => i.productId))];
        const found = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true },
        });
        const foundIds = new Set(found.map((p) => p.id));
        const missing = productIds.filter((id) => !foundIds.has(id));
        if (missing.length) {
          throw new BadRequestException(
            `Unknown product ids: ${missing.join(", ")}`,
          );
        }

        await tx.cartItem.createMany({
          data: dto.items.map((i) => ({
            cartId: userCart.id,
            productId: i.productId,
            variantId: i.variant ?? null,
            quantity: i.quantity,
          })),
        });
      }

      return tx.cart.findUniqueOrThrow({
        where: { id: userCart.id },
        include: { items: true },
      });
    });

    return this.serializeCart(cart);
  }

  // ─── POST /cart/merge ───────────────────────────────────────

  async mergeCart(userId: string, dto: MergeCartDto): Promise<ServerCartShape> {
    // Fetch or create cart
    let cart = await this.db.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await this.db.cart.create({ data: { userId } });
    }

    // Validate product ids
    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const found = await this.db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((p) => p.id));

    // For each incoming item: add quantity to any existing matching row
    await this.db.$transaction(async (tx) => {
      for (const incoming of dto.items) {
        if (!foundIds.has(incoming.productId)) continue;

        const existing = await tx.cartItem.findFirst({
          where: {
            cartId: cart!.id,
            productId: incoming.productId,
            variantId: incoming.variant ?? null,
          },
        });

        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + incoming.quantity },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: cart!.id,
              productId: incoming.productId,
              variantId: incoming.variant ?? null,
              quantity: incoming.quantity,
            },
          });
        }
      }
    });

    const refreshed = await this.db.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: { items: true, promoCode: true },
    });

    return this.serializeCart(refreshed);
  }

  // ─── POST /promo-codes/validate ─────────────────────────────

  async validatePromo(dto: ValidatePromoDto) {
    const promo = await this.findActivePromoByCode(dto.code);
    if (!promo) {
      throw new NotFoundException("Promo code not found or expired");
    }
    if (
      promo.minimumOrderAmount != null &&
      dto.itemsTotal < Number(promo.minimumOrderAmount)
    ) {
      throw new BadRequestException(
        `Minimum order of ₦${Number(promo.minimumOrderAmount).toLocaleString()} required for this promo`,
      );
    }
    if (
      promo.usageLimit != null &&
      (promo.usedCount ?? 0) >= promo.usageLimit
    ) {
      throw new BadRequestException("Promo code usage limit reached");
    }

    // Compute the effective discount for this cart
    let percentOff = 0;
    let discountValue = 0;

    if (promo.discountType === "PERCENTAGE") {
      percentOff = Number(promo.discountValue);
      discountValue = (dto.itemsTotal * percentOff) / 100;
      if (promo.maximumDiscount != null) {
        discountValue = Math.min(discountValue, Number(promo.maximumDiscount));
      }
    } else if (promo.discountType === "FIXED_AMOUNT") {
      discountValue = Math.min(Number(promo.discountValue), dto.itemsTotal);
      percentOff =
        dto.itemsTotal > 0 ? (discountValue / dto.itemsTotal) * 100 : 0;
    } else if (promo.discountType === "FREE_DELIVERY") {
      percentOff = 0;
      discountValue = 0; // applied against delivery fee, not items
    }

    return {
      code: promo.code ?? dto.code.toUpperCase(),
      percentOff: Math.round(percentOff * 100) / 100,
    };
  }

  // ─── POST /cart/validate ────────────────────────────────────

  async validateCart(dto: ValidateCartDto) {
    const productIds = [...new Set(dto.items.map((i) => i.productId))];

    const products = await this.db.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const issues: Array<{
      productId: string;
      variant?: string;
      code: string;
      newPrice?: number;
      maxQuantity?: number;
      message: string;
    }> = [];

    // Client is expected to send variant as a *variant id* string here —
    // we resolve by id first, then by label as a fallback.
    for (const line of dto.items) {
      const product = byId.get(line.productId);

      if (!product || product.status !== "ACTIVE") {
        issues.push({
          productId: line.productId,
          variant: line.variant,
          code: "removed",
          message: "This product is no longer available.",
        });
        continue;
      }

      // Variant resolution
      let effectiveStock = product.stock;
      let effectivePrice = Number(product.unitPrice);

      if (product.variantOption === "PARENT" && line.variant) {
        const variant =
          product.variants.find((v) => v.id === line.variant) ??
          product.variants.find((v) => v.label === line.variant);

        if (!variant) {
          issues.push({
            productId: line.productId,
            variant: line.variant,
            code: "removed",
            message: "That variant is no longer available.",
          });
          continue;
        }
        effectiveStock = variant.stock;
        effectivePrice = Number(variant.unitPrice);
      }

      if (effectiveStock <= 0) {
        issues.push({
          productId: line.productId,
          variant: line.variant,
          code: "out_of_stock",
          message: "Out of stock.",
        });
        continue;
      }

      if (line.quantity > effectiveStock) {
        issues.push({
          productId: line.productId,
          variant: line.variant,
          code: "quantity_reduced",
          maxQuantity: effectiveStock,
          message: `Only ${effectiveStock} left in stock.`,
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────

  private async findActivePromoByCode(code: string) {
    const now = new Date();
    return this.db.promotion.findFirst({
      where: {
        code: code.toUpperCase(),
        status: PromotionStatus.ACTIVE,
        startAt: { lte: now },
        OR: [{ endAt: null }, { endAt: { gte: now } }],
      },
    });
  }

  private serializeCart(
    cart: Prisma.CartGetPayload<{
      include: { items: true };
    }>,
  ): ServerCartShape {
  
    return {
      items: cart.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        variant: i.variantId ?? undefined,
      })),
      // address: "", 
      updatedAt: cart.updatedAt.toISOString(),
    };
  }

  private computePercentOff(promo: {
    discountType: string;
    discountValue: Prisma.Decimal;
    maximumDiscount: Prisma.Decimal | null;
  }): number {
    if (promo.discountType === "PERCENTAGE") {
      return Number(promo.discountValue);
    }
    // For FIXED_AMOUNT / FREE_DELIVERY the actual % depends on the cart total.
    // We return 0 here and let the client compute the currency value in its
    // own cart summary using the promo code. The route that needs the real
    // number is /promo-codes/validate, which does compute it.
    return 0;
  }
}