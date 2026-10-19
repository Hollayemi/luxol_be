import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import { serializeCategory, serializeOption } from "./meat-box.serializer.js";
import { slugify } from "../../common/utils/slug.util.js";
import { CloudinaryService } from "../../cloudinary/cloudinary.js";
import { CreateMeatBoxCategoryDto, CreateMeatBoxOptionDto, UpdateMeatBoxCategoryDto, UpdateMeatBoxOptionDto } from "../dto/update-meat-box-status.dto.js";
import { Prisma } from "../../generated/prisma/client.js";

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

    const image = file ? await this.cd.upload(file, "categories") : null;

    const created = await this.db.meatBoxCategory.create({
      data: {
        label: dto.label,
        slug,
        pricePerKg: new Prisma.Decimal(dto.pricePerKg),
        image,
        status: dto.status ?? "ACTIVE",
        displayOrder: dto.displayOrder ?? 0,
      },
      include: { options: true },
    });

    return serializeCategory(created);
  }

  async updateCategory(id: string, dto: UpdateMeatBoxCategoryDto, file?: Express.Multer.File) {
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

    const image = file ? await this.cd.upload(file, "categories") : undefined;

    const updated = await this.db.meatBoxCategory.update({
      where: { id },
      data: {
        label: dto.label ?? undefined,
        slug: slug ?? undefined,
        pricePerKg: dto.pricePerKg != null ? new Prisma.Decimal(dto.pricePerKg) : undefined,
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

    const image = file ? await this.cd.upload(file, "options") : null;

    const created = await this.db.meatBoxOption.create({
      data: {
        categoryId: dto.categoryId,
        label: dto.label,
        weightKg: new Prisma.Decimal(dto.weightKg),
        image,
        maxQuantity: dto.maxQuantity ?? null,
        status: dto.status ?? "ACTIVE",
        displayOrder: dto.displayOrder ?? 0,
      },
      include: { category: true }, // Required so the serializer can calculate price
    });

    return serializeOption(created, Number(category.pricePerKg));
  }

  async updateOption(id: string, dto: UpdateMeatBoxOptionDto, file?: Express.Multer.File) {
    const existing = await this.db.meatBoxOption.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Option not found");

     const category = await this.db.meatBoxCategory.findUnique({
      where: { id: existing.categoryId },
    });

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

    const image = file ? await this.cd.upload(file, "options") : undefined;

    const updated = await this.db.meatBoxOption.update({
      where: { id },
      data: {
        categoryId: dto.categoryId ?? undefined,
        label: dto.label ?? undefined,
        weightKg: dto.weightKg != null ? new Prisma.Decimal(dto.weightKg) : undefined,
        maxQuantity: dto.maxQuantity === undefined ? undefined : dto.maxQuantity,
        status: dto.status ?? undefined,
        displayOrder: dto.displayOrder ?? undefined,
        image: image === undefined ? undefined : image,
      },
      include: { category: true },
    });

    return serializeOption(updated, Number(category?.pricePerKg));
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
}