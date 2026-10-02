import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { AdminOrderPeriod } from "../../orders/dto/list-admin-orders.dto.js";

export class GetTopProductsDto {
  @IsOptional()
  @IsEnum(AdminOrderPeriod)
  period?: AdminOrderPeriod;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 4;
}