import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { IsNumberLike } from "../../common/decorator/number-or-string.js";

class PlaceOrderItemDto {
  @IsString() productId: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsString() variant?: string;
}

export class PlaceOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaceOrderItemDto)
  items: PlaceOrderItemDto[];

  @IsOptional()
  @IsString()
  addressId?: string;

  @IsNumberLike()
  phone: string;

  @IsString()
  deliveryMethod: string; // "Delivery" | "Pickup"

  @IsOptional()
  @IsString()
  promoCode?: string;
}