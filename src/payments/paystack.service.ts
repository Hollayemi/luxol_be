import {
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import axios, { AxiosInstance } from "axios";

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

  constructor() {
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
}