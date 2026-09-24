import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import { randomBytes } from "crypto";
import { DatabaseService } from "../database/database.service.js";
import { LoginDto, RegisterDto } from "./dto/register.dto.js";

const googleClient = new OAuth2Client(process.env.AUTH_GOOGLE_ID);

@Injectable()
export class AuthService {
  constructor(
    private db: DatabaseService,
    private jwt: JwtService,
  ) {}

  private sign(user: { id: string; email: string; role: string }) {
    return this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
  }

  private sanitize(user: any) {
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async register(dto: RegisterDto) {
    const existing = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException("Email already in use");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.db.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
      },
    });

    return {
      message: "Account created",
      data: {
        user: this.sanitize(user),
        accessToken: this.sign(user),
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.passwordHash)
      throw new UnauthorizedException("Invalid credentials");

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    await this.db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      message: "Logged in",
      data: {
        user: this.sanitize(user),
        accessToken: this.sign(user),
      },
    };
  }

  async loginWithGoogle(idToken: string) {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.AUTH_GOOGLE_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub)
      throw new UnauthorizedException("Invalid Google token");

    const email = payload.email.toLowerCase();

    let user = await this.db.user.findUnique({ where: { email } });

    if (!user) {
      user = await this.db.user.create({
        data: {
          name: payload.name ?? email.split("@")[0],
          email,
          image: payload.picture,
          emailVerified: new Date(),
          oauthAccounts: {
            create: {
              provider: "google",
              providerAccountId: payload.sub,
            },
          },
        },
      });
    } else {
      // Link the Google account if not already linked
      await this.db.oAuthAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: payload.sub,
          },
        },
        update: {},
        create: {
          userId: user.id,
          provider: "google",
          providerAccountId: payload.sub,
        },
      });
    }

    await this.db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      message: "Logged in with Google",
      data: {
        user: this.sanitize(user),
        accessToken: this.sign(user),
      },
    };
  }

  async forgotPassword(email: string) {
    const user = await this.db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always succeed (don't leak which emails exist)
    if (!user) return { message: "If that email exists, a reset link was sent" };

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await this.db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    // TODO: send email with `${FRONTEND_URL}/reset-password?token=${token}`
    // Wire this to Resend/Nodemailer once you're ready.

    return { message: "If that email exists, a reset link was sent" };
  }

  async resetPassword(token: string, password: string) {
    const record = await this.db.passwordResetToken.findUnique({
      where: { token },
    });
    if (!record || record.usedAt || record.expiresAt < new Date())
      throw new NotFoundException("Invalid or expired token");

    const passwordHash = await bcrypt.hash(password, 12);

    await this.db.$transaction([
      this.db.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.db.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: "Password updated" };
  }

  async me(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    return { message: "OK", data: this.sanitize(user) };
  }
}