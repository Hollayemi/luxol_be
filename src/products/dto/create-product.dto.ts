import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ProductStatus, VariantOption } from "../../generated/prisma/enums.js";
import { IsNumberLike } from "../../common/decorator/number-or-string.js";

class CreateVariantDto {
  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsString()
  categoryId: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsEnum(VariantOption)
  variantOption?: VariantOption;

  @IsString()
  unitType: string;

  @IsNumberLike()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumberLike()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsNumberLike()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsNumberLike()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];
}