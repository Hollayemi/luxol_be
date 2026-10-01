import { Type } from "class-transformer";
import {
  ArrayNotEmpty, IsArray, IsInt, IsString, Max, Min, ValidateNested,
} from "class-validator";

class MixShareDto {
  @IsString() proteinId: string;
  @IsInt() @Min(0) @Max(100) percentage: number;
}

export class UpdateMixDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MixShareDto)
  mix: MixShareDto[];
}