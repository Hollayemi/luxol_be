import { Module } from "@nestjs/common";
import { PaystackService } from "./paystack.service.js";
import { PaymentsController } from "./payments.controller.js";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../database/database.service.js";

@Module({
  controllers: [PaymentsController],
  providers: [PaystackService, ConfigService, DatabaseService],
  exports: [PaystackService],
})
export class PaymentsModule {}