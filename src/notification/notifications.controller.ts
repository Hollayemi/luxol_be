import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { NotificationsService } from "./notifications.service.js";

@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  /** The bell dropdown. */
  @Get()
  async list(
    @CurrentUser() u: { id: string },
    @Query("limit") limit?: string,
  ) {
    return {
      message: "OK",
      data: {
        items: await this.svc.listForUser(u.id, {
          limit: limit ? parseInt(limit, 10) : 20,
        }),
      },
    };
  }

  @Get("unread-count")
  async unread(@CurrentUser() u: { id: string }) {
    return {
      message: "OK",
      data: { count: await this.svc.unreadCount(u.id) },
    };
  }

  @Post(":id/opened")
  async markOpened(
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
  ) {
    return {
      message: "Marked opened",
      data: await this.svc.markOpened(u.id, id),
    };
  }

  @Post("mark-all-opened")
  async markAll(@CurrentUser() u: { id: string }) {
    await this.svc.markAllOpened(u.id);
    return { message: "OK", data: null };
  }

  /** Browser push registration. Called by the frontend after `PushManager.subscribe()`. */
  @Post("push/subscribe")
  async subscribePush(
    @CurrentUser() u: { id: string },
    @Body()
    body: { endpoint: string; keys: { p256dh: string; auth: string } },
    @Headers("user-agent") ua?: string,
  ) {
    await this.svc.registerPushSubscription(u.id, body, ua);
    return { message: "Subscribed", data: null };
  }

  @Post("push/unsubscribe")
  async unsubscribePush(
    @CurrentUser() u: { id: string },
    @Body() body: { endpoint: string },
  ) {
    await this.svc.unregisterPushSubscription(u.id, body.endpoint);
    return { message: "Unsubscribed", data: null };
  }
}