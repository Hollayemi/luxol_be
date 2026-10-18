import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CreateMeatBoxOrderDto } from "./dto/create-meat-box-order.dto.js";
import { CancelMeatBoxOrderDto } from "./dto/cancel-meat-box-order.dto.js";
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
import { PaystackService } from "../payments/paystack.service.js";
import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { nextCode } from "../common/utils/code.util.js";

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

  // ─── Create order ───────────────────────────────────────────

  async createOrder(userId: string, dto: CreateMeatBoxOrderDto) {
    // 1. Validate delivery frequency / day / window
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

    // 2. Validate address belongs to user
    const address = await this.db.address.findFirst({
      where: { id: dto.addressId, userId },
    });
    if (!address) throw new NotFoundException("Address not found");

    // 3. Load options
    const optionIds = [...new Set(dto.items.map((i) => i.optionId))];
    const options = await this.db.meatBoxOption.findMany({
      where: { id: { in: optionIds }, status: "ACTIVE" },
      include: { category: true },
    });
    const optionById = new Map(options.map((o) => [o.id, o]));

    if (options.length !== optionIds.length) {
      throw new BadRequestException("One or more options are unavailable");
    }

    // 4. Validate quantities + compute estimates
    let estMinTotal = 0;
    let estMaxTotal = 0;
    let estMinKg = 0;
    let estMaxKg = 0;

    const itemData: Prisma.MeatBoxOrderItemCreateWithoutOrderInput[] = [];

    for (const line of dto.items) {
      const opt = optionById.get(line.optionId)!;
      const cap = opt.maxQuantity ?? MEAT_BOX_DEFAULT_MAX_QUANTITY;

      if (line.quantity < 1 || line.quantity > cap) {
        throw new BadRequestException(
          `${opt.label}: quantity must be between 1 and ${cap}`,
        );
      }

      // Estimates
      if (opt.unit === "KG") {
        if (opt.pricePerKg == null) {
          throw new BadRequestException(
            `${opt.label} is priced per kg but has no price set`,
          );
        }
        const kg = line.quantity;
        const linePrice = Number(opt.pricePerKg) * kg;
        estMinTotal += linePrice;
        estMaxTotal += linePrice;
        estMinKg += kg;
        estMaxKg += kg;
      } else {
        // ANIMAL: use estimated weight range * (pricePerKg ?? fallback to range)
        const minW = opt.estimatedMinKg ? Number(opt.estimatedMinKg) : 0;
        const maxW = opt.estimatedMaxKg ? Number(opt.estimatedMaxKg) : 0;

        if (minW <= 0 || maxW <= 0) {
          throw new BadRequestException(
            `${opt.label} is missing its estimated weight range`,
          );
        }

        const totalMinKg = minW * line.quantity;
        const totalMaxKg = maxW * line.quantity;

        // If pricePerKg is set (some animals are still priced per kg), use it.
        // Otherwise fall back to the estimated price range stored on the option.
        if (opt.pricePerKg != null) {
          const ppk = Number(opt.pricePerKg);
          estMinTotal += totalMinKg * ppk;
          estMaxTotal += totalMaxKg * ppk;
        } else if (
          opt.estimatedMinPrice != null &&
          opt.estimatedMaxPrice != null
        ) {
          estMinTotal += Number(opt.estimatedMinPrice) * line.quantity;
          estMaxTotal += Number(opt.estimatedMaxPrice) * line.quantity;
        } else {
          throw new BadRequestException(
            `${opt.label} is missing its estimated price range`,
          );
        }

        estMinKg += totalMinKg;
        estMaxKg += totalMaxKg;
      }

      itemData.push({
        option: { connect: { id: opt.id } },
        label: opt.label,
        unit: opt.unit,
        quantity: line.quantity,
        pricePerKg:
          opt.pricePerKg != null
            ? new Prisma.Decimal(opt.pricePerKg.toString())
            : null,
        finalWeightKg: null,
        lineTotal: null,
      });
    }

    // 5. Generate order code
    const code = await nextCode(this.db, "meat_box_order", "LX", 5);

    // 6. Next delivery date (simple: the day matching deliveryDay this/next week)
    const nextDeliveryAt = nextOccurrenceOfDay(dto.deliveryDay);

    // 7. Persist
    const created = await this.db.meatBoxOrder.create({
      data: {
        code,
        userId,
        addressId: address.id,
        status: "PENDING_WEIGHING",
        deliveryFrequency: dto.deliveryFrequency,
        deliveryDay: dto.deliveryDay,
        deliveryWindow: dto.deliveryWindow,
        butcheryGuidelines: dto.butcheryGuidelines ?? null,
        deliveryAddress: `${address.fullName}, ${address.address}, ${address.region}`,
        fullName: address.fullName,
        phone: address.phone,
        estimatedMinTotal: new Prisma.Decimal(estMinTotal.toFixed(2)),
        estimatedMaxTotal: new Prisma.Decimal(estMaxTotal.toFixed(2)),
        estimatedMinKg: new Prisma.Decimal(estMinKg.toFixed(3)),
        estimatedMaxKg: new Prisma.Decimal(estMaxKg.toFixed(3)),
        nextDeliveryAt,
        items: { create: itemData },
      },
      include: { items: true },
    });

    return serializeMeatBoxOrder(created);
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

  // ─── Place (customer pays after price confirmed) ────────────

  async placeOrder(userId: string, id: string) {
    const order = await this.db.meatBoxOrder.findFirst({
      where: { id, userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Meat box order not found");

    if (order.status !== "PRICE_CONFIRMED") {
      throw new BadRequestException(
        "This order is not ready to be placed yet — waiting on price confirmation",
      );
    }

    if (order.confirmedTotal == null) {
      throw new BadRequestException("Confirmed price is missing");
    }

    const total = Number(order.confirmedTotal);
    const reference = `MB-${order.code}-${Date.now()}`;
    const amountKobo = Math.round(total * 100);

    let init;
    try {
      init = await this.paystack.initialize({
        email:
          (
            await this.db.user.findUniqueOrThrow({
              where: { id: userId },
              select: { email: true },
            })
          ).email,
        amountKobo,
        reference,
        callbackUrl: `${this.config.get("API_URL")}/payments/verify?meatBoxOrderId=${order.id}`,
        metadata: {
          meatBoxOrderId: order.id,
          orderCode: order.code,
          userId,
        },
      });
    } catch (err: any) {
      throw new BadRequestException(
        "Could not start payment. Please try again.",
      );
    }

    // Persist the payment row
    await this.db.payment.create({
      data: {
        userId,
        meatBoxOrderId: order.id,
        provider: "PAYSTACK",
        providerRef: init.reference,
        amount: new Prisma.Decimal(total.toFixed(2)),
        currency: "NGN",
        status: "PENDING",
        accessCode: init.accessCode,
        authorizationUrl: init.authorizationUrl,
        metadata: { orderCode: order.code },
      },
    });

    return {
      orderId: order.id,
      payment: {
        authorizationUrl: init.authorizationUrl,
        reference: init.reference,
      },
    };
  }

  // ─── Cancel ─────────────────────────────────────────────────

  async cancel(userId: string, id: string, dto: CancelMeatBoxOrderDto) {
    const order = await this.db.meatBoxOrder.findFirst({
      where: { id, userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Meat box order not found");

    if (order.status === "CANCELLED") {
      throw new BadRequestException("Already cancelled");
    }
    if (order.status === "COMPLETED") {
      throw new BadRequestException("Completed orders cannot be cancelled");
    }
    if (order.status === "OUT_FOR_DELIVERY") {
      throw new BadRequestException(
        "Order is already out for delivery and cannot be cancelled",
      );
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

// ─── Helpers ──────────────────────────────────────────────────

function nextOccurrenceOfDay(day: string): Date {
  const dayIdx = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ].indexOf(day);
  if (dayIdx === -1) return new Date();

  const now = new Date();
  const d = new Date(now);
  const diff = (dayIdx - now.getDay() + 7) % 7 || 7; // next, not today
  d.setDate(now.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}