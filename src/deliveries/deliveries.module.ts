import { Module } from "@nestjs/common";
import { AdminDeliveriesController } from "./admin-deliveries.controller.js";
import { AdminDeliveriesService } from "./admin-deliveries.service.js";
import { DatabaseService } from "../database/database.service.js";

@Module({
  controllers: [AdminDeliveriesController],
  providers: [AdminDeliveriesService, DatabaseService],

})
export class DeliveriesModule {}