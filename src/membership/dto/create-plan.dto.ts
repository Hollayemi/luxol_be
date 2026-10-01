import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { ActiveStatus, DeliveryFrequency, MembershipInterval } from "../../generated/prisma/enums.js";

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase() : value)
  @IsEnum(MembershipInterval)
  interval: MembershipInterval;

  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase() : value)
  @IsEnum(DeliveryFrequency)
  deliveryFrequency: DeliveryFrequency;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supply?: string[];

  @IsOptional()
  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase() : value)
  @IsEnum(ActiveStatus)
  status?: ActiveStatus;
}