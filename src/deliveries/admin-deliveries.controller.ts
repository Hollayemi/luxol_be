import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { GetDeliveryCalendarDto } from "./dto/get-delivery-calendar.dto.js";
import { ListDeliveriesDto } from "./dto/list-deliveries.dto.js";
import { UpdateDeliveryStatusDto } from "./dto/update-delivery-status.dto.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { Role } from "../generated/prisma/enums.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { AdminDeliveriesService } from "./admin-deliveries.service.js";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller("admin/deliveries")
export class AdminDeliveriesController {
  constructor(
    private svc: AdminDeliveriesService
  ) {}

  @Get("calendar")
  async calendar(@Query() dto: GetDeliveryCalendarDto) {
    return { message: "OK", data: await this.svc.calendar(dto) };
  }

  @Get()
  async list(@Query() dto: ListDeliveriesDto) {
    return { message: "OK", data: await this.svc.list(dto) };
  }

  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return {
      message: "Delivery updated",
      data: await this.svc.updateStatus(id, dto),
    };
  }
}