import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator"


export class RegisterDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}


export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsEnum(['admin', 'customer'])
  @IsOptional()
  type: 'admin' | 'customer'
}



export class GoogleDto {
  @IsString()
  idToken: string;
}



export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}



export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  password: string;
}