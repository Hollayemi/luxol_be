import { IsEnum, IsOptional } from "class-validator";
import { AdminOrderPeriod } from "../../orders/dto/list-admin-orders.dto.js";

export class GetAdminCustomerStatsDto {
  @IsOptional()
  @IsEnum(AdminOrderPeriod)
  period?: AdminOrderPeriod;
}