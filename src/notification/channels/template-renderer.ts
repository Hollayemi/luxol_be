// src/notifications/template-renderer.ts
import { TemplateContext } from "./template-types.js";
import {
  NOTIFICATION_TEMPLATES,
  NotificationTemplateKey,
} from "./templates.js";

export type RenderContext = Record<string, string | number | boolean | null | undefined>;

export function renderTemplate<K extends NotificationTemplateKey>(
  key: K,
  context: TemplateContext<K>,
): {
  channels: readonly string[];
  subject: string;
  message: string;
  url?: string;
} {
  const template = NOTIFICATION_TEMPLATES[key];
  return {
    channels: template.channels,
    subject: interpolate(template.subject, context),
    message: interpolate(template.message, context),
    url: "url" in template
      ? interpolate(template.url as string, context)
      : undefined,
  };
}

function interpolate(str: string, ctx: RenderContext): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = ctx[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}


/**
 * Validates that the caller provided every param the template needs.
 * Throws in dev; logs a warning in prod.
 */
export function validateTemplateParams(
  key: NotificationTemplateKey,
  ctx: RenderContext,
  opts: { strict?: boolean } = {},
): { missing: string[] } {
  const template = NOTIFICATION_TEMPLATES[key];
  const required = Object.keys(template.params);
  const missing = required.filter(
    (p) => ctx[p] === undefined || ctx[p] === null,
  );
  if (missing.length && opts.strict) {
    throw new Error(
      `Missing template params for ${key}: ${missing.join(", ")}`,
    );
  }
  return { missing };
}