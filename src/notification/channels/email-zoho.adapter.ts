import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import {
  NotificationChannelAdapter,
  SendPayload,
  SendResult,
} from "./channel.interface.js";

@Injectable()
export class EmailZohoAdapter implements NotificationChannelAdapter {
  readonly kind = "EMAIL" as const;
  private readonly logger = new Logger(EmailZohoAdapter.name);
  private transporter: Transporter | null = null;

  // Brand constants
  private readonly BRAND_GREEN = "#0b5a0e";
  private readonly BRAND_AMBER = "#f79a0b";
  private readonly SUPPORT_EMAIL = "support@luxol.ng";
  private readonly SITE_URL = "https://luxol.ng";

  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly logoUrl: string;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>("ZOHO_SMTP_HOST") ?? "smtp.zoho.com";
    const port = Number(this.config.get<string>("ZOHO_SMTP_PORT") ?? 465);
    const user = this.config.get<string>("ZOHO_SMTP_USER");
    const pass = this.config.get<string>("ZOHO_SMTP_PASS");
    const from = this.config.get<string>("ZOHO_FROM");
    const name = this.config.get<string>("ZOHO_FROM_NAME") ?? "Luxol Market";

    this.fromAddress = from ?? user ?? "";
    this.fromName = name;
    this.logoUrl =
      this.config.get<string>("LUXOL_LOGO_URL") ??
      "https://luxol.ng/logo.png"; // self-hosted is best

    if (user && pass && from) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        // Connection pooling — reuses connections, faster & less spammy
        pool: true,
        maxConnections: 3,
        maxMessages: 100,
        // Fail fast instead of hanging
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
        // Zoho requires TLS
        requireTLS: port === 587,
      });
    } else {
      this.logger.warn(
        "Zoho SMTP not configured — email adapter will no-op. Set ZOHO_SMTP_USER, ZOHO_SMTP_PASS, ZOHO_FROM.",
      );
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(payload: SendPayload): Promise<SendResult> {
    if (!this.transporter) {
      return { ok: false, error: "Email adapter not configured" };
    }

    const from = `"${this.fromName}" <${this.fromAddress}>`;
    const subject = payload.subject ?? "Luxol Market";
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@luxol.ng>`;

    this.logger.debug(`Sending email to ${payload.to} — ${subject}`);

    try {
      const info = await this.transporter.sendMail({
        from,
        to: payload.to,
        replyTo: `"Luxol Support" <${this.SUPPORT_EMAIL}>`,
        subject,
        text: this.toPlainText(payload),
        html: this.toHtml(payload),
        headers: {
          // Helps Gmail recognize this as transactional
          "X-Entity-Ref-ID": (payload.metadata?.type as string) ?? "luxol-tx",
          // Required by Gmail/Yahoo bulk sender rules (2024+)
          "List-Unsubscribe": `<mailto:unsubscribe@luxol.ng?subject=unsubscribe>, <${this.SITE_URL}/unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          // Distinguishes transactional from bulk
          Precedence: "transactional",
          "Auto-Submitted": "auto-generated",
        },
        // Zoho honors this
        messageId,
      });
      return { ok: true, providerRef: info.messageId };
    } catch (err: any) {
      this.logger.error(`Zoho send failed: ${err?.message}`);
      return { ok: false, error: err?.message ?? "Email send failed" };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PLAIN TEXT — Gmail compares this to HTML; keep them aligned
  // ─────────────────────────────────────────────────────────────
  private toPlainText(payload: SendPayload): string {
    const lines: string[] = [];
    if (payload.subject) lines.push(payload.subject.toUpperCase(), "");
    lines.push(payload.body);

    if (payload.url) {
      lines.push("", "View details:", payload.url);
    }

    lines.push(
      "",
      "—",
      "Luxol Market — fresh meat, groceries & livestock, delivered.",
      `Support: ${this.SUPPORT_EMAIL}`,
      `Unsubscribe: ${this.SITE_URL}/unsubscribe`,
    );

    return lines.join("\n");
  }

  // ─────────────────────────────────────────────────────────────
  // HTML — bulletproof, table-based, Gmail/Outlook safe
  // ─────────────────────────────────────────────────────────────
  private toHtml(payload: SendPayload): string {
    const G = this.BRAND_GREEN;
    const A = this.BRAND_AMBER;
    const logo = this.logoUrl;

    const esc = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // Paragraph-aware body
    const bodyHtml = esc(payload.body)
      .split(/\n{2,}/)
      .map(
        (para) =>
          `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f3f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">${para.replace(
            /\n/g,
            "<br>",
          )}</p>`,
      )
      .join("");

    const year = new Date().getFullYear();

    return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(payload.subject ?? "Luxol Market")}</title>
<!--[if mso]>
<style>table,td,div,p,a{font-family:Arial,Helvetica,sans-serif !important}</style>
<![endif]-->
<style>
  @media (max-width:600px){
    .px{padding-left:24px !important;padding-right:24px !important}
    .h1{font-size:18px !important}
    .btn-td a{display:block !important;width:100% !important;box-sizing:border-box !important}
  }
  a{text-decoration:none}
</style>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased">

  <!-- Preheader (inbox preview) -->
  <div style="display:none;font-size:1px;color:#f4f5f7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
    ${esc(payload.subject ?? "Update from Luxol Market")}
    ${"&nbsp;&zwnj;".repeat(60)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7">
    <tr>
      <td align="center" style="padding:32px 16px">

        <!-- CARD -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">

          <!-- Accent bar -->
          <tr><td height="6" style="height:6px;line-height:6px;font-size:0;background-color:${G}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="60%" height="6" style="background-color:${G};line-height:6px;font-size:0">&nbsp;</td>
              <td width="40%" height="6" style="background-color:${A};line-height:6px;font-size:0">&nbsp;</td>
            </tr></table>
          </td></tr>

          <!-- HEADER -->
          <tr><td align="center" class="px" style="padding:36px 40px 20px">
            <img src="${logo}" alt="Luxol Market" width="120" height="120" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:120px">
            <p style="margin:14px 0 0;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${A};font-family:Arial,sans-serif">Luxol Market</p>
          </td></tr>

          <tr><td class="px" style="padding:0 40px"><div style="height:1px;line-height:1px;font-size:0;background-color:#ececec">&nbsp;</div></td></tr>

          <!-- BODY -->
          <tr><td class="px" style="padding:32px 40px 8px">
            ${
              payload.subject
                ? `<h1 class="h1" style="margin:0 0 20px;font-size:20px;font-weight:700;color:${G};line-height:1.35;letter-spacing:-0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">${esc(
                    payload.subject,
                  )}</h1>`
                : ""
            }
            ${bodyHtml}

            ${
              payload.url
                ? `
            <!-- BULLETPROOF CTA BUTTON -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left" style="margin:28px 0 8px">
              <tr>
                <td class="btn-td" align="center" bgcolor="${G}" style="border-radius:8px;mso-padding-alt:14px 32px">
                  <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${esc(
                    payload.url,
                  )}" style="height:48px;v-text-anchor:middle;width:220px" arcsize="17%" stroke="f" fillcolor="${G}"><w:anchorlock/><center style="color:#fff;font-family:Arial,sans-serif;font-size:15px;font-weight:700">View Details</center></v:roundrect><![endif]-->
                  <!--[if !mso]><!-- -->
                  <a href="${esc(
                    payload.url,
                  )}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;mso-hide:all">View Details&nbsp;&rarr;</a>
                  <!--<![endif]-->
                </td>
              </tr>
            </table>
            <div style="clear:both;height:1px;line-height:1px;font-size:0">&nbsp;</div>
            <p style="margin:8px 0 0;font-size:12px;color:#9a9a9a;line-height:1.5;word-break:break-all;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
              Or copy this link:<br>
              <a href="${esc(
                payload.url,
              )}" style="color:${G};text-decoration:underline">${esc(
                    payload.url,
                  )}</a>
            </p>`
                : ""
            }
          </td></tr>

          <!-- FOOTER -->
          <tr><td class="px" style="padding:36px 40px 36px">
            <div style="height:1px;line-height:1px;font-size:0;background-color:#ececec;margin-bottom:24px">&nbsp;</div>
            <p style="margin:0 0 6px;font-size:12px;color:#8a8a8a;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
              You received this email from <strong style="color:${G}">Luxol Market</strong>.
            </p>
            <p style="margin:0 0 12px;font-size:12px;color:#8a8a8a;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
              Need help? <a href="mailto:${this.SUPPORT_EMAIL}" style="color:${G};text-decoration:underline">${this.SUPPORT_EMAIL}</a>
            </p>
            <p style="margin:0;font-size:11px;color:#b0b0b0;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
              &copy; ${year} Luxol Market. All rights reserved.<br>
              <a href="${this.SITE_URL}/unsubscribe" style="color:#b0b0b0;text-decoration:underline">Unsubscribe</a>
            </p>
          </td></tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}