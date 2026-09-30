import { IsEnum, IsOptional } from "class-validator";
import { OrderType } from "../../generated/prisma/client.js";
import { AdminOrderPeriod } from "./list-admin-orders.dto.js";

export class GetAdminOrderStatsDto {
  @IsOptional()
  @IsEnum(AdminOrderPeriod)
  period?: AdminOrderPeriod;

  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;
}