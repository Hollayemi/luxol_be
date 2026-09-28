import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PlaceOrderDto } from "./dto/place-order.dto.js";
import { ListOrdersDto } from "./dto/list-orders.dto.js";
import { CancelOrderDto } from "./dto/cancel-order.dto.js";
import { RateOrderDto } from "./dto/rate-order.dto.js";
import { RequestReturnDto } from "./dto/request-return.dto.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { OrdersService } from "./orders.service.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";

@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post()
  async place(@CurrentUser() u: { id: string }, @Body() dto: PlaceOrderDto) {
    return {
      message: "Order placed",
      data: await this.orders.placeOrder(u.id, dto),
    };
  }

  @Get()
  async list(@CurrentUser() u: { id: string }, @Query() dto: ListOrdersDto) {
    console.log("=========>")
    return { message: "OK", data: await this.orders.list(u.id, dto) };
  }

  
  @Get(":id")
  async detail(@CurrentUser() u: { id: string }, @Param("id") id: string) {
    return { message: "OK", data: await this.orders.findOne(u.id, id) };
  }

  @Get(":id/tracking")
  async tracking(@CurrentUser() u: { id: string }, @Param("id") id: string) {
    return { message: "OK", data: await this.orders.tracking(u.id, id) };
  }

  @Post(":id/cancel")
  async cancel(
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return {
      message: "Order cancelled",
      data: await this.orders.cancel(u.id, id, dto),
    };
  }

  @Post(":id/rating")
  async rate(
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body() dto: RateOrderDto,
  ) {
    return {
      message: "Thanks for rating",
      data: await this.orders.rate(u.id, id, dto),
    };
  }

  @Post(":id/return")
  async requestReturn(
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body() dto: RequestReturnDto,
  ) {
    return {
      message: "Return requested",
      data: await this.orders.requestReturn(u.id, id, dto),
    };
  }

  @Post(":id/reorder")
  async reorder(@CurrentUser() u: { id: string }, @Param("id") id: string) {
    return {
      message: "Items added to cart",
      data: await this.orders.reorder(u.id, id),
    };
  }

  @Post(":id/payments/:reference/verify")
  async verify(
    @CurrentUser() u: { id: string },
    @Param("reference") reference: string,
  ) {
    return {
      message: "OK",
      data: await this.orders.verifyPayment(u.id, reference),
    };
  }
}