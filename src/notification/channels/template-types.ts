// src/notifications/template-types.ts
import { NOTIFICATION_TEMPLATES, NotificationTemplateKey } from "./templates.js";

/** Extract `{{param}}` names from a single string literal. */
type ExtractParams<S extends string> =
  S extends `${string}{{${infer P}}}${infer Rest}`
    ? P | ExtractParams<Rest>
    : never;

/** Pull all `{{param}}` names out of one template's subject/message/url. */
type TemplateParams<K extends NotificationTemplateKey> =
  | ExtractParams<(typeof NOTIFICATION_TEMPLATES)[K]["subject"]>
  | ExtractParams<(typeof NOTIFICATION_TEMPLATES)[K]["message"]>
  | (K extends keyof typeof NOTIFICATION_TEMPLATES
      ? (typeof NOTIFICATION_TEMPLATES)[K] extends { url: infer U }
        ? U extends string
          ? ExtractParams<U>
          : never
        : never
      : never);

/** The context object for a given template key. All params REQUIRED. */
export type TemplateContext<K extends NotificationTemplateKey> = {
  [P in TemplateParams<K>]: string | number;
};

/** Optional extra keys (e.g. `location` even if not used in text). */
type WithOptionals<K extends NotificationTemplateKey, Extra extends string = never> =
  TemplateContext<K> & Partial<Record<Extra, string | number>>;

export type NotifyTemplateOptions<K extends NotificationTemplateKey> = {
  userId?: string;
  orderId?: string;
  subscriptionId?: string;
  context: TemplateContext<K>;
  channels?: readonly string[];
  metadata?: Record<string, unknown>;
};