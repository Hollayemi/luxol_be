import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateProductDto } from "./dto/create-product.dto.js";
import { UpdateProductDto } from "./dto/update-product.dto.js";
import { ListProductsDto } from "./dto/list-products.dto.js";
import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { serializeProduct, serializeProducts } from "./serializer/products.serializer.js";
import { slugify } from "../common/utils/slug.util.js";
import { nextCode } from "../common/utils/code.util.js";
import { PromotionFinderService } from "../promotions/promotion-finder.service.js";

@Injectable()
export class ProductsService {
  constructor(
    private db: DatabaseService,
    private promotionFinder: PromotionFinderService
 
  ) {}

  private include = {
    category: { select: { id: true, name: true, slug: true } },
    variants: true,
    _count: { select: { orderItems: true } },
  } satisfies Prisma.ProductInclude;

  // ─── Public list ────────────────────────────────────────────

  async listPublic(dto: ListProductsDto) {
    return this.list({ ...dto, status: "ACTIVE" });
  }

  // ─── Admin list ─────────────────────────────────────────────

  async listAdmin(dto: ListProductsDto) {
    return this.list(dto);
  }

  private async list(dto: ListProductsDto) {
    const page = dto.page ?? 1;
    const perPage = dto.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Prisma.ProductWhereInput = {};

    if (dto.status) where.status = dto.status;
    if (dto.isFeatured !== undefined) where.isFeatured = dto.isFeatured;
    if (dto.categoryId) where.categoryId = dto.categoryId;
    if (dto.category) where.category = { slug: dto.category };

    if (dto.tags?.length) where.tags = { hasSome: dto.tags };

    if (dto.minPrice != null || dto.maxPrice != null) {
      where.unitPrice = {};
      if (dto.minPrice != null) (where.unitPrice as any).gte = dto.minPrice;
      if (dto.maxPrice != null) (where.unitPrice as any).lte = dto.maxPrice;
    }

    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: "insensitive" } },
        { sku: { contains: dto.search, mode: "insensitive" } },
        { code: { contains: dto.search, mode: "insensitive" } },
        { tags: { has: dto.search } },
      ];
    }

    const orderBy = this.resolveSort(dto.sort);

    const [total, rows] = await this.db.$transaction([
      this.db.product.count({ where }),
      this.db.product.findMany({
        where,
        include: this.include,
        orderBy,
        skip,
        take: perPage,
      }),
    ]);

    // ── One extra query for all applicable promotions ──
    const productIds = rows.map((r) => r.id);
    const categoryIds = [...new Set(rows.map((r) => r.categoryId))];
    const promotions =
      productIds.length > 0
        ? await this.promotionFinder.findActiveForProducts({
            ids: productIds,
            categoryIds,
          })
        : [];

    return {
      items: serializeProducts(rows, promotions),
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      page,
    };
  }


  private resolveSort(sort?: string): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case "price_asc":
        return [{ unitPrice: "asc" }];
      case "price_desc":
        return [{ unitPrice: "desc" }];
      case "name_asc":
        return [{ name: "asc" }];
      case "newest":
      default:
        return [{ displayOrder: "asc" }, { createdAt: "desc" }];
    }
  }

  // ─── Detail ─────────────────────────────────────────────────

  async findOne(id: string) {
    const p = await this.db.product.findUnique({
      where: { id },
      include: this.include,
    });
    if (!p) throw new NotFoundException("Product not found");

    const promotions = await this.promotionFinder.findActiveForProducts({
      ids: [p.id],
      categoryIds: [p.categoryId],
    });

    return serializeProduct(p, promotions);
  }

  async findBySlug(slug: string) {
    const p = await this.db.product.findUnique({
      where: { slug },
      include: this.include,
    });
    if (!p || p.status !== "ACTIVE")
      throw new NotFoundException("Product not found");

    const promotions = await this.promotionFinder.findActiveForProducts({
      ids: [p.id],
      categoryIds: [p.categoryId],
    });

    return serializeProduct(p, promotions);
  }

  // ─── Create ─────────────────────────────────────────────────

  async create(dto: CreateProductDto) {
    const category = await this.db.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new NotFoundException("Category not found");

    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);

    const slugClash = await this.db.product.findUnique({ where: { slug } });
    if (slugClash) throw new ConflictException("Product slug already exists");

    const sku = dto.sku ?? (await nextCode(this.db, "product_sku", "SKU", 6));
    const skuClash = await this.db.product.findUnique({ where: { sku } });
    if (skuClash) throw new ConflictException("SKU already exists");

    const code = await nextCode(this.db, "product_code", "PRD", 4);

    const hasVariants =
      dto.variantOption === "PARENT" ||
      (dto.variants && dto.variants.length > 0);

    if (hasVariants && (!dto.variants || dto.variants.length === 0)) {
      throw new BadRequestException(
        "variantOption PARENT requires at least one variant",
      );
    }

    const created = await this.db.$transaction(async (tx) => {
      return tx.product.create({
        data: {
          code,
          name: dto.name,
          slug,
          description: dto.description ?? null,
          shortDescription: dto.shortDescription ?? null,
          images: dto.images ?? undefined,
          categoryId: dto.categoryId,
          sku,
          variantOption: dto.variantOption ?? "NONE",
          unitType: dto.unitType,
          unitPrice: new Prisma.Decimal(dto.unitPrice),
          weight:
            dto.weight != null ? new Prisma.Decimal(dto.weight) : null,
          stock: dto.stock ?? 0,
          reorderLevel: dto.reorderLevel ?? 5,
          status: dto.status ?? "ACTIVE",
          isFeatured: dto.isFeatured ?? false,
          tags: dto.tags ?? [],
          displayOrder: dto.displayOrder ?? 0,
          variants: dto.variants?.length
            ? {
                create: dto.variants.map((v) => ({
                  label: v.label,
                  sku: v.sku ?? `${sku}-${slugify(v.label)}`,
                  unitPrice: new Prisma.Decimal(v.unitPrice),
                  stock: v.stock ?? 0,
                  isDefault: v.isDefault ?? false,
                })),
              }
            : undefined,
        },
        include: this.include,
      });
    });

    return serializeProduct(created);
  }

  // ─── Update ─────────────────────────────────────────────────

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.db.product.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!existing) throw new NotFoundException("Product not found");

    if (dto.categoryId) {
      const cat = await this.db.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!cat) throw new NotFoundException("Category not found");
    }

    let slug: string | undefined;
    if (dto.slug || dto.name) {
      slug = slugify(dto.slug ?? dto.name ?? existing.name);
      const clash = await this.db.product.findFirst({
        where: { slug, NOT: { id } },
      });
      if (clash) throw new ConflictException("Slug already in use");
    }

    if (dto.sku && dto.sku !== existing.sku) {
      const skuClash = await this.db.product.findFirst({
        where: { sku: dto.sku, NOT: { id } },
      });
      if (skuClash) throw new ConflictException("SKU already in use");
    }

    const updated = await this.db.$transaction(async (tx) => {
      // If variants are supplied, replace them wholesale.
      // Simpler than diffing; skus stay stable via the caller.
      if (dto.variants) {
        await tx.productVariant.deleteMany({ where: { productId: id } });
      }

      return tx.product.update({
        where: { id },
        data: {
          name: dto.name ?? undefined,
          slug: slug ?? undefined,
          description:
            dto.description === undefined ? undefined : dto.description,
          shortDescription:
            dto.shortDescription === undefined
              ? undefined
              : dto.shortDescription,
          image: dto.images === undefined ? undefined : dto.images,
          categoryId: dto.categoryId ?? undefined,
          sku: dto.sku ?? undefined,
          variantOption: dto.variantOption ?? undefined,
          unitType: dto.unitType ?? undefined,
          unitPrice:
            dto.unitPrice != null
              ? new Prisma.Decimal(dto.unitPrice)
              : undefined,
          weight:
            dto.weight === undefined
              ? undefined
              : dto.weight == null
                ? null
                : new Prisma.Decimal(dto.weight),
          stock: dto.stock ?? undefined,
          reorderLevel: dto.reorderLevel ?? undefined,
          status: dto.status ?? undefined,
          isFeatured: dto.isFeatured ?? undefined,
          tags: dto.tags ?? undefined,
          displayOrder: dto.displayOrder ?? undefined,
          variants: dto.variants?.length
            ? {
                create: dto.variants.map((v) => ({
                  label: v.label,
                  sku:
                    v.sku ??
                    `${dto.sku ?? existing.sku}-${slugify(v.label)}`,
                  unitPrice: new Prisma.Decimal(v.unitPrice),
                  stock: v.stock ?? 0,
                  isDefault: v.isDefault ?? false,
                })),
              }
            : undefined,
        },
        include: this.include,
      });
    });

    return serializeProduct(updated);
  }

  // ─── Delete ─────────────────────────────────────────────────

  async remove(id: string) {
    const existing = await this.db.product.findUnique({
      where: { id },
      include: { _count: { select: { orderItems: true } } },
    });
    if (!existing) throw new NotFoundException("Product not found");

    // Safer to soft-delete products that have history
    if (existing._count.orderItems > 0) {
      const soft = await this.db.product.update({
        where: { id },
        data: { status: "INACTIVE" },
        include: this.include,
      });
      return {
        id,
        softDeleted: true,
        product: serializeProduct(soft),
        message:
          "Product has order history; marked INACTIVE instead of deleted.",
      };
    }

    await this.db.product.delete({ where: { id } });
    return { id, softDeleted: false };
  }

  // ─── Stock adjustment (used by admin and by orders later) ───

  async adjustStock(productId: string, delta: number, reason: string, reference?: string) {
    return this.db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new NotFoundException("Product not found");

      const nextStock = product.stock + delta;
      if (nextStock < 0)
        throw new BadRequestException("Stock cannot go negative");

      await tx.product.update({
        where: { id: productId },
        data: { stock: nextStock },
      });
      await tx.stockMovement.create({
        data: { productId, delta, reason, reference: reference ?? null },
      });

      return { productId, stock: nextStock };
    });
  }

  // ─── Related products (same category) ──────────────────────

  async related(id: string, limit = 6) {
    const product = await this.db.product.findUnique({
      where: { id },
      select: { categoryId: true },
    });
    if (!product) throw new NotFoundException("Product not found");

    const rows = await this.db.product.findMany({
      where: {
        categoryId: product.categoryId,
        NOT: { id },
        status: "ACTIVE",
      },
      include: this.include,
      take: limit,
    });

    const promotions = await this.promotionFinder.findActiveForProducts({
      ids: rows.map((r) => r.id),
      categoryIds: [...new Set(rows.map((r) => r.categoryId))],
    });

    return serializeProducts(rows, promotions);
  }

}