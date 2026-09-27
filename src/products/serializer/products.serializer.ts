import { Prisma } from "../../generated/prisma/client.js";
import {
  PromotionLike,
  pickBestPromotion,
  unitPromoPrice,
} from "../../promotions/promotion-calc.js";

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: { select: { id: true; name: true; slug: true } };
    variants: true;
    _count: { select: { orderItems: true } };
  };
}>;

export function serializeProduct(
  p: ProductWithRelations,
  candidates: PromotionLike[] = [],
) {
  const unitPrice = Number(p.unitPrice);

  const best = pickBestPromotion(candidates, {
    id: p.id,
    categoryId: p.categoryId,
    unitPrice,
  });

  const promoPrice = best ? unitPromoPrice(unitPrice, best) : unitPrice;
  const hasPromo = best != null && promoPrice < unitPrice;

  return {
    id: p.id,
    code: p.code,
    name: p.name,
    slug: p.slug,
    description: p.description,
    shortDescription: p.shortDescription,
    images: p.images,
    categoryId: p.categoryId,
    category: p.category,

    sku: p.sku,
    variantOption: p.variantOption,
    unitType: p.unitType,

    // ── Pricing ──
    unitPrice, // current *selling* price
    originalPrice: hasPromo ? unitPrice : null,
    promoPrice: hasPromo ? promoPrice : null,
    discountPercent: hasPromo
      ? Math.round(((unitPrice - promoPrice) / unitPrice) * 100)
      : 0,

    // ── Promotion badge ──
    promotion: best
      ? {
          id: best.id,
          name: best.name,
          type: best.type,
          discountType: best.discountType,
          discountValue: Number(best.discountValue),
          code: best.code ?? null,
        }
      : null,

    // ── Everything else ──
    weight: p.weight != null ? Number(p.weight) : null,
    stock: p.stock,
    reorderLevel: p.reorderLevel,
    status: p.status,
    isFeatured: p.isFeatured,
    tags: p.tags,
    displayOrder: p.displayOrder,
    variants: p.variants.map((v) => {
      const vPrice = Number(v.unitPrice);
      // Promotions on variants: if SPECIFIC/CATEGORY, apply to variant too
      const vBest = best
        ? pickBestPromotion(candidates, {
            id: p.id,
            categoryId: p.categoryId,
            unitPrice: vPrice,
          })
        : null;
      const vPromo = vBest ? unitPromoPrice(vPrice, vBest) : vPrice;
      return {
        id: v.id,
        label: v.label,
        sku: v.sku,
        unitPrice: vPrice,
        promoPrice: vPromo < vPrice ? vPromo : null,
        stock: v.stock,
        isDefault: v.isDefault,
      };
    }),
    unitsSold: p._count?.orderItems ?? 0,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Same serializer for arrays — batches the promotion lookup. */
export function serializeProducts(
  products: ProductWithRelations[],
  candidates: PromotionLike[] = [],
) {
  return products.map((p) => serializeProduct(p, candidates));
}


export function serializeCategory(c: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  status: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  _count?: { products: number };
}) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    status: c.status,
    displayOrder: c.displayOrder,
    productCount: c._count?.products ?? 0,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}