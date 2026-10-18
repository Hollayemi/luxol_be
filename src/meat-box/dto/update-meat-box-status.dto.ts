import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";
import { ActiveStatus, MeatBoxOrderStatus, MeatBoxUnit } from "../../generated/prisma/enums.js";
import { PartialType } from "@nestjs/mapped-types";



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



export class CreateMeatBoxCategoryDto {
  @IsString() @MinLength(2) label: string;

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



const toNumOrNull = ({ value }: { value: unknown }) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export class CreateMeatBoxOptionDto {
  @IsString() categoryId: string;

  @IsString() @MinLength(2) label: string;

  @Transform(({ value }) => (typeof value === "string" ? value.toUpperCase() : value))
  @IsEnum(MeatBoxUnit)
  unit: MeatBoxUnit;

  @IsOptional()
  @Transform(toNumOrNull)
  @IsNumber()
  pricePerKg?: number | null;

  @IsOptional()
  @Transform(toNumOrNull)
  @IsNumber()
  estimatedMinKg?: number | null;

  @IsOptional()
  @Transform(toNumOrNull)
  @IsNumber()
  estimatedMaxKg?: number | null;

  @IsOptional()
  @Transform(toNumOrNull)
  @IsNumber()
  estimatedMinPrice?: number | null;

  @IsOptional()
  @Transform(toNumOrNull)
  @IsNumber()
  estimatedMaxPrice?: number | null;

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