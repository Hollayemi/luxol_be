import { IsArray, IsOptional, IsString, MinLength } from "class-validator";

export class RequestReturnDto {
  @IsString()
  @MinLength(3)
  reason: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];
}