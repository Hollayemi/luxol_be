import { Module } from "@nestjs/common";
import { CategoriesService } from "./categories.service.js";
import {
  AdminCategoriesController,
  PublicCategoriesController,
} from "./categories.controller.js";
import { DatabaseService } from "../database/database.service.js";
import { CloudinaryService } from "../cloudinary/cloudinary.js";

@Module({
  controllers: [PublicCategoriesController, AdminCategoriesController],
  providers: [CategoriesService, DatabaseService, CloudinaryService],
  exports: [CategoriesService],
})
export class CategoriesModule {}