import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";
import { CloudinaryService } from "../cloudinary/cloudinary.js";
import { DatabaseService } from "../database/database.service.js";

@Module({
  controllers: [UsersController],
  providers: [UsersService, CloudinaryService, DatabaseService],
  exports: [UsersService],
})
export class UsersModule {}