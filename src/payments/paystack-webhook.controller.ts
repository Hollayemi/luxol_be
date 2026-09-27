import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { OrdersService } from "../orders/orders.service.js";
import { PaystackWebhookGuard } from "./paystack-webhook.guard.js";

@Controller("webhooks/paystack")
export class PaystackWebhookController {
  constructor(private orders: OrdersService) {}

  @Post()
  @UseGuards(PaystackWebhookGuard)
  async handle(@Body() event: any) {
    await this.orders.handleWebhook(event);
    return { received: true };
  }
}