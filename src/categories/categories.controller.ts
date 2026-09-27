import { BadRequestException, Controller, Get, Param, UploadedFile, UseInterceptors } from "@nestjs/common";
import { CategoriesService } from "./categories.service.js";

@Controller("catalog/categories")
export class PublicCategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get()
  async list() {
    return { message: "OK", data: await this.categories.listPublic() };
  }

  @Get(":slug")
  async detail(@Param("slug") slug: string) {
    return { message: "OK", data: await this.categories.findBySlug(slug) };
  }
}


import {
  Body,
  Delete,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CreateCategoryDto } from "./dto/create-category.dto.js";
import { UpdateCategoryDto } from "./dto/update-category.dto.js";
import { ListCategoriesDto } from "./dto/list-categories.dto.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Role } from "../generated/prisma/enums.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { CloudinaryService } from "../cloudinary/cloudinary.js";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller("admin/inventory/categories")

export class AdminCategoriesController {
  constructor(
    private categories: CategoriesService,
    private readonly cloudinary: CloudinaryService,
  ) {}


  @Get()
  async list(@Query() dto: ListCategoriesDto) {
    return { message: "OK", data: await this.categories.listAdmin(dto) };
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    return { message: "OK", data: await this.categories.findOne(id) };
  }

  @Post()
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  async create(@Body() dto: CreateCategoryDto, @UploadedFile() file?: Express.Multer.File,) {
    if (!file) throw new BadRequestException('Category Image Required');
    const url = await this.cloudinary.upload(file);
    return {
      message: "Category created",
      data: await this.categories.create({...dto, displayOrder: Number(dto.displayOrder), image: url}),
    };
  }

  @Patch(":id")
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  async update(@Param("id") id: string, @Body() dto: UpdateCategoryDto,  @UploadedFile() file?: Express.Multer.File) {
    
    if (file) {
      const url = await this.cloudinary.upload(file);
      dto.image = url
    }

    if(dto.displayOrder) dto.displayOrder = Number(dto.displayOrder)
    console.log(dto)
    return {
      message: "Category updated",
      data: await this.categories.update(id, dto),
    };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return {
      message: "Category deleted",
      data: await this.categories.remove(id),
    };
  }
}