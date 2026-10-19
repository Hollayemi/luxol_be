import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";
import { ActiveStatus, MeatBoxOrderStatus } from "../../generated/prisma/enums.js";
import { PartialType } from "@nestjs/mapped-types";

// ─── Order Actions ───────────────────────────────────────────

export class UpdateMeatBoxStatusDto {
  @Transform(({ value }) => (typeof value === "string" ? value.toUpperCase() : value))
  @IsEnum(MeatBoxOrderStatus)
  status: MeatBoxOrderStatus;

  @IsOptional() @IsString()
  note?: string;
}

export class CancelMeatBoxOrderDto {
  @IsString()
  @MinLength(3)
  reason: string;
}

// ─── Categories ──────────────────────────────────────────────

export class CreateMeatBoxCategoryDto {
  @IsString() @MinLength(2) label: string;

  // The base price for the meat in this category
  @Transform(({ value }) => (value === "" || value === undefined ? undefined : Number(value)))
  @IsNumber() @Min(0)
  pricePerKg: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.toUpperCase() : value))
  @IsEnum(ActiveStatus)
  status?: ActiveStatus;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)))
  @IsInt() @Min(0)
  displayOrder?: number;
}

export class UpdateMeatBoxCategoryDto extends PartialType(CreateMeatBoxCategoryDto) {}

// ─── Options ─────────────────────────────────────────────────

const toNumOrNull = ({ value }: { value: unknown }) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export class CreateMeatBoxOptionDto {
  @IsString() categoryId: string;

  @IsString() @MinLength(2) label: string;

  // The physical weight of the box. Price is computed on the backend.
  @Transform(({ value }) => (value === "" || value === undefined ? undefined : Number(value)))
  @IsNumber() @Min(0.1)
  weightKg: number;

  @IsOptional()
  @Transform(toNumOrNull)
  @IsInt() @Min(1)
  maxQuantity?: number | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.toUpperCase() : value))
  @IsEnum(ActiveStatus)
  status?: ActiveStatus;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)))
  @IsInt() @Min(0)
  displayOrder?: number;
}

export class UpdateMeatBoxOptionDto extends PartialType(CreateMeatBoxOptionDto) {}