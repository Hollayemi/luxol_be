import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { ConfigService } from "@nestjs/config";
import { markPaymentConfirmed, OrderStep } from "../orders/order-timeline.js";

interface InitializeParams {
  email: string;
  amountKobo: number;   // Paystack expects the smallest currency unit
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

interface InitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

interface VerifyResult {
  status: "success" | "failed" | "abandoned" | "ongoing" | "pending";
  reference: string;
  amountKobo: number;
  currency: string;
  channel: string;
  paidAt: string | null;
  customerEmail: string;
  metadata: Record<string, unknown>;
  raw: any;
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly http: AxiosInstance;
  private readonly secret: string;
  constructor(
    private db: DatabaseService,
    private config: ConfigService,
  ) {

    this.secret = process.env.PAYSTACK_SECRET_KEY ?? "";
    if (!this.secret) {
      this.logger.warn("PAYSTACK_SECRET_KEY is not set — payments will fail");
    }
    console.log(this.secret, "=========>")
    this.http = axios.create({
      baseURL: "https://api.paystack.co",
      headers: {
        Authorization: `Bearer ${this.secret}`,
        "Content-Type": "application/json",
      },
      timeout: 15_000,
    });
  }

  async initialize(params: InitializeParams): Promise<InitializeResult> {
    const res = await this.http.post("/transaction/initialize", {
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    });

    if (!res.data?.status) {
      throw new BadRequestException(
        res.data?.message ?? "Paystack init failed",
      );
    }

    return {
      authorizationUrl: res.data.data.authorization_url,
      accessCode: res.data.data.access_code,
      reference: res.data.data.reference,
    };
  }

  async verify(reference: string): Promise<VerifyResult> {
    const res = await this.http.get(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    if (!res.data?.status) {
      throw new BadRequestException(
        res.data?.message ?? "Paystack verify failed",
      );
    }

    const d = res.data.data;
    return {
      status: d.status,
      reference: d.reference,
      amountKobo: d.amount,
      currency: d.currency,
      channel: d.channel,
      paidAt: d.paid_at ?? d.paidAt ?? null,
      customerEmail: d.customer?.email ?? "",
      metadata: d.metadata ?? {},
      raw: d,
    };
  }

  async confirmPayment(reference: string) {
    console.log("=======>", reference)
    const verify = await this.verify(reference);

    if (verify.status !== "success") {
      await this.db.payment.updateMany({
        where: { providerRef: reference },
        data: {
          status: "FAILED",
          failureReason: verify.raw?.gateway_response ?? "Payment not successful",
          metadata: {
            ...(verify.metadata ?? {}),
            paystackStatus: verify.status,
            verifyRaw: verify.raw,
          } as Prisma.InputJsonValue,
        },
      });

      throw new BadRequestException(
        verify.raw?.gateway_response ?? "Payment was not successful",
      );
    }

    // 3. Find the payment + order it belongs to
    const payment = await this.db.payment.findUnique({
      where: { providerRef: reference },
      include: { order: true },
    });

    console.log({payment})
    if (!payment) throw new NotFoundException("Payment not found");
    // if (!payment.order) throw new NotFoundException("Order not found for this payment");

    // 4. Guard against double-processing (webhooks + client verify both call this)
    // if (payment.status === "SUCCESS") {
    //   this.logger.warn(`Payment ${reference} already confirmed; skipping`);
    //   return `${this.config.get("FRONTEND_URL")}/orders?order=${payment.order.id}`
    // }

    // 5. Sanity-check the amount — Paystack sends kobo
    const expectedKobo = Math.round(Number(payment.amount) * 100);
    if (verify.amountKobo !== expectedKobo) {
      this.logger.error(
        `Amount mismatch for ${reference}: expected ${expectedKobo}, got ${verify.amountKobo}`,
      );
      await this.db.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failureReason: "Amount mismatch",
        },
      });
      throw new BadRequestException("Payment amount does not match order total");
    }

    // 6. Update everything atomically
    const updated = await this.db.$transaction(async (tx) => {
      let result;
      const pay = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCESS",
          metadata: {
            ...(payment.metadata as any),
            paidAt: verify.paidAt,
            channel: verify.channel,
            customerEmail: verify.customerEmail,
            authorization: verify.raw?.authorization,
            fees: verify.raw?.fees ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      if (payment.subscriptionId) {
        result = await tx.subscription.update({
          where: { id: payment.subscriptionId },
          data: { status: "ACTIVE" },
        });

        // await tx.notification.create({
        //   data: {
        //     userId: result.userId,
        //     orderId: result.id,
        //     channel: "EMAIL",
        //     status: "PENDING",
        //     subject: `Payment confirmed for subscription ${result.planId}`,
        //     body: `We received your payment. Your order is being prepared.`,
        //   },
        // });
      }

      if (payment.orderId) {
        const result = await tx.order.update({
          where: { id: payment.orderId! },
          data: { status: "PENDING" },
        });


        const newTimeline = markPaymentConfirmed(
          result.timeline as unknown as OrderStep[],
          verify.paidAt ?? new Date().toISOString(),
        );

        await tx.order.update({
          where: { id: result.id },
          data: { timeline: newTimeline as unknown as Prisma.InputJsonValue },
        });

        // Notify the customer (fire and forget — do not throw on failure)
        await tx.notification.create({
          data: {
            userId: result.userId,
            orderId: result.id,
            channel: "EMAIL",
            status: "PENDING",
            subject: `Payment confirmed for order ${result.orderNumber}`,
            body: `We received your payment. Your order is being prepared.`,
          },
        });

      }
      return { pay, result };

    });

    this.logger.log(`Payment confirmed: ${reference} → order ${updated?.result?.id}`);

    const frontendUrl = this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000";

    const redirectUrl = payment.subscriptionId
      ? `${frontendUrl}/subscription/checkout?subscription=${payment.id}`
      : `${frontendUrl}/orders?order=${updated?.result?.id}`;

    return redirectUrl
  }
}
