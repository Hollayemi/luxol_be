import { DatabaseService } from "../../database/database.service.js";


export async function nextCode(
  db: DatabaseService,
  name: string,
  prefix: string,
  pad = 4,
): Promise<string> {
  const c = await db.counter.upsert({
    where: { name },
    update: { value: { increment: 1 } },
    create: { name, value: 1 },
  });
  return `${prefix}-${String(c.value).padStart(pad, "0")}`;
}


import { randomBytes } from "crypto";
import { PrismaClient } from "../../generated/prisma/client.js";

export function generateCouponCode(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6)
    .padEnd(4, "X");
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `${slug}${rand}`;
}


/**
 * Generates the next order number: "LX-10482".
 * Uses the same Counter table as products — atomic, race-free.
 */
export async function nextOrderNumber(db: PrismaClient): Promise<string> {
  const counter = await db.counter.upsert({
    where: { name: "order_number" },
    update: { value: { increment: 1 } },
    create: { name: "order_number", value: 10482 }, // start at LX-10482
  });
  return `LX-${counter.value}`;
}