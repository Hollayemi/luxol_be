import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import { CreateMeatBoxCategoryDto, CreateMeatBoxOptionDto, UpdateMeatBoxCategoryDto, UpdateMeatBoxOptionDto } from "../dto/update-meat-box-status.dto.js";
import { slugify } from "../../common/utils/slug.util.js";
import { serializeCategory, serializeOption } from "../meat-box.serializer.js";
import { Prisma } from "../../generated/prisma/client.js";
import { CloudinaryService } from "../../cloudinary/cloudinary.js";

@Injectable()
export class AdminMeatBoxCatalogueService {
  constructor(
    private db: DatabaseService,
    private cd: CloudinaryService,
  ) {}

  // ─── Catalogue read ─────────────────────────────────────────

  async listCatalogue() {
    const rows = await this.db.meatBoxCategory.findMany({
      include: {
        options: { orderBy: { displayOrder: "asc" } },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    return { items: rows.map(serializeCategory) };
  }

  // ─── Categories ─────────────────────────────────────────────

  async createCategory(dto: CreateMeatBoxCategoryDto, file?: Express.Multer.File) {
    const slug = slugify(dto.label);
    const clash = await this.db.meatBoxCategory.findFirst({
      where: { OR: [{ label: dto.label }, { slug }] },
    });
    if (clash) throw new ConflictException("Category label or slug already exists");

    const image = file ? (await this.cd.upload(file)) : null;

    const created = await this.db.meatBoxCategory.create({
      data: {
        label: dto.label,
        slug,
        image,
        status: dto.status ?? "ACTIVE",
        displayOrder: dto.displayOrder ?? 0,
      },
      include: { options: true },
    });

    return serializeCategory(created);
  }

  async updateCategory(
    id: string,
    dto: UpdateMeatBoxCategoryDto,
    file?: Express.Multer.File,
  ) {
    const existing = await this.db.meatBoxCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Category not found");

    let slug: string | undefined;
    if (dto.label && dto.label !== existing.label) {
      slug = slugify(dto.label);
      const clash = await this.db.meatBoxCategory.findFirst({
        where: { slug, NOT: { id } },
      });
      if (clash) throw new ConflictException("Category label already in use");
    }

    const image = file ? await this.cd.upload(file) : undefined;

    console.log(file, image)

    const updated = await this.db.meatBoxCategory.update({
      where: { id },
      data: {
        label: dto.label ?? undefined,
        slug: slug ?? undefined,
        status: dto.status ?? undefined,
        displayOrder: dto.displayOrder ?? undefined,
        image: image === undefined ? undefined : image,
      },
      include: { options: true },
    });

    return serializeCategory(updated);
  }

  async deleteCategory(id: string) {
    const cat = await this.db.meatBoxCategory.findUnique({
      where: { id },
      include: { _count: { select: { options: true } } },
    });
    if (!cat) throw new NotFoundException("Category not found");

    if (cat._count.options > 0) {
      throw new BadRequestException(
        `Cannot delete a category with ${cat._count.options} option(s). Remove or reassign them first.`,
      );
    }

    await this.db.meatBoxCategory.delete({ where: { id } });
    return { id };
  }

  // ─── Options ────────────────────────────────────────────────

  async createOption(dto: CreateMeatBoxOptionDto, file?: Express.Multer.File) {
    const category = await this.db.meatBoxCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new NotFoundException("Category not found");

    const clash = await this.db.meatBoxOption.findUnique({
      where: { label: dto.label },
    });
    if (clash) throw new ConflictException("Option label already exists");

    this.validateUnit(dto.unit, dto);

    const image = file ? (await this.cd.upload(file)) : null;

    const created = await this.db.meatBoxOption.create({
      data: {
        categoryId: dto.categoryId,
        label: dto.label,
        image,
        unit: dto.unit,
        pricePerKg: dto.pricePerKg != null ? new Prisma.Decimal(dto.pricePerKg) : null,
        estimatedMinKg: dto.estimatedMinKg != null ? new Prisma.Decimal(dto.estimatedMinKg) : null,
        estimatedMaxKg: dto.estimatedMaxKg != null ? new Prisma.Decimal(dto.estimatedMaxKg) : null,
        estimatedMinPrice: dto.estimatedMinPrice != null ? new Prisma.Decimal(dto.estimatedMinPrice) : null,
        estimatedMaxPrice: dto.estimatedMaxPrice != null ? new Prisma.Decimal(dto.estimatedMaxPrice) : null,
        maxQuantity: dto.maxQuantity ?? null,
        status: dto.status ?? "ACTIVE",
        displayOrder: dto.displayOrder ?? 0,
      },
    });

    return serializeOption(created);
  }

  async updateOption(
    id: string,
    dto: UpdateMeatBoxOptionDto,
    file?: Express.Multer.File,
  ) {
    const existing = await this.db.meatBoxOption.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Option not found");

    if (dto.label && dto.label !== existing.label) {
      const clash = await this.db.meatBoxOption.findUnique({
        where: { label: dto.label },
      });
      if (clash) throw new ConflictException("Option label already in use");
    }

    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const cat = await this.db.meatBoxCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!cat) throw new NotFoundException("Target category not found");
    }

    const nextUnit = dto.unit ?? existing.unit;
    this.validateUnit(nextUnit, {
      pricePerKg: dto.pricePerKg !== undefined ? dto.pricePerKg : existing.pricePerKg && Number(existing.pricePerKg),
      estimatedMinKg: dto.estimatedMinKg !== undefined ? dto.estimatedMinKg : existing.estimatedMinKg && Number(existing.estimatedMinKg),
      estimatedMaxKg: dto.estimatedMaxKg !== undefined ? dto.estimatedMaxKg : existing.estimatedMaxKg && Number(existing.estimatedMaxKg),
    });

    const image = file ? (await this.cd.upload(file)) : undefined;

    const updated = await this.db.meatBoxOption.update({
      where: { id },
      data: {
        categoryId: dto.categoryId ?? undefined,
        label: dto.label ?? undefined,
        unit: dto.unit ?? undefined,
        pricePerKg:
          dto.pricePerKg === undefined
            ? undefined
            : dto.pricePerKg == null
              ? null
              : new Prisma.Decimal(dto.pricePerKg),
        estimatedMinKg:
          dto.estimatedMinKg === undefined
            ? undefined
            : dto.estimatedMinKg == null
              ? null
              : new Prisma.Decimal(dto.estimatedMinKg),
        estimatedMaxKg:
          dto.estimatedMaxKg === undefined
            ? undefined
            : dto.estimatedMaxKg == null
              ? null
              : new Prisma.Decimal(dto.estimatedMaxKg),
        estimatedMinPrice:
          dto.estimatedMinPrice === undefined
            ? undefined
            : dto.estimatedMinPrice == null
              ? null
              : new Prisma.Decimal(dto.estimatedMinPrice),
        estimatedMaxPrice:
          dto.estimatedMaxPrice === undefined
            ? undefined
            : dto.estimatedMaxPrice == null
              ? null
              : new Prisma.Decimal(dto.estimatedMaxPrice),
        maxQuantity:
          dto.maxQuantity === undefined ? undefined : dto.maxQuantity,
        status: dto.status ?? undefined,
        displayOrder: dto.displayOrder ?? undefined,
        image: image === undefined ? undefined : image,
      },
    });

    return serializeOption(updated);
  }

  async deleteOption(id: string) {
    const option = await this.db.meatBoxOption.findUnique({
      where: { id },
      include: { _count: { select: { orderItems: true } } },
    });
    if (!option) throw new NotFoundException("Option not found");

    if (option._count.orderItems > 0) {
      throw new BadRequestException(
        `Cannot delete this option — it has been used in ${option._count.orderItems} order(s). Set it to INACTIVE instead.`,
      );
    }

    await this.db.meatBoxOption.delete({ where: { id } });
    return { id };
  }

  // ─── Validation ─────────────────────────────────────────────

  private validateUnit(
    unit: "ANIMAL" | "KG",
    dto: {
      pricePerKg?: number | null;
      estimatedMinKg?: number | null;
      estimatedMaxKg?: number | null;
    },
  ) {
    if (unit === "KG") {
      if (dto.pricePerKg == null || dto.pricePerKg <= 0) {
        throw new BadRequestException("pricePerKg is required for KG options");
      }
    } else if (unit === "ANIMAL") {
      if (dto.estimatedMinKg == null || dto.estimatedMaxKg == null) {
        throw new BadRequestException(
          "estimatedMinKg and estimatedMaxKg are required for ANIMAL options",
        );
      }
      if (dto.estimatedMinKg > dto.estimatedMaxKg) {
        throw new BadRequestException(
          "estimatedMinKg cannot be greater than estimatedMaxKg",
        );
      }
    }
  }
}