import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module.js";
import { OrdersController } from "./orders.controller.js";
import { PaystackWebhookController } from "../payments/paystack-webhook.controller.js";
import { OrdersService } from "./orders.service.js";
import { DatabaseService } from "../database/database.service.js";
import { ConfigService } from "@nestjs/config";
import { PaystackService } from "../payments/paystack.service.js";
import { AdminOrdersService } from "./admin-orders.service.js";
import { AdminOrdersController } from "./admin-orders.controller.js";

@Module({
  imports: [PaymentsModule],
  controllers: [OrdersController, PaystackWebhookController, AdminOrdersController],
  providers: [OrdersService, DatabaseService, ConfigService, PaystackService, AdminOrdersService],
  exports: [OrdersService, AdminOrdersService],
})
export class OrdersModule {}