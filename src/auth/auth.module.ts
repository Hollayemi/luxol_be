import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtStrategy } from "./strategies/jwt.strategy.js";
import { DatabaseService } from "../database/database.service.js";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { NotificationsService } from "../notification/notifications.service.js";
import { EmailZohoAdapter } from "../notification/channels/email-zoho.adapter.js";
import { WebPushAdapter } from "../notification/channels/webpush.adapter.js";
import { SmsTermiiAdapter } from "../notification/channels/sms-termii.adapter.js";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],              // ✅ critical — gives ConfigService the env
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, DatabaseService, NotificationsService, JwtStrategy, EmailZohoAdapter,SmsTermiiAdapter, WebPushAdapter],
  exports: [AuthService],
})
export class AuthModule {}