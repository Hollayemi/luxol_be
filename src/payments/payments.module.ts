import { Module } from "@nestjs/common";
import { PaystackService } from "./paystack.service.js";

@Module({
  providers: [PaystackService],
  exports: [PaystackService],
})
export class PaymentsModule {}