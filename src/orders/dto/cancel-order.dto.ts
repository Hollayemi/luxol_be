import { IsString, MinLength } from "class-validator";

export class CancelOrderDto {
  @IsString()
  @MinLength(3)
  reason: string;
}