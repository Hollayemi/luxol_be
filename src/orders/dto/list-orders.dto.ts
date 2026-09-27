import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

const FRONTEND_STATUSES = [
  "in-progress",
  "completed",
  "cancelled",
  "returned",
] as const;

export class ListOrdersDto {
  @IsOptional()
  @IsIn(["orders", "cancelled"])
  tab?: "orders" | "cancelled";

  @IsOptional()
  @IsArray()
  @IsIn(FRONTEND_STATUSES, { each: true })
  status?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;
}