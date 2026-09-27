import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreatePromotionDto } from "./dto/create-promotions.dto.js";
import { UpdatePromotionDto } from "./dto/update-promotion.dto.js";
import {
  serializePromotion,
  serializePromotionDetail,
} from "./promotions.serializer.js";
import { DatabaseService } from "../database/database.service.js";
import { PromotionStatus } from "../generated/prisma/enums.js";
import { Prisma } from "../generated/prisma/client.js";
import { ListPromotionsDto } from "./dto/list-promotion.dto.js";
import { generateCouponCode } from "../common/utils/code.util.js";

@Injectable()
export class PromotionsService {
  constructor(private db: DatabaseService) { }

  // ─── Internal helpers ───────────────────────────────────────

  /** Derive status from dates unless explicitly paused/inactive. */
  private resolveStatus(
    startAt: Date,
    endAt: Date | null,
    current: PromotionStatus,
  ): PromotionStatus {
    if (current === "PAUSED" || current === "INACTIVE") return current;
    const now = new Date();
    if (now < startAt) return "SCHEDULED";
    if (endAt && now > endAt) return "EXPIRED";
    return "ACTIVE";
  }

  /** Compute affectedCount from appliesTo. */
  private async computeAffectedCount(
    appliesTo: string,
    productIds: string[] | undefined,
    categoryId: string | undefined,
  ): Promise<number> {
    if (appliesTo === "all_orders") return 0; // "all" has no finite count
    if (appliesTo === "SPECIFIC_PRODUCTS") return productIds?.length ?? 0;
    if (appliesTo === "CATEGORY" && categoryId) {
      return this.db.product.count({
        where: { categoryId, isActive: true },
      });
    }
    return 0;
  }

  private include = {
    category: { select: { id: true, name: true } },
  } satisfies Prisma.PromotionInclude;

  // ─── Stats ──────────────────────────────────────────────────

  async stats() {
    const now = new Date();

    const [activeCount, scheduledCount, productsOnPromotion, promotionSales] =
      await Promise.all([
        this.db.promotion.count({
          where: {
            status: "ACTIVE",
            startAt: { lte: now },
            OR: [{ endAt: null }, { endAt: { gte: now } }],
          },
        }),
        this.db.promotion.count({
          where: { status: "SCHEDULED", startAt: { gt: now } },
        }),
        this.db.promotion.aggregate({
          _sum: { totalProductsAffected: true },
        }),
        this.db.promotion.aggregate({
          _sum: { totalSalesMade: true },
        }),
      ]);

    // Change % vs. previous 30-day window — plug in real math when you have history
    return {
      activePromotions: { value: activeCount, changePercent: 0 },
      scheduled: { value: scheduledCount, change: 0 },
      productsOnPromotion: {
        value: productsOnPromotion._sum.totalProductsAffected ?? 0,
        changePercent: 0,
      },
      promotionSales: {
        value: Number(promotionSales._sum.totalSalesMade ?? 0),
        change: 0,
      },
    };
  }

  // ─── List ───────────────────────────────────────────────────

  async list(dto: ListPromotionsDto) {
    const page = dto.page ?? 1;
    const perPage = dto.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Prisma.PromotionWhereInput = {};

    if (dto.type) where.type = dto.type;
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: "insensitive" } },
        { code: { contains: dto.search, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await this.db.$transaction([
      this.db.promotion.count({ where }),
      this.db.promotion.findMany({
        where,
        include: this.include,
        orderBy: { createdAt: "desc" },
        skip,
        take: perPage,
      }),
    ]);

    return {
      items: rows.map(serializePromotion),
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      page,
    };
  }

  // ─── Detail ─────────────────────────────────────────────────

  async findOne(id: string) {
    const promo = await this.db.promotion.findUnique({
      where: { id },
      include: this.include,
    });
    if (!promo) throw new NotFoundException("Promotion not found");

    // Pull affected products
    let productRows: any[] = [];

    if (promo.appliesTo === "SPECIFIC_PRODUCTS" && promo.productIds.length) {
      productRows = await this.db.product.findMany({
        where: { id: { in: promo.productIds } },
        include: { category: { select: { name: true } } },
      });
    } else if (promo.appliesTo === "CATEGORY" && promo.categoryId) {
      productRows = await this.db.product.findMany({
        where: { categoryId: promo.categoryId, isActive: true },
        include: { category: { select: { name: true } } },
      });
    }

    // Compute promoPrice per product (best-effort; adjust for your discount math)
    const products = productRows.map((p) => {
      const regular = Number(p.price);
      let promoPrice = regular;
      if (promo.discountType === "PERCENTAGE") {
        promoPrice = regular - (regular * Number(promo.discountValue)) / 100;
      } else if (promo.discountType === "FIXED_AMOUNT") {
        promoPrice = Math.max(0, regular - Number(promo.discountValue));
      } else if (promo.discountType === "FREE_DELIVERY") {
        promoPrice = regular; // no product discount
      }
      return {
        id: p.id,
        name: p.name,
        categoryName: p.category?.name ?? "",
        image: p.images?.[0]?.url ?? null,
        unit: p.unit ?? null,
        price: p.price,
        promoPrice: new Prisma.Decimal(promoPrice.toFixed(2)),
        unitsSold: 0, // wire to order-line aggregates later
      };
    });

    return serializePromotionDetail(promo, products);
  }

  // ─── Create ─────────────────────────────────────────────────

  async create(dto: CreatePromotionDto) {
    // Coupon codes must be unique
    // (you generate `code` elsewhere for coupon_code promos — see note below)
    const startAt = new Date(dto.startAt);
    const endAt = dto.endAt ? new Date(dto.endAt) : null;

    if (endAt && endAt <= startAt) {
      throw new BadRequestException("endAt must be after startAt");
    }

    const affectedCount = await this.computeAffectedCount(
      dto.appliesTo,
      dto.productIds,
      dto.categoryId,
    );

    const status = this.resolveStatus(startAt, endAt, "SCHEDULED");

    const code =
      dto.type === "COUPON_CODE"
        ? (dto.code ?? generateCouponCode(dto.name)).toUpperCase()
        : null;

    if (code) {
      const clash = await this.db.promotion.findUnique({ where: { code } });
      if (clash) throw new ConflictException("Promotion code already exists");
    }

    const created = await this.db.promotion.create({
      data: {
        name: dto.name,
        type: dto.type,
        code,
        discountType: dto.discountType,
        discountValue: new Prisma.Decimal(dto.discountValue),
        appliesTo: dto.appliesTo,
        categoryId: dto.categoryId ?? null,
        productIds: dto.productIds ?? [],
        affectedCount,
        minimumOrderAmount:
          dto.minimumOrderAmount != null
            ? new Prisma.Decimal(dto.minimumOrderAmount)
            : null,
        maximumDiscount:
          dto.maximumDiscount != null
            ? new Prisma.Decimal(dto.maximumDiscount)
            : null,
        usageLimit: dto.usageLimit ?? null,
        limitPerCustomer: dto.limitPerCustomer ?? null,
        startAt,
        endAt,
        status,
        totalProductsAffected: affectedCount,
      },
      include: this.include,
    });

    // If specific_products, persist the join rows too
    if (dto.appliesTo === "SPECIFIC_PRODUCTS" && dto.productIds?.length) {
      await this.db.promotionProductLink.createMany({
        data: dto.productIds.map((productId) => ({
          promotionId: created.id,
          productId,
        })),
        skipDuplicates: true,
      });
    }

    return serializePromotion(created);
  }

  // ─── Update ─────────────────────────────────────────────────

  async update(id: string, dto: UpdatePromotionDto) {
    const existing = await this.db.promotion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Promotion not found");

    const startAt = dto.startAt ? new Date(dto.startAt) : existing.startAt;
    const endAt =
      dto.endAt === undefined
        ? existing.endAt
        : dto.endAt === null
          ? null
          : new Date(dto.endAt);

    if (endAt && endAt <= startAt) {
      throw new BadRequestException("endAt must be after startAt");
    }

    const code =
      dto.type === "COUPON_CODE" && dto.code
        ? dto.code.toUpperCase()
        : undefined;
    if (code) {
      const clash = await this.db.promotion.findFirst({
        where: { code, NOT: { id } },
      });
      if (clash) throw new ConflictException("Promotion code already exists");
    }

    const appliesTo = dto.appliesTo ?? existing.appliesTo;
    const productIds = dto.productIds ?? existing.productIds;
    const categoryId = dto.categoryId ?? existing.categoryId ?? undefined;

    const affectedCount = await this.computeAffectedCount(
      appliesTo,
      productIds,
      categoryId,
    );

    const status = this.resolveStatus(startAt, endAt, existing.status);

    const updated = await this.db.promotion.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        type: dto.type ?? undefined,
        discountType: dto.discountType ?? undefined,
        discountValue:
          dto.discountValue != null
            ? new Prisma.Decimal(dto.discountValue)
            : undefined,
        appliesTo: dto.appliesTo ?? undefined,
        categoryId:
          dto.appliesTo === "ALL_ORDERS" || dto.appliesTo === "SPECIFIC_PRODUCTS"
            ? null
            : (dto.categoryId ?? undefined),
        productIds: dto.productIds ?? undefined,
        affectedCount,
        minimumOrderAmount:
          dto.minimumOrderAmount != null
            ? new Prisma.Decimal(dto.minimumOrderAmount)
            : undefined,
        maximumDiscount:
          dto.maximumDiscount != null
            ? new Prisma.Decimal(dto.maximumDiscount)
            : undefined,
        usageLimit: dto.usageLimit ?? undefined,
        limitPerCustomer: dto.limitPerCustomer ?? undefined,
        startAt: dto.startAt ? startAt : undefined,
        endAt: dto.endAt === undefined ? undefined : endAt,
        status,
        totalProductsAffected: affectedCount,
      },
      include: this.include,
    });

    // Rebuild link table when appliesTo is specific_products
    if (appliesTo === "SPECIFIC_PRODUCTS") {
      await this.db.$transaction([
        this.db.promotionProductLink.deleteMany({ where: { promotionId: id } }),
        this.db.promotionProductLink.createMany({
          data: (productIds ?? []).map((productId) => ({
            promotionId: id,
            productId,
          })),
          skipDuplicates: true,
        }),
      ]);
    } else {
      await this.db.promotionProductLink.deleteMany({
        where: { promotionId: id },
      });
    }

    return serializePromotion(updated);
  }

  // ─── Pause / Resume ─────────────────────────────────────────

  async pause(id: string) {
    const existing = await this.db.promotion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Promotion not found");
    if (existing.status === "PAUSED") {
      throw new ConflictException("Promotion already paused");
    }

    const updated = await this.db.promotion.update({
      where: { id },
      data: { status: "PAUSED" },
      include: this.include,
    });
    return serializePromotion(updated);
  }

  async resume(id: string) {
    const existing = await this.db.promotion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Promotion not found");
    if (existing.status !== "PAUSED") {
      throw new ConflictException("Promotion is not paused");
    }

    const status = this.resolveStatus(
      existing.startAt,
      existing.endAt,
      "SCHEDULED",
    );

    const updated = await this.db.promotion.update({
      where: { id },
      data: { status },
      include: this.include,
    });
    return serializePromotion(updated);
  }

  // ─── Delete ─────────────────────────────────────────────────

  async remove(id: string) {
    const existing = await this.db.promotion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Promotion not found");
    await this.db.promotion.delete({ where: { id } });
    return { id };
  }
}