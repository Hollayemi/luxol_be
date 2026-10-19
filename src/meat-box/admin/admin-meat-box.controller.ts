import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../auth/guards/roles.guard.js";
import { Role } from "../../generated/prisma/enums.js";
import { Roles } from "../../auth/decorators/roles.decorator.js";
import { AdminMeatBoxOrdersService } from "./meat-box-orders.service.js";
import { AdminMeatBoxCatalogueService } from "./meat-box-catalogue.service.js";
import { GetAdminMeatBoxStatsDto } from "../dto/get-admin-meat-box-stats.dto.js";
import { ListAdminMeatBoxOrdersDto } from "../dto/list-admin-meat-box-orders.dto.js";
import { UpdateMeatBoxPriceDto } from "../dto/update-meat-box-price.dto.js";
import { CreateMeatBoxCategoryDto, CreateMeatBoxOptionDto, UpdateMeatBoxCategoryDto, UpdateMeatBoxOptionDto, UpdateMeatBoxStatusDto } from "../dto/update-meat-box-status.dto.js";
import { CancelMeatBoxOrderDto } from "../dto/cancel-meat-box-order.dto.js";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller("admin/meat-box")
export class AdminMeatBoxController {
  constructor(
    private orders: AdminMeatBoxOrdersService,
    private catalogue: AdminMeatBoxCatalogueService,
  ) {}

  // ─── Orders ─────────────────────────────────────────────

  @Get("stats")
  async stats(@Query() dto: GetAdminMeatBoxStatsDto) {
    return { message: "OK", data: await this.orders.stats(dto) };
  }

  @Get("orders")
  async list(@Query() dto: ListAdminMeatBoxOrdersDto) {
    return { message: "OK", data: await this.orders.list(dto) };
  }

  @Get("orders/:id")
  async detail(@Param("id") id: string) {
    return { message: "OK", data: await this.orders.findOne(id) };
  }

  @Patch("orders/:id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateMeatBoxStatusDto,
  ) {
    return {
      message: "Order status updated",
      data: await this.orders.updateStatus(id, dto),
    };
  }

  @Post("orders/:id/cancel")
  async cancel(
    @Param("id") id: string,
    @Body() dto: CancelMeatBoxOrderDto,
  ) {
    return {
      message: "Order cancelled",
      data: await this.orders.cancel(id, dto),
    };
  }

  // ─── Catalogue ──────────────────────────────────────────

  @Get("categories")
  async listCatalogue() {
    return { message: "OK", data: await this.catalogue.listCatalogue() };
  }

  @Post("categories")
  @UseInterceptors(FileInterceptor("image", { limits: { fileSize: MAX_IMAGE_BYTES } }))
  async createCategory(
    @Body() dto: CreateMeatBoxCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return {
      message: "Category created",
      data: await this.catalogue.createCategory(dto, file),
    };
  }

  @Patch("categories/:id")
  @UseInterceptors(FileInterceptor("image", { limits: { fileSize: MAX_IMAGE_BYTES } }))
  async updateCategory(
    @Param("id") id: string,
    @Body() dto: UpdateMeatBoxCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return {
      message: "Category updated",
      data: await this.catalogue.updateCategory(id, dto, file),
    };
  }

  @Delete("categories/:id")
  async deleteCategory(@Param("id") id: string) {
    return {
      message: "Category deleted",
      data: await this.catalogue.deleteCategory(id),
    };
  }

  @Post("options")
  @UseInterceptors(FileInterceptor("image", { limits: { fileSize: MAX_IMAGE_BYTES } }))
  async createOption(
    @Body() dto: CreateMeatBoxOptionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return {
      message: "Option created",
      data: await this.catalogue.createOption(dto, file),
    };
  }

  @Patch("options/:id")
  @UseInterceptors(FileInterceptor("image", { limits: { fileSize: MAX_IMAGE_BYTES } }))
  async updateOption(
    @Param("id") id: string,
    @Body() dto: UpdateMeatBoxOptionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return {
      message: "Option updated",
      data: await this.catalogue.updateOption(id, dto, file),
    };
  }

  @Delete("options/:id")
  async deleteOption(@Param("id") id: string) {
    return {
      message: "Option deleted",
      data: await this.catalogue.deleteOption(id),
    };
  }
}