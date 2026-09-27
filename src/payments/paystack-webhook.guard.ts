import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";

@Injectable()
export class PaystackWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const signature = req.headers["x-paystack-signature"];
    if (!signature || typeof signature !== "string") {
      throw new UnauthorizedException("Missing Paystack signature");
    }

    const secret = process.env.PAYSTACK_SECRET_KEY ?? "";
    // req.rawBody must be the raw Buffer — see main.ts note below.
    const raw: Buffer = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    const hash = createHmac("sha512", secret).update(raw).digest("hex");

    const a = Buffer.from(hash, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException("Invalid Paystack signature");
    }
    return true;
  }
}