import { IsString, MinLength, IsOptional } from "class-validator";

export class AcceptInviteDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;


}