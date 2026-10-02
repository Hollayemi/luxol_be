import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";

import { ForgotPasswordDto, GoogleDto, LoginDto, RegisterDto, ResetPasswordDto } from "./dto/register.dto.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { CurrentUser } from "./decorators/current-user.decorator.js";
import { AuthService } from "./auth.service.js";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) { }

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const userAgent = req.get("user-agent") ?? undefined;
    const forwardedFor = req.get("x-forwarded-for") ?? undefined;

    return this.auth.login(dto, userAgent, forwardedFor);
  }

  @Post("google")
  google(@Body() dto: GoogleDto) {
    return this.auth.loginWithGoogle(dto.idToken);
  }

  @Post("forgot-password")
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post("reset-password")
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: { id: string }) {
    return this.auth.me(user.id);
  }
}