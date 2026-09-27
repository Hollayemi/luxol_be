import { Module } from "@nestjs/common";
import { PromotionsController } from "./promotion.controller.js";
import { PromotionsService } from "./promotion.service.js";
import { DatabaseService } from "../database/database.service.js";
import { PromotionFinderService } from "./promotion-finder.service.js";

@Module({
  controllers: [PromotionsController],
  providers: [PromotionsService, PromotionFinderService, DatabaseService],
})
export class PromotionsModule {}