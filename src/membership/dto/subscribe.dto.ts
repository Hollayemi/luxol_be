import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

class MixShareDto {
  @IsString() proteinId: string;

  @IsInt() @Min(0) @Max(100)
  percentage: number;
}

export class SubscribeDto {
  @IsString()
  planId: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MixShareDto)
  mix: MixShareDto[];

  @IsString()
  deliveryFrequency: string; // "WEEKLY" | ...

  @IsString()
  deliveryDay: string;

  @IsString()
  deliveryWindow: string;

  @IsString() @MinLength(3)
  addressId: string;
}