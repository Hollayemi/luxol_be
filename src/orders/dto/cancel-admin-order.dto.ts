import { IsString, MinLength } from "class-validator";

export class CancelAdminOrderDto {
  @IsString()
  @MinLength(3)
  reason: string;
}