import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module.js";
import { OrdersController } from "./orders.controller.js";
import { PaystackWebhookController } from "../payments/paystack-webhook.controller.js";
import { OrdersService } from "./orders.service.js";
import { DatabaseService } from "../database/database.service.js";
import { ConfigService } from "@nestjs/config";
import { PaystackService } from "../payments/paystack.service.js";

@Module({
  imports: [PaymentsModule],
  controllers: [OrdersController, PaystackWebhookController],
  providers: [OrdersService, DatabaseService, ConfigService, PaystackService],
  exports: [OrdersService],
})
export class OrdersModule {}