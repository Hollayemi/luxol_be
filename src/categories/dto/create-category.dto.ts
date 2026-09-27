import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { CategoryStatus } from "../../generated/prisma/enums.js";
import { PartialType } from "@nestjs/mapped-types";

export class CreateCategoryDto {
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
  image?: string;

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;

  @IsOptional()
  // @IsInt()
  // @Min(0)
  displayOrder?: number;
}




export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}