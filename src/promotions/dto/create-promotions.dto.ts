import {
  IsAlphanumeric,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";
import { AppliesTo, DiscountType, PromotionType } from "../../generated/prisma/enums.js";


export class CreatePromotionDto {
  @IsEnum(PromotionType)
  type: PromotionType;

  @IsString()
  name: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsOptional()
  @IsString()
  @IsAlphanumeric()
  code?: string;

  @IsNumber()
  @Min(0)
  discountValue: number;

  @IsEnum(AppliesTo)
  appliesTo: AppliesTo;

  @ValidateIf((o) => o.appliesTo === "category")
  @IsString()
  categoryId?: string;

  @ValidateIf((o) => o.appliesTo === "specific_products")
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumDiscount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limitPerCustomer?: number;

  @IsISO8601()
  startAt: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;
}