import { Promotion } from "../generated/prisma/client.js";


export type PromotionLike = Pick<
  Promotion,
  | "id"
  | "name"
  | "type"
  | "discountType"
  | "discountValue"
  | "maximumDiscount"
  | "minimumOrderAmount"
  | "appliesTo"
  | "categoryId"
  | "productIds"
  | "code"
  | "startAt"
  | "endAt"
  | "status"
  | "createdAt"
>;

/** Percentage discount applied to a unit price, capped, rounded to 2dp. */
export function unitPromoPrice(
  unitPrice: number,
  promo: PromotionLike,
): number {
  const base = unitPrice;

  switch (promo.discountType) {
    case "PERCENTAGE": {
      const pct = Number(promo.discountValue);
      let next = base - (base * pct) / 100;
      if (promo.maximumDiscount != null) {
        const maxDisc = Number(promo.maximumDiscount);
        const disc = base - next;
        if (disc > maxDisc) next = base - maxDisc;
      }
      return round2(Math.max(0, next));
    }
    case "FIXED_AMOUNT": {
      const off = Number(promo.discountValue);
      return round2(Math.max(0, base - off));
    }
    case "FREE_DELIVERY":
      // Doesn't change unit price — applied against delivery fee
      return round2(base);
  }
}

/** Naira discount for one unit. */
export function unitDiscount(unitPrice: number, promo: PromotionLike): number {
  return round2(unitPrice - unitPromoPrice(unitPrice, promo));
}

/** Naira discount for a cart subtotal (used in cart/validate and orders). */
export function cartDiscount(
  subtotal: number,
  promo: PromotionLike,
): number {
  switch (promo.discountType) {
    case "PERCENTAGE": {
      let disc = (subtotal * Number(promo.discountValue)) / 100;
      if (promo.maximumDiscount != null) {
        disc = Math.min(disc, Number(promo.maximumDiscount));
      }
      return round2(Math.min(disc, subtotal));
    }
    case "FIXED_AMOUNT":
      return round2(Math.min(Number(promo.discountValue), subtotal));
    case "FREE_DELIVERY":
      return 0; // handled against delivery
  }
}

export function isPromotionActive(
  promo: Pick<Promotion, "status" | "startAt" | "endAt">,
  now = new Date(),
): boolean {
  if (promo.status !== "ACTIVE") return false;
  if (promo.startAt > now) return false;
  if (promo.endAt && promo.endAt < now) return false;
  return true;
}

/** Does this promotion apply to this product? */
export function promotionAppliesToProduct(
  promo: Pick<Promotion, "appliesTo" | "categoryId" | "productIds">,
  product: { id: string; categoryId: string },
): boolean {
  switch (promo.appliesTo) {
    case "ALL_ORDERS":
      return true;
    case "CATEGORY":
      return promo.categoryId === product.categoryId;
    case "SPECIFIC_PRODUCTS":
      return promo.productIds.includes(product.id);
  }
}

/**
 * Pick the best applicable promotion for a product.
 * Precedence: SPECIFIC_PRODUCTS > CATEGORY > ALL_ORDERS.
 * Within a tier: highest unit discount; tie → newest.
 */
export function pickBestPromotion(
  candidates: PromotionLike[],
  product: { id: string; categoryId: string; unitPrice: number },
): PromotionLike | null {
  const tier = { SPECIFIC_PRODUCTS: 3, CATEGORY: 2, ALL_ORDERS: 1 } as const;

  const applicable = candidates.filter((p) =>
    promotionAppliesToProduct(p, product),
  );
  if (!applicable.length) return null;

  return applicable.sort((a, b) => {
    const tA = tier[a.appliesTo];
    const tB = tier[b.appliesTo];
    if (tA !== tB) return tB - tA;

    const dA = unitDiscount(product.unitPrice, a);
    const dB = unitDiscount(product.unitPrice, b);
    if (dA !== dB) return dB - dA;

    return b.createdAt.getTime() - a.createdAt.getTime();
  })[0];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}