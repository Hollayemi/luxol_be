import { IsBoolean } from "class-validator";

export class SetTwoFactorDto {
  @IsBoolean()
  enabled: boolean;
}