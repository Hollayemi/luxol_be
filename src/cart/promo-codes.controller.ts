import { Body, Controller, Post } from "@nestjs/common";
import { CartService } from "./cart.service.js";
import { ValidatePromoDto } from "./dto/validate-promo.dto.js";

@Controller("promo-codes")
export class PromoCodesController {
  constructor(private cart: CartService) {}

  @Post("validate")
  async validate(@Body() dto: ValidatePromoDto) {
    return { message: "OK", data: await this.cart.validatePromo(dto) };
  }
}