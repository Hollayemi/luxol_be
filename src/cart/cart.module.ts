import { Module } from "@nestjs/common";
import { CartController } from "./cart.controller.js";
import { PromoCodesController } from "./promo-codes.controller.js";
import { CartService } from "./cart.service.js";
import { DatabaseService } from "../database/database.service.js";

@Module({
  controllers: [CartController, PromoCodesController],
  providers: [CartService, DatabaseService],
  exports: [CartService],
})
export class CartModule {}