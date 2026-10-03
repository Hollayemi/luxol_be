import { Injectable, Logger } from "@nestjs/common";
import {
    NotificationChannel as PrismaNotificationChannel,
    NotificationStatus,
    Prisma,
} from "../generated/prisma/client.js";
import { DatabaseService } from "../database/database.service.js";
import {
    NotificationChannelAdapter,
    NotificationChannelKind,
    SendPayload,
} from "./channels/channel.interface.js";
import { EmailZohoAdapter } from "./channels/email-zoho.adapter.js";
import { SmsTermiiAdapter } from "./channels/sms-termii.adapter.js";
import { WebPushAdapter } from "./channels/webpush.adapter.js";
import { NOTIFICATION_TEMPLATES, NotificationTemplateKey } from "./channels/templates.js";
import { renderTemplate } from "./channels/template-renderer.js";
import { NotifyTemplateOptions } from "./channels/template-types.js";

export type NotifyInput = {
    /** User id (required for IN_APP; recommended for all so the row links). */
    userId?: string;
    orderId?: string;
    subscriptionId?: string;
    /** One or more channels. Duplicates are collapsed. */
    channels: NotificationChannelKind[];
    subject?: string;
    body: string;
    /** Optional CTA URL for email buttons / browser push click target. */
    url?: string;
    metadata?: Record<string, unknown>;
    /**
     * Override the recipient per channel.
     * If omitted, the user's email / phone is used (looked up from the DB).
     */
    recipients?: {
        EMAIL?: string;
        SMS?: string;
        WHATSAPP?: string;
        IN_APP?: string;
    };
};

export type NotifyResult = {
    results: Array<{
        channel: NotificationChannelKind;
        notificationId: string;
        ok: boolean;
        providerRef?: string;
        error?: string;
    }>;
};

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private adapters: Map<NotificationChannelKind, NotificationChannelAdapter>;

    constructor(
        private db: DatabaseService,
        private email: EmailZohoAdapter,
        private sms: SmsTermiiAdapter,
        private webpush: WebPushAdapter,
    ) {
        this.adapters = new Map<NotificationChannelKind, NotificationChannelAdapter>([
            ["EMAIL", email],
            ["SMS", sms],
            ["IN_APP", webpush],
        ]);
    }

    // ─── Main entry point ───────────────────────────────────────

    async notify(input: NotifyInput): Promise<NotifyResult> {
        const channels = [...new Set(input.channels)];
        if (channels.length === 0) {
            return { results: [] };
        }

        // Look up the user once if we need their contact details
        const user = input.userId
            ? await this.db.user.findUnique({
                where: { id: input.userId },
                select: { id: true, email: true, phone: true },
            })
            : null;

        const results: NotifyResult["results"] = [];

        for (const channel of channels) {
            // Resolve recipient for this channel
            const to = this.resolveRecipient(channel, input, user);
            if (!to) {
                this.logger.warn(
                    `No recipient for channel ${channel} (user ${input.userId ?? "anonymous"}) — skipping`,
                );
                continue;
            }

            // Create the DB row first, in PENDING state
            const row = await this.db.notification.create({
                data: {
                    userId: input.userId ?? null,
                    orderId: input.orderId ?? null,
                    subscriptionId: input.subscriptionId ?? null,
                    channel: channel as PrismaNotificationChannel,
                    status: NotificationStatus.PENDING,
                    subject: input.subject ?? null,
                    body: input.body,
                    metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
                },
            });

            // Dispatch
            const adapter = this.adapters.get(channel);
            if (!adapter) {
                await this.markFailed(row.id, `No adapter registered for ${channel}`);
                results.push({
                    channel,
                    notificationId: row.id,
                    ok: false,
                    error: `No adapter for ${channel}`,
                });
                continue;
            }

            if (!adapter.isConfigured()) {
                await this.markFailed(row.id, `${channel} adapter not configured`);
                results.push({
                    channel,
                    notificationId: row.id,
                    ok: false,
                    error: `${channel} adapter not configured`,
                });
                continue;
            }

            const payload: SendPayload = {
                to,
                subject: input.subject,
                body: input.body,
                metadata: input.metadata,
                url: input.url,
            };

            // Adapters never throw (they return { ok: false }) — but guard anyway
            let result;
            try {
                result = await adapter.send(payload);
            } catch (err: any) {
                result = { ok: false as const, error: err?.message ?? "Send threw" };
            }

            if (result.ok) {
                await this.db.notification.update({
                    where: { id: row.id },
                    data: {
                        status: NotificationStatus.SENT,
                        sentAt: new Date(),
                        metadata: {
                            ...(input.metadata ?? {}),
                            providerRef: result.providerRef ?? null,
                        } as Prisma.InputJsonValue,
                    },
                });
            } else {
                await this.markFailed(row.id, result.error);
            }

            results.push({
                channel,
                notificationId: row.id,
                ok: result.ok,
                providerRef: result.ok ? result.providerRef : undefined,
                error: result.ok ? undefined : result.error,
            });
        }

        return { results };
    }

    async notifyTemplate<K extends NotificationTemplateKey>(
        key: K,
        opts: NotifyTemplateOptions<K>,
    ): Promise<NotifyResult> {
        const rendered = renderTemplate(key, opts.context);

        // Runtime safety net — dev throws, prod logs
        const template = NOTIFICATION_TEMPLATES[key];
        const missing = Object.keys(template.params).filter(
            (p) =>
                (opts.context as Record<string, unknown>)[p] === undefined ||
                (opts.context as Record<string, unknown>)[p] === null,
        );
        if (missing.length) {
            const msg = `Template ${key} missing params: ${missing.join(", ")}`;
            if (process.env.NODE_ENV !== "production") {
                throw new Error(msg);
            }
            this.logger.error(msg);
        }

        return this.notify({
            userId: opts.userId,
            orderId: opts.orderId,
            subscriptionId: opts.subscriptionId,
            channels: (opts.channels ?? rendered.channels) as any,
            subject: rendered.subject,
            body: rendered.message,
            url: rendered.url,
            metadata: { type: key, ...opts.metadata },
        });
    }


    // ─── In-app helpers (the bell icon) ────────────────────────

    async listForUser(userId: string, opts: { limit?: number } = {}) {
        const rows = await this.db.notification.findMany({
            where: { userId, channel: "IN_APP" },
            orderBy: { createdAt: "desc" },
            take: opts.limit ?? 20,
        });
        return rows.map((r) => this.serialize(r));
    }

    async unreadCount(userId: string) {
        return this.db.notification.count({
            where: { userId, channel: "IN_APP", isOpened: false },
        });
    }

    async markOpened(userId: string, id: string) {
        const row = await this.db.notification.findFirst({
            where: { id, userId, channel: "IN_APP" },
        });
        if (!row) return null;
        await this.db.notification.update({
            where: { id },
            data: { isOpened: true },
        });
        return this.serialize({ ...row, isOpened: true });
    }

    async markAllOpened(userId: string) {
        await this.db.notification.updateMany({
            where: { userId, channel: "IN_APP", isOpened: false },
            data: { isOpened: true },
        });
    }

    // ─── Web push subscription registration ────────────────────

    async registerPushSubscription(
        userId: string,
        sub: { endpoint: string; keys: { p256dh: string; auth: string } },
        userAgent?: string,
    ) {
        await this.db.webPushSubscription.upsert({
            where: { endpoint: sub.endpoint },
            update: {
                userId,
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth,
                userAgent: userAgent ?? null,
            },
            create: {
                userId,
                endpoint: sub.endpoint,
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth,
                userAgent: userAgent ?? null,
            },
        });
    }

    async unregisterPushSubscription(userId: string, endpoint: string) {
        await this.db.webPushSubscription.deleteMany({
            where: { userId, endpoint },
        });
    }

    // ─── Internals ──────────────────────────────────────────────

    private resolveRecipient(
        channel: NotificationChannelKind,
        input: NotifyInput,
        user: { id: string; email: string; phone: string | null } | null,
    ): string | null {
        // Explicit override wins
        const explicit = input.recipients?.[channel];
        if (explicit) return explicit;

        if (channel === "EMAIL") return user?.email ?? null;
        if (channel === "SMS" || channel === "WHATSAPP") return user?.phone ?? null;
        if (channel === "IN_APP") return user?.id ?? null;

        return null;
    }

    private async markFailed(id: string, reason: string) {
        await this.db.notification.update({
            where: { id },
            data: {
                status: NotificationStatus.FAILED,
                failureReason: reason.slice(0, 500),
            },
        });
    }

    private serialize(row: {
        id: string;
        subject: string | null;
        body: string;
        metadata: unknown;
        isOpened: boolean;
        createdAt: Date;
    }) {
        return {
            id: row.id,
            subject: row.subject,
            body: row.body,
            metadata: row.metadata ?? {},
            isOpened: row.isOpened,
            createdAt: row.createdAt.toISOString(),
        };
    }
}