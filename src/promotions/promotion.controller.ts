import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { Role } from "../generated/prisma/enums.js";
import { PromotionsService } from "./promotion.service.js";
import { ListPromotionsDto } from "./dto/list-promotion.dto.js";
import { CreatePromotionDto } from "./dto/create-promotions.dto.js";
import { UpdatePromotionDto } from "./dto/update-promotion.dto.js";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller("admin/promotions")
export class PromotionsController {
  constructor(private promotions: PromotionsService) {}

  @Get("stats")
  async stats() {
    return { message: "OK", data: await this.promotions.stats() };
  }

  @Get()
  async list(@Query() dto: ListPromotionsDto) {
    return { message: "OK", data: await this.promotions.list(dto) };
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return { message: "OK", data: await this.promotions.findOne(id) };
  }

  @Post()
  async create(@Body() dto: CreatePromotionDto) {
    return { message: "Promotion created", data: await this.promotions.create(dto) };
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdatePromotionDto) {
    return {
      message: "Promotion updated",
      data: await this.promotions.update(id, dto),
    };
  }

  @Post(":id/pause")
  async pause(@Param("id") id: string) {
    return { message: "Promotion paused", data: await this.promotions.pause(id) };
  }

  @Post(":id/resume")
  async resume(@Param("id") id: string) {
    return { message: "Promotion resumed", data: await this.promotions.resume(id) };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return { message: "Promotion deleted", data: await this.promotions.remove(id) };
  }
}