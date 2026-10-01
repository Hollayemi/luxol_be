import { Transform, Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Min,
} from "class-validator";
import { AdminDeliveryTypeEnum } from "../delivery-types.enum.js";
import { DeliveryStatus } from "../../generated/prisma/enums.js";

export class ListDeliveriesDto {
  /** One day (side panel). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  /** A range (Export). Ignored if `date` is set. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsEnum(AdminDeliveryTypeEnum)
  type?: AdminDeliveryTypeEnum;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase() : value,
  )
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

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