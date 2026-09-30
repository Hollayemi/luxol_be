import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ListAdminOrdersDto } from "./dto/list-admin-orders.dto.js";
import { GetAdminOrderStatsDto } from "./dto/get-admin-order-stats.dto.js";
import { UpdateAdminOrderStatusDto } from "./dto/update-admin-order-status.dto.js";
import { CancelAdminOrderDto } from "./dto/cancel-admin-order.dto.js";
import { AdminOrdersService } from "./admin-orders.service.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { Role } from "../generated/prisma/enums.js";
import { Roles } from "../auth/decorators/roles.decorator.js";

@UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller("admin/orders")
export class AdminOrdersController {
  constructor(private orders: AdminOrdersService) {}

  @Get("stats")
  async stats(@Query() dto: GetAdminOrderStatsDto) {
    return { message: "OK", data: await this.orders.stats(dto) };
  }

  @Get()
  async list(@Query() dto: ListAdminOrdersDto) {
    return { message: "OK", data: await this.orders.list(dto) };
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    return { message: "OK", data: await this.orders.findOne(id) };
  }

  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateAdminOrderStatusDto,
  ) {
    return {
      message: "Order status updated",
      data: await this.orders.updateStatus(id, dto),
    };
  }

  @Post(":id/cancel")
  async cancel(@Param("id") id: string, @Body() dto: CancelAdminOrderDto) {
    return {
      message: "Order cancelled",
      data: await this.orders.cancel(id, dto),
    };
  }
}