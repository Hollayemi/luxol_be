import { Prisma } from "../generated/prisma/client.js";


type PromotionWithCategory = Prisma.PromotionGetPayload<{
  include: { category: { select: { id: true; name: true } } };
}>;

export function serializePromotion(p: PromotionWithCategory) {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    discountType: p.discountType,
    discountValue: Number(p.discountValue),
    appliesTo: p.appliesTo,
    categoryId: p.categoryId,
    category: p.category ?? null,
    productIds: p.productIds,
    affectedCount: p.affectedCount,
    minimumOrderAmount:
      p.minimumOrderAmount != null ? Number(p.minimumOrderAmount) : null,
    maximumDiscount:
      p.maximumDiscount != null ? Number(p.maximumDiscount) : null,
    usageLimit: p.usageLimit,
    limitPerCustomer: p.limitPerCustomer,
    code: p.code,
    startAt: p.startAt.toISOString(),
    endAt: p.endAt ? p.endAt.toISOString() : null,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function serializePromotionDetail(
  p: PromotionWithCategory,
  products: Array<{
    id: string;
    name: string;
    categoryName: string;
    image: string | null;
    unit: string | null;
    price: Prisma.Decimal;
    promoPrice: Prisma.Decimal;
    unitsSold: number;
  }>,
) {
  return {
    ...serializePromotion(p),
    totalProductsAffected: p.totalProductsAffected,
    totalDiscountGiven: Number(p.totalDiscountGiven),
    totalOrdersAffected: p.totalOrdersAffected,
    totalSalesMade: Number(p.totalSalesMade),
    products: products.map((prod) => ({
      id: prod.id,
      name: prod.name,
      category: prod.categoryName,
      image: prod.image,
      unitType: prod.unit ?? "unit",
      regularPrice: Number(prod.price),
      promoPrice: Number(prod.promoPrice),
      unitsSold: prod.unitsSold,
    })),
  };
}