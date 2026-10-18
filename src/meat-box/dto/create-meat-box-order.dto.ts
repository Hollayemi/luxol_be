import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  MinLength,
} from "class-validator";

class MeatBoxOrderItemDto {
  @IsString() optionId: string;

  @IsInt() @Min(1)
  quantity: number;
}

export class CreateMeatBoxOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MeatBoxOrderItemDto)
  items: MeatBoxOrderItemDto[];

  @IsString()
  deliveryFrequency: string;

  @IsString()
  deliveryDay: string;

  @IsString()
  deliveryWindow: string;

  @IsString()
  addressId: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  butcheryGuidelines?: string;
}