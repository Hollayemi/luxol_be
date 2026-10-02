import {
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role } from "../generated/prisma/client.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { AdminOverviewService } from "./admin-overview.service.js";
import { GetTopProductsDto } from "./dto/get-top-products.dto.js";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller("admin/overview")
export class AdminOverviewController {
  constructor(private svc: AdminOverviewService) {}

  @Get()
  async summary() {
    return { message: "OK", data: await this.svc.summary() };
  }

  @Get("top-products")
  async topProducts(@Query() dto: GetTopProductsDto) {
    return { message: "OK", data: await this.svc.topProducts(dto) };
  }
}