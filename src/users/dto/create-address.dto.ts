import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateAddressDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @IsString()
  @MinLength(3)
  address: string;

  @IsString()
  @MinLength(2)
  region: string;

  @IsString()
  @MinLength(7)
  phone: string;

  @IsOptional()
  @IsString()
  phone_sec?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}