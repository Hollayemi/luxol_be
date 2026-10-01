import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";
import { CloudinaryService } from "../cloudinary/cloudinary.js";
import { DatabaseService } from "../database/database.service.js";
import { AdminCustomersService } from "./admin/admin-customers.service.js";
import { AdminCustomersController } from "./admin/admin-customers.controller.js";

@Module({
  controllers: [UsersController, AdminCustomersController],
  providers: [UsersService, CloudinaryService, DatabaseService, AdminCustomersService],
  exports: [UsersService],
})
export class UsersModule {}