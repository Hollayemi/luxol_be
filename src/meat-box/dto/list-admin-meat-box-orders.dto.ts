import { Transform, Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { MeatBoxOrderStatus } from "../../generated/prisma/enums.js";
import { AdminOrderPeriod } from "../../orders/dto/list-admin-orders.dto.js";

export enum AdminMeatBoxPaymentStatusFilter {
  UNPAID = "UNPAID",
  PAID = "PAID",
  REFUNDED = "REFUNDED",
}

export class ListAdminMeatBoxOrdersDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.toUpperCase() : value))
  @IsEnum(MeatBoxOrderStatus)
  status?: MeatBoxOrderStatus;

  @IsOptional()
  @IsEnum(AdminMeatBoxPaymentStatusFilter)
  paymentStatus?: AdminMeatBoxPaymentStatusFilter;

  @IsOptional()
  @IsEnum(AdminOrderPeriod)
  period?: AdminOrderPeriod;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  perPage?: number = 20;
}