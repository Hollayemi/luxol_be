import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateCategoryDto } from "./dto/create-category.dto.js";
import { UpdateCategoryDto } from "./dto/update-category.dto.js";
import { ListCategoriesDto } from "./dto/list-categories.dto.js";
import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { serializeCategory } from "../products/serializer/products.serializer.js";
import { slugify } from "../common/utils/slug.util.js";

@Injectable()
export class CategoriesService {
  constructor(private db: DatabaseService) { }

  private include = {
    _count: { select: { products: true } },
  } satisfies Prisma.CategoryInclude;

  // ─── Public: list active categories ─────────────────────────

  async listPublic() {
    const rows = await this.db.category.findMany({
      where: { status: "ACTIVE" },
      include: this.include,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(serializeCategory);
  }

  // ─── Admin: list all with filters + pagination ──────────────

  async listAdmin(dto: ListCategoriesDto) {
    const page = dto.page ?? 1;
    const perPage = dto.perPage ?? 50;
    const skip = (page - 1) * perPage;

    const where: Prisma.CategoryWhereInput = {};
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: "insensitive" } },
        { slug: { contains: dto.search, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await this.db.$transaction([
      this.db.category.count({ where }),
      this.db.category.findMany({
        where,
        include: this.include,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
        skip,
        take: perPage,
      }),
    ]);

    return {
      items: rows.map(serializeCategory),
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      page,
    };
  }

  // ─── Shared: find one ───────────────────────────────────────

  async findOne(id: string) {
    const cat = await this.db.category.findUnique({
      where: { id },
      include: this.include,
    });
    if (!cat) throw new NotFoundException("Category not found");
    return serializeCategory(cat);
  }

  async findBySlug(slug: string) {
    const cat = await this.db.category.findUnique({
      where: { slug },
      include: this.include,
    });
    if (!cat || cat.status !== "ACTIVE")
      throw new NotFoundException("Category not found");
    return serializeCategory(cat);
  }

  // ─── Admin: create ──────────────────────────────────────────

  async create(dto: CreateCategoryDto) {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);

    console.log({dto})

    const existing = await this.db.category.findFirst({
      where: { OR: [{ name: dto.name }, { slug }] },
    });
    
    if (existing)
      throw new ConflictException("Category name or slug already exists");

    const created = await this.db.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description ?? null,
        image: dto.image ?? null,
        status: dto.status ?? "ACTIVE",
        displayOrder: dto.displayOrder ?? 0,
      },
      include: this.include,
    });

    return serializeCategory(created);
  }

  // ─── Admin: update ──────────────────────────────────────────

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.db.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Category not found");
    console.log(dto)
    let slug: string | undefined;
    if (dto.slug || dto.name) {
      slug = slugify(dto.slug ?? dto.name ?? existing.name);
      const clash = await this.db.category.findFirst({
        where: { slug, NOT: { id } },
      });
      if (clash) throw new ConflictException("Slug already in use");
    }

    const updated = await this.db.category.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        slug: slug ?? undefined,
        description:
          dto.description === undefined ? undefined : dto.description,
        image: dto.image === undefined ? undefined : dto.image,
        status: dto.status ?? undefined,
        displayOrder: dto.displayOrder ?? undefined,
      },
      include: this.include,
    });

    return serializeCategory(updated);
  }

  // ─── Admin: delete ──────────────────────────────────────────

  async remove(id: string) {
    const existing = await this.db.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) throw new NotFoundException("Category not found");

    if (existing._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${existing._count.products} product(s). Reassign or delete them first.`,
      );
    }

    await this.db.category.delete({ where: { id } });
    return { id };
  }
}