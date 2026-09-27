import { Module } from "@nestjs/common";
import { ProductsService } from "./products.service.js";
import {
  AdminProductsController,
  PublicProductsController,
} from "./products.controller.js";
import { DatabaseService } from "../database/database.service.js";
import { CloudinaryService } from "../cloudinary/cloudinary.js";
import { PromotionFinderService } from "../promotions/promotion-finder.service.js";

@Module({
  controllers: [PublicProductsController, AdminProductsController],
  providers: [ProductsService, DatabaseService, PromotionFinderService, CloudinaryService],
  exports: [ProductsService],
})
export class ProductsModule {}