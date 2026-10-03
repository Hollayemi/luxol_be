import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as webpush from "web-push";
import {
  NotificationChannelAdapter,
  SendPayload,
  SendResult,
} from "./channel.interface.js";
import { DatabaseService } from "../../database/database.service.js";

/**
 * Web Push via VAPID. Requires the frontend to have already registered a
 * service worker and POSTed its PushSubscription to /notifications/subscribe.
 *
 * `payload.to` here is the *userId*, not an endpoint — because a user can
 * have many browser endpoints.
 */
@Injectable()
export class WebPushAdapter implements NotificationChannelAdapter {
  readonly kind = "IN_APP" as const; // reuse IN_APP for web push
  private readonly logger = new Logger(WebPushAdapter.name);

  constructor(
    private config: ConfigService,
    private db: DatabaseService,
  ) {
    const publicKey = this.config.get<string>("VAPID_PUBLIC_KEY");
    const privateKey = this.config.get<string>("VAPID_PRIVATE_KEY");
    const subject = this.config.get<string>("VAPID_SUBJECT");

    if (publicKey && privateKey && subject) {
      // webpush.setVapidDetails(subject, publicKey, privateKey);
    } else {
      this.logger.warn("VAPID keys not configured — web push will no-op");
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>("VAPID_PUBLIC_KEY") &&
      this.config.get<string>("VAPID_PRIVATE_KEY"),
    );
  }

  async send(payload: SendPayload): Promise<SendResult> {
    const userId = payload.to;
    const subs = await this.db.webPushSubscription.findMany({
      where: { userId },
    });

    if (subs.length === 0) {
      // Not an error — the user just hasn't enabled push on any browser.
      return { ok: true, providerRef: "no-subscriptions" };
    }

    const json = JSON.stringify({
      title: payload.subject ?? "Luxol Market",
      body: payload.body,
      url: payload.url ?? "/",
      metadata: payload.metadata ?? {},
    });

    let sentCount = 0;
    const failures: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            json,
          );
          sentCount++;
          await this.db.webPushSubscription.update({
            where: { id: sub.id },
            data: { lastUsedAt: new Date() },
          });
        } catch (err: any) {
          // 404/410 → subscription is dead, delete it
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await this.db.webPushSubscription.delete({ where: { id: sub.id } });
          }
          failures.push(`${sub.endpoint.slice(0, 40)}…: ${err?.message}`);
        }
      }),
    );

    if (sentCount === 0) {
      return { ok: false, error: failures.join("; ") || "All pushes failed" };
    }
    return { ok: true, providerRef: `${sentCount}/${subs.length}` };
  }
}