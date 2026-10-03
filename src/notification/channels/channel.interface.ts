export type NotificationChannelKind = "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP";

export type SendPayload = {
  /** Recipient. Email for EMAIL, phone (E.164) for SMS/WHATSAPP, userId for IN_APP. */
  to: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
  /** Optional — used for in-app deep-linking, browser push, etc. */
  url?: string;
};

export type SendResult =
  | { ok: true; providerRef?: string }
  | { ok: false; error: string };

export interface NotificationChannelAdapter {
  readonly kind: NotificationChannelKind;
  /** True when the adapter is configured (env vars present). */
  isConfigured(): boolean;
  send(payload: SendPayload): Promise<SendResult>;
}