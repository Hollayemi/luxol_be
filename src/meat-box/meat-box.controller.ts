import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { MeatBoxService } from "./meat-box.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { CreateMeatBoxOrderDto } from "./dto/create-meat-box-order.dto.js";
import { CancelMeatBoxOrderDto } from "./dto/cancel-meat-box-order.dto.js";

// ─── Public catalogue ───────────────────────────────────────
@Controller("meat-box")
export class PublicMeatBoxController {
  constructor(private svc: MeatBoxService) {}

  @Get("options")
  async options() {
    return { message: "OK", data: await this.svc.options() };
  }
}

// ─── Customer orders ────────────────────────────────────────
@UseGuards(JwtAuthGuard)
@Controller("meat-box/orders")
export class MeatBoxOrdersController {
  constructor(private svc: MeatBoxService) {}

  @Post()
  async create(
    @CurrentUser() u: { id: string },
    @Body() dto: CreateMeatBoxOrderDto,
  ) {
    return {
      message: "Order created — awaiting weighing",
      data: await this.svc.createOrder(u.id, dto),
    };
  }

  @Get()
  async listMine(@CurrentUser() u: { id: string }) {
    return { message: "OK", data: await this.svc.listMine(u.id) };
  }

  @Get(":id")
  async findOne(
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
  ) {
    return { message: "OK", data: await this.svc.findMine(u.id, id) };
  }


  @Post(":id/cancel")
  async cancel(
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body() dto: CancelMeatBoxOrderDto,
  ) {
    return {
      message: "Order cancelled",
      data: await this.svc.cancel(u.id, id, dto),
    };
  }
}