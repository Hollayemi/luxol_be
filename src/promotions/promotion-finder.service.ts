import { Injectable } from "@nestjs/common";
import { PromotionLike } from "./promotion-calc.js";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class PromotionFinderService {
  constructor(private db: DatabaseService) {}

  /**
   * Fetch every currently-active promotion that could apply to any of the
   * given products. Returns the raw promotion rows — the caller uses
   * `pickBestPromotion` to resolve which one wins per product.
   *
   * "Could apply" = ALL_ORDERS, or CATEGORY whose category is in the set,
   * or SPECIFIC_PRODUCTS whose productIds intersect the set.
   */
  async findActiveForProducts(products: {
    ids: string[];
    categoryIds: string[];
  }): Promise<PromotionLike[]> {
    if (!products.ids.length) return [];

    const now = new Date();

    return this.db.promotion.findMany({
      where: {
        status: "ACTIVE",
        startAt: { lte: now },
        OR: [{ endAt: null }, { endAt: { gte: now } }],
        AND: [
          {
            OR: [
              { appliesTo: "ALL_ORDERS" },
              {
                appliesTo: "CATEGORY",
                categoryId: { in: products.categoryIds },
              },
              {
                appliesTo: "SPECIFIC_PRODUCTS",
                productIds: { hasSome: products.ids },
              },
            ],
          },
        ],
      },
    });
  }

  /** All active promotions — used by /promotions/active for banners etc. */
  async findAllActive(): Promise<PromotionLike[]> {
    const now = new Date();
    return this.db.promotion.findMany({
      where: {
        status: "ACTIVE",
        startAt: { lte: now },
        OR: [{ endAt: null }, { endAt: { gte: now } }],
      },
      orderBy: { createdAt: "desc" },
    });
  }
}