import { IsEnum, IsOptional, IsString } from "class-validator";
import { OrderStatus } from "../../generated/prisma/client.js";

/**
 * Only non-terminal statuses are accepted — the service rejects CANCELLED
 * here (use /cancel) and RETURNED / DELIVERED if the current status doesn't
 * allow it.
 */
export class UpdateAdminOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsString()
  note?: string;
}