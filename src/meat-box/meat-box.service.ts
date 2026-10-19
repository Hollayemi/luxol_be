import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaystackService } from "../payments/paystack.service.js";
import { nextCode } from "../common/utils/code.util.js";
import {
  serializeCategory,
  serializeMeatBoxOrder,
} from "./meat-box.serializer.js";
import {
  MEAT_BOX_DEFAULT_MAX_QUANTITY,
  MEAT_BOX_DELIVERY_DAYS,
  MEAT_BOX_DELIVERY_FREQUENCIES,
  MEAT_BOX_DELIVERY_WINDOWS,
} from "./meat-box.constants.js";
import { DatabaseService } from "../database/database.service.js";
import { CreateMeatBoxOrderDto } from "./dto/create-meat-box-order.dto.js";
import { Prisma } from "../generated/prisma/client.js";
import { CancelMeatBoxOrderDto } from "./dto/cancel-meat-box-order.dto.js";

@Injectable()
export class MeatBoxService {
  constructor(
    private db: DatabaseService,
    private paystack: PaystackService,
    private config: ConfigService,
  ) {}

  // ─── Catalogue (public) ─────────────────────────────────────

  async options() {
    const categories = await this.db.meatBoxCategory.findMany({
      where: { status: "ACTIVE" },
      include: {
        options: {
          where: { status: "ACTIVE" },
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    return {
      categories: categories.map(serializeCategory),
      deliveryFrequencies: MEAT_BOX_DELIVERY_FREQUENCIES.map((f) => ({
        id: f.id,
        label: f.label,
        recurring: f.recurring,
      })),
      deliveryDays: [...MEAT_BOX_DELIVERY_DAYS],
      deliveryWindows: [...MEAT_BOX_DELIVERY_WINDOWS],
    };
  }

  // ─── Create Order (Direct Checkout) ─────────────────────────

  async createOrder(userId: string, dto: CreateMeatBoxOrderDto) {
    // 1. Validate delivery details
    const freq = MEAT_BOX_DELIVERY_FREQUENCIES.find(
      (f) => f.id === dto.deliveryFrequency,
    );
    if (!freq) throw new BadRequestException("Invalid delivery frequency");
    if (!MEAT_BOX_DELIVERY_DAYS.includes(dto.deliveryDay as any)) {
      throw new BadRequestException("Invalid delivery day");
    }
    if (!MEAT_BOX_DELIVERY_WINDOWS.includes(dto.deliveryWindow as any)) {
      throw new BadRequestException("Invalid delivery window");
    }

    // 2. Validate address
    const address = await this.db.address.findFirst({
      where: { id: dto.addressId, userId },
    });
    if (!address) throw new NotFoundException("Address not found");

    // 3. Load options & categories
    const optionIds = [...new Set(dto.items.map((i) => i.optionId))];
    const options = await this.db.meatBoxOption.findMany({
      where: { id: { in: optionIds }, status: "ACTIVE" },
      include: { category: true }, // Needed for pricePerKg
    });
    const optionById = new Map(options.map((o) => [o.id, o]));

    if (options.length !== optionIds.length) {
      throw new BadRequestException("One or more options are unavailable");
    }

    // 4. Build line items and calculate totals
    let subtotal = 0;
    let totalWeightKg = 0;

    const lineItems: Prisma.MeatBoxOrderItemCreateWithoutOrderInput[] = [];

    for (const line of dto.items) {
      const opt = optionById.get(line.optionId)!;
      const cap = opt.maxQuantity ?? MEAT_BOX_DEFAULT_MAX_QUANTITY;

      if (line.quantity < 1 || line.quantity > cap) {
        throw new BadRequestException(
          `${opt.label}: quantity must be between 1 and ${cap}`,
        );
      }

      const pricePerKg = Number(opt.category.pricePerKg);
      const weightKg = Number(opt.weightKg);
      
      // Auto-calculate the line total
      const lineTotal = pricePerKg * weightKg * line.quantity;
      
      subtotal += lineTotal;
      totalWeightKg += weightKg * line.quantity;

      lineItems.push({
        option: { connect: { id: opt.id } },
        label: opt.label,
        weightKg: new Prisma.Decimal(weightKg),
        pricePerKg: new Prisma.Decimal(pricePerKg),
        quantity: line.quantity,
        lineTotal: new Prisma.Decimal(lineTotal),
      });
    }

    // 5. Calculate delivery and final total
    // Replace with your delivery zone logic if needed
    const FLAT_DELIVERY = Number(this.config.get("DELIVERY_FEE") ?? 2500); 
    const deliveryFee = freq.id === "ONE_TIME" ? FLAT_DELIVERY : 0; // Example logic
    const total = subtotal + deliveryFee;

    // 6. Generate order code & compute next delivery
    const code = await nextCode(this.db, "meat_box_order", "MB", 5);
    const nextDeliveryAt = nextOccurrenceOfDay(dto.deliveryDay);

    // 7. Create Order
    const order = await this.db.meatBoxOrder.create({
      data: {
        code,
        userId,
        addressId: address.id,
        status: "PENDING_PAYMENT",
        deliveryFrequency: dto.deliveryFrequency,
        deliveryDay: dto.deliveryDay,
        deliveryWindow: dto.deliveryWindow,
        butcheryGuidelines: dto.butcheryGuidelines ?? null,
        deliveryAddress: `${address.fullName}, ${address.address}, ${address.region}`,
        fullName: address.fullName,
        phone: address.phone,
        subtotal: new Prisma.Decimal(subtotal),
        deliveryFee: new Prisma.Decimal(deliveryFee),
        total: new Prisma.Decimal(total),
        nextDeliveryAt,
        items: { create: lineItems },
      },
      include: { items: true },
    });

    // 8. Initialize Paystack Payment immediately
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    const reference = `MB-${order.code}-${Date.now()}`;
    const amountKobo = Math.round(total * 100);

    let init;
    try {
      init = await this.paystack.initialize({
        email: user.email,
        amountKobo,
        reference,
        callbackUrl: `${this.config.get("API_URL")}/payments/verify?meatBoxOrderId=${order.id}`,
        metadata: { meatBoxOrderId: order.id, orderCode: order.code, userId },
      });
    } catch (err: any) {
      // If payment fails to init, you may want to delete the order or leave it pending
      throw new BadRequestException("Could not start payment. Please try again.");
    }

    // 9. Create Payment row
    await this.db.payment.create({
      data: {
        userId,
        meatBoxOrderId: order.id,
        provider: "PAYSTACK",
        providerRef: init.reference,
        amount: new Prisma.Decimal(total),
        currency: "NGN",
        status: "PENDING",
        accessCode: init.accessCode,
        authorizationUrl: init.authorizationUrl,
        metadata: { orderCode: order.code },
      },
    });

    // 10. Return the order AND payment info so frontend redirects to Paystack
    return {
      order: serializeMeatBoxOrder(order),
      payment: {
        authorizationUrl: init.authorizationUrl,
        reference: init.reference,
      },
    };
  }

  // ─── List / read ────────────────────────────────────────────

  async listMine(userId: string) {
    const rows = await this.db.meatBoxOrder.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    return { items: rows.map(serializeMeatBoxOrder) };
  }

  async findMine(userId: string, id: string) {
    const order = await this.db.meatBoxOrder.findFirst({
      where: { id, userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Meat box order not found");
    return serializeMeatBoxOrder(order);
  }

  // ─── Cancel ─────────────────────────────────────────────────

  async cancel(userId: string, id: string, dto: CancelMeatBoxOrderDto) {
    const order = await this.db.meatBoxOrder.findFirst({
      where: { id, userId },
    });
    if (!order) throw new NotFoundException("Meat box order not found");

    if (order.status === "CANCELLED") throw new BadRequestException("Already cancelled");
    if (order.status === "COMPLETED") throw new BadRequestException("Completed orders cannot be cancelled");
    if (order.status === "OUT_FOR_DELIVERY") throw new BadRequestException("Out for delivery orders cannot be cancelled");
    if (order.paidAt && order.status === "PROCESSING") {
       throw new BadRequestException("Processing orders cannot be cancelled by customer. Contact support.");
    }

    const updated = await this.db.meatBoxOrder.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: dto.reason ?? null,
      },
      include: { items: true },
    });

    return serializeMeatBoxOrder(updated);
  }
}

// Helper to compute next delivery date
function nextOccurrenceOfDay(day: string): Date {
  const dayIdx = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(day);
  if (dayIdx === -1) return new Date();
  const now = new Date();
  const d = new Date(now);
  const diff = (dayIdx - now.getDay() + 7) % 7 || 7; // next, not today
  d.setDate(now.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}