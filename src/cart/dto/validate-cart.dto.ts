import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

class ValidateCartItemDto {
  @IsString() productId: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsString() variant?: string;
}

export class ValidateCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidateCartItemDto)
  items: ValidateCartItemDto[];
}