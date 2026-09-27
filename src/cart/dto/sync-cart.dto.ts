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

export class SyncCartItemDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsNumberLike()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  variant?: string;
}

export class SyncCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncCartItemDto)
  items: SyncCartItemDto[];

}