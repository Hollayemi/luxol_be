import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { ActiveStatus } from "../../generated/prisma/enums.js";

export class CreateProteinDto {
  @IsString() @MinLength(2) label: string;
  @IsString() description: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase() : value)
  @IsEnum(ActiveStatus)
  status?: ActiveStatus;

  @IsOptional()
  @IsString()
  image?: string;
}