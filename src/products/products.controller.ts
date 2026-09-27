import { BadRequestException, Controller, Get, Param, Query, UploadedFile, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { ProductsService } from "./products.service.js";
import { ListProductsDto } from "./dto/list-products.dto.js";

@Controller("catalog/products")
export class PublicProductsController {
  constructor(private products: ProductsService) { }

  @Get()
  async list(@Query() dto: ListProductsDto) {
    return { message: "OK", data: await this.products.listPublic(dto) };
  }

  @Get(":slug")
  async detail(@Param("slug") slug: string) {
    return { message: "OK", data: await this.products.findBySlug(slug) };
  }

  @Get(":slug/related")
  async related(@Param("slug") slug: string, @Query("limit") limit?: string) {
    const product = await this.products.findBySlug(slug);
    return {
      message: "OK",
      data: await this.products.related(
        product.id,
        limit ? parseInt(limit, 10) : 6,
      ),
    };
  }
}


import {
  Body,
  Delete,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CreateProductDto } from "./dto/create-product.dto.js";
import { UpdateProductDto } from "./dto/update-product.dto.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { Role } from "../generated/prisma/enums.js";
import { CloudinaryService } from "../cloudinary/cloudinary.js";
import { FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller("admin/inventory")

export class AdminProductsController {
  constructor(
    private products: ProductsService,
    private cloudinary: CloudinaryService
  ) { }

  @Get()
  async list(@Query() dto: ListProductsDto) {
    return { message: "OK", data: await this.products.listAdmin(dto) };
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    return { message: "OK", data: await this.products.findOne(id) };
  }

  @Post()
  @UseInterceptors(FilesInterceptor('images', 8, { storage: memoryStorage() }))
  async create(@Body() dto: CreateProductDto, @UploadedFiles() images?: Express.Multer.File[]) {
    console.log({ dto, images })
    if (!images?.length) throw new BadRequestException('Product Image Required');
    const urls = await this.cloudinary.uploadMany(images);
    // const urls = [
    //   'https://res.cloudinary.com/dfhfymr0q/image/upload/v1790425729/lawticha/fft0d58vxvsplshqtfs0.png',
    // 'https://res.cloudinary.com/dfhfymr0q/image/upload/v1790425729/lawticha/rywxldvpfxje7hvsvnoy.webp',
    // 'https://res.cloudinary.com/dfhfymr0q/image/upload/v1790425730/lawticha/bfrbjh2vsecc0tnfyrbu.png'
    // ]
    console.log({urls})
    return {
      message: "Product created",
      data: await this.products.create({
        ...dto,
        unitPrice: parseInt(dto.unitPrice.toString(), 10),
        weight: Number(dto.weight),
        stock: Number(dto.stock),
        reorderLevel: Number(dto.reorderLevel),
        images: urls
      }),
    };
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return {
      message: "Product updated",
      data: await this.products.update(id, dto),
    };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return {
      message: "Product removed",
      data: await this.products.remove(id),
    };
  }

  @Post(":id/stock")
  async adjustStock(
    @Param("id") id: string,
    @Body() body: { delta: number; reason: string; reference?: string },
  ) {
    return {
      message: "Stock adjusted",
      data: await this.products.adjustStock(
        id,
        body.delta,
        body.reason,
        body.reference,
      ),
    };
  }
}