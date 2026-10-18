import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

class PriceLineDto {
  @IsString() itemId: string;

  @IsNumber() @Min(0.01)
  finalWeightKg: number;

  @IsNumber() @Min(0)
  lineTotal: number;
}

export class UpdateMeatBoxPriceDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PriceLineDto)
  items: PriceLineDto[];
}