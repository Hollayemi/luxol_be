import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsService } from "./notifications.service.js";
import { EmailZohoAdapter } from "./channels/email-zoho.adapter.js";
import { SmsTermiiAdapter } from "./channels/sms-termii.adapter.js";
import { WebPushAdapter } from "./channels/webpush.adapter.js";
import { DatabaseService } from "../database/database.service.js";
import { ConfigService } from "@nestjs/config";

@Module({
  controllers: [NotificationsController],
  providers: [
    DatabaseService,
    ConfigService,
    NotificationsService,
    EmailZohoAdapter,
    SmsTermiiAdapter,
    WebPushAdapter,
  ],
  exports: [NotificationsService, EmailZohoAdapter, SmsTermiiAdapter, WebPushAdapter],
})
export class NotificationModule {}