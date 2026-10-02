import { IsString, MinLength, Matches } from "class-validator";

export class ChangeAdminPasswordDto {
  @IsString()
  oldPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: "New password must include an uppercase letter" })
  @Matches(/[0-9]/, { message: "New password must include a number" })
  newPassword: string;

  @IsString()
  confirmPassword: string;
}