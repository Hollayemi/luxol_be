import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { CartService } from "./cart.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { SyncCartDto, SyncCartItemDto } from "./dto/sync-cart.dto.js";
import { MergeCartDto } from "./dto/merge-cart.dto.js";
import { ValidateCartDto } from "./dto/validate-cart.dto.js";

@UseGuards(JwtAuthGuard)
@Controller("cart")
export class CartController {
  constructor(private cart: CartService) {}

  @Get()
  async get(@CurrentUser() user: { id: string }) {
    return { message: "OK", data: await this.cart.getCart(user.id) };
  }

  @Put()
  async sync(@CurrentUser() user: { id: string }, @Body() dto: SyncCartDto) {
    return {
      message: "Cart saved",
      data: await this.cart.syncCart(user.id, dto),
    };
  }

  @Post("merge")
  async merge(@CurrentUser() user: { id: string }, @Body() dto: MergeCartDto) {
    return {
      message: "Cart merged",
      data: await this.cart.mergeCart(user.id, dto),
    };
  }

  @Post("validate")
  async validate(@Body() dto: ValidateCartDto) {
    return { message: "OK", data: await this.cart.validateCart(dto) };
  }
}