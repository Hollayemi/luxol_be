import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { CustomerStatus } from "../../generated/prisma/enums.js";
import { AdminOrderPeriod } from "../../orders/dto/list-admin-orders.dto.js";

export class ListAdminCustomersDto {
  /** Matches name, email and phone. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase() : value,
  )
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  /**
   * true  → only members (active subscription)
   * false → only non-members
   * omit  → everyone
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isMember?: boolean;

  @IsOptional()
  @IsEnum(AdminOrderPeriod)
  period?: AdminOrderPeriod;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perPage?: number = 20;
}