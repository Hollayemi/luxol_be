import { IsNumber, IsString, Min } from "class-validator";

export class ValidatePromoDto {
  @IsString()
  code: string;

  @IsNumber()
  @Min(0)
  itemsTotal: number;
}