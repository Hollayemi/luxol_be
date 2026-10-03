import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import { randomBytes, createHash } from "crypto";
import { DatabaseService } from "../database/database.service.js";
import { LoginDto, RegisterDto } from "./dto/register.dto.js";
import { Role } from "../generated/prisma/enums.js";
import { detectDevice } from "../common/utils/device.util.js";
import { NotificationsService } from "../notification/notifications.service.js";

const googleClient = new OAuth2Client(process.env.AUTH_GOOGLE_ID);

@Injectable()
export class AuthService {
  constructor(
    private db: DatabaseService,
    private jwt: JwtService,
    private notifications: NotificationsService,
  ) { }

  private sign(user: { id: string; email: string; role: string, sessionTokenHash?: string }) {
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

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await this.db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    await this.notifications.notifyTemplate("AUTH_WELCOME", {
      userId: user.id,
      context: {
        firstName: user.name.split(" ")[0],
      },
    });

    await this.notifications.notifyTemplate("AUTH_EMAIL_VERIFICATION", {
      userId: user.id,
      context: {
        firstName: user.name.split(" ")[0],
        verifyUrl: `${process.env.API_URL}/auth/verify-email?token=${token}`,
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



  async login(dto: LoginDto, userAgent: string | undefined, ip: string | undefined) {
    console.log({ userAgent, ip })
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.passwordHash)
      throw new UnauthorizedException("Invalid credentials");

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      await this.db.loginActivity.create({
        data: {
          userId: user?.id ?? null,
          email: dto.email.toLowerCase(),
          outcome: "FAILED",
          device: detectDevice(userAgent),
          ipAddress: ip,
          reason: "Invalid credentials",
        }
      })
      throw new UnauthorizedException("Invalid credentials")
    }

    if (dto.type === 'admin')
      if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException("Not an admin account");
      }

    if (!user.isActive) {
      await this.db.loginActivity.create({
        data: {
          userId: user?.id ?? null,
          email: dto.email.toLowerCase(),
          outcome: "FAILED",
          device: detectDevice(userAgent),
          ipAddress: ip,
          reason: "Account disabled",
        }
      })
      throw new ForbiddenException("Account disabled");
    }



    await this.db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.db.loginActivity.create({
      data: {
        userId: user?.id ?? null,
        email: dto.email.toLowerCase(),
        outcome: "SUCCESS",
        device: detectDevice(userAgent),
        ipAddress: ip,
        reason: "Logged in successfully",
      },
    });


    const sessionToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(sessionToken).digest("hex");

    await this.db.adminSession.create({
      data: {
        userId: user.id,
        tokenHash,
        device: detectDevice(userAgent),
        userAgent,
        ipAddress: ip,
      },
    });

    await this.notifications.notifyTemplate("AUTH_NEW_DEVICE_LOGIN", {
      userId: user.id,
      context: {
        firstName: user.name.split(" ")[0],
        device: detectDevice(userAgent),
        ip: ip ?? "Unknown",
      },
    });


    return {
      message: "Logged in",
      data: {
        user: this.sanitize(user),
        accessToken: this.sign({ ...user, sessionTokenHash: tokenHash, }),
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



    await this.notifications.notifyTemplate("AUTH_PASSWORD_RESET", {
      userId: user.id,
      context: {
        firstName: user.name.split(" ")[0],
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${token}`,
      },
    });


    return { message: "If that email exists, a reset link was sent" };
  }

  async verifyEmail(token: string) {
    const record = await this.db.passwordResetToken.findUnique({
      where: { token },
    });
    if (!record || record.usedAt || record.expiresAt < new Date())
      throw new NotFoundException("Invalid or expired token");

    await this.db.$transaction([
      this.db.user.update({
        where: { id: record.userId },
        data: { 
          emailVerified: new Date(),
          isActive: true, 

        },
      }),

      this.db.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return true;
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

  async validate(payload: { sub: string; sessionTokenHash?: string }) {
    const user = await this.db.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException();

    if (payload.sessionTokenHash) {
      const session = await this.db.adminSession.findUnique({
        where: { tokenHash: payload.sessionTokenHash },
      });
      if (!session || session.revokedAt) {
        throw new UnauthorizedException("Session revoked");
      }
      // Bump activity
      await this.db.adminSession.update({
        where: { id: session.id },
        data: { lastActiveAt: new Date() },
      });
      return { ...user, sessionTokenHash: payload.sessionTokenHash };
    }

    return user;
  }
}