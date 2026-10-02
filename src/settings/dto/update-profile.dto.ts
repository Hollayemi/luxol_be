import { IsEmail, IsOptional, IsString, MinLength, IsEnum } from "class-validator";
import { Role } from "../../generated/prisma/client.js";

export class UpdateAdminProfileDto {
  @IsOptional() @IsString() @MinLength(1)
  name?: string;
  
  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsEnum(Role)
  role?: Role;

  @IsOptional() @IsString()
  bio?: string;
}