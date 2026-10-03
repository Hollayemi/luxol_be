import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
    NotificationChannelAdapter,
    SendPayload,
    SendResult,
} from "./channel.interface.js";

/**
 * Termii SMS. Docs: https://developers.termii.com/messaging
 * Uses the /api/sms/send endpoint with a sender ID.
 */
@Injectable()
export class SmsTermiiAdapter implements NotificationChannelAdapter {
    readonly kind = "SMS" as const;
    private readonly logger = new Logger(SmsTermiiAdapter.name);

    constructor(private config: ConfigService) { }

    isConfigured(): boolean {
        return Boolean(
            this.config.get<string>("TERMII_API_KEY") &&
            this.config.get<string>("TERMII_SENDER_ID"),
        );
    }

    async send(payload: SendPayload): Promise<SendResult> {
        const apiKey = this.config.get<string>("TERMII_API_KEY");
        const senderId = this.config.get<string>("TERMII_SENDER_ID");
        const base = this.config.get<string>("TERMII_BASE_URL") ?? "https://api.ng.termii.com";

        if (!apiKey || !senderId) {
            return { ok: false, error: "Termii not configured" };
        }

        // Termii wants E.164 without the "+" (2348..., 2335...)
        const to = normalizeForTermii(payload.to);
        if (!to) return { ok: false, error: `Invalid phone number: ${payload.to}` };

        try {
            const res = await fetch(`${base}/api/sms/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to,
                    from: senderId,
                    sms: payload.body,
                    type: "plain",
                    channel: "generic",
                    api_key: apiKey,
                }),
            });

            const json: any = await res.json().catch(() => ({}));

            if (!res.ok) {
                this.logger.error(`Termii send failed: ${res.status} ${JSON.stringify(json)}`);
                return {
                    ok: false,
                    error: json?.message ?? `Termii HTTP ${res.status}`,
                };
            }

            return {
                ok: true,
                providerRef: json?.message_id ?? json?.messageId ?? undefined,
            };
        } catch (err: any) {
            this.logger.error(`Termii network error: ${err?.message}`);
            return { ok: false, error: err?.message ?? "Termii send failed" };
        }
    }
}

/** "08012345678" or "+2348012345678" → "2348012345678". */
function normalizeForTermii(phone: string): string | null {
    let digits = phone.replace(/\D+/g, "");
    if (digits.startsWith("0")) digits = "234" + digits.slice(1);
    if (digits.length < 10) return null;
    return digits;
}