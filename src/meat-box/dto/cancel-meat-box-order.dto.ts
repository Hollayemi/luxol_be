import { IsOptional, IsString } from "class-validator";

export class CancelMeatBoxOrderDto {
  @IsOptional() @IsString()
  reason?: string;
}