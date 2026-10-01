import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ActiveStatus } from "../../generated/prisma/enums.js";

export class ListPlansDto {
  @IsOptional() @IsString() search?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase() : value)
  @IsEnum(ActiveStatus)
  status?: ActiveStatus;
}