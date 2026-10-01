import { Transform, Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { SubscriptionStatus } from "../../generated/prisma/enums.js";

export class ListSubscribersDto {
  @IsOptional() @IsString() search?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase() : value)
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  perPage?: number = 20;
}