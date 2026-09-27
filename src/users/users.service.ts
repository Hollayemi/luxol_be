import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { UpdateProfileDto } from "./dto/update-profile.dto.js";
import { ChangePasswordDto } from "./dto/change-password.dto.js";
import { CreateAddressDto } from "./dto/create-address.dto.js";
import { UpdateAddressDto } from "./dto/update-address.dto.js";
import {
  serializeAddress,
  serializeUserProfile,
} from "./users.serializer.js";
import { DatabaseService } from "../database/database.service.js";
import { normalizePhone } from "../common/utils/phone.util.js";

@Injectable()
export class UsersService {
  constructor(private db: DatabaseService) {}

  // ─── Profile ────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    return serializeUserProfile(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.db.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException("User not found");

    // Email uniqueness if changed
    if (dto.email && dto.email.toLowerCase() !== existing.email) {
      const clash = await this.db.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
      if (clash) throw new ConflictException("Email already in use");
    }

    const phone = dto.phone !== undefined ? normalizePhone(dto.phone) : undefined;
    if (phone === null && dto.phone !== undefined) {
      throw new BadRequestException("Invalid phone number");
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        name: dto.name ?? undefined,
        email: dto.email ? dto.email.toLowerCase() : undefined,
        phone: phone === undefined ? undefined : phone,
      },
    });

    return serializeUserProfile(updated);
  }

  // ─── Password ───────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    if (!user.passwordHash)
      throw new BadRequestException(
        "This account uses Google sign-in. Set a password first.",
      );

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Current password is incorrect");

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        "New password must be different from the current one",
      );
    }

    const hash = await bcrypt.hash(dto.newPassword, 12);
    await this.db.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });

    return null;
  }

  // ─── Avatar ─────────────────────────────────────────────────
  // Storage strategy: writes a URL. Wire to Cloudinary/S3 later.
  // For now the caller (controller) supplies the URL after upload.

  async setAvatar(userId: string, avatarUrl: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    await this.db.user.update({
      where: { id: userId },
      data: { image: avatarUrl },
    });

    return { avatarUrl };
  }

  // ─── Addresses ──────────────────────────────────────────────

  async listAddresses(userId: string) {
    const rows = await this.db.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(serializeAddress);
  }

  async addAddress(userId: string, dto: CreateAddressDto) {
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new BadRequestException("Invalid phone number");

    const phoneSec = dto.phone_sec ? normalizePhone(dto.phone_sec) : null;

    // First address is default automatically
    const count = await this.db.address.count({ where: { userId } });
    const makeDefault = dto.isDefault === true || count === 0;

    const created = await this.db.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: {
          userId,
          fullName: dto.fullName,
          address: dto.address,
          region: dto.region,
          phone,
          phone_sec: phoneSec,
          isDefault: makeDefault,
        },
      });
    });

    return serializeAddress(created);
  }

  async updateAddress(userId: string, id: string, dto: UpdateAddressDto) {
    const existing = await this.db.address.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException("Address not found");

    let phone: string | undefined;
    if (dto.phone !== undefined) {
      const normalized = normalizePhone(dto.phone);
      if (!normalized) throw new BadRequestException("Invalid phone number");
      phone = normalized;
    }

    let phoneSec: string | null | undefined;
    if (dto.phone_sec !== undefined) {
      phoneSec = dto.phone_sec ? normalizePhone(dto.phone_sec) : null;
    }

    const updated = await this.db.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.address.update({
        where: { id },
        data: {
          fullName: dto.fullName ?? undefined,
          address: dto.address ?? undefined,
          region: dto.region ?? undefined,
          phone: phone ?? undefined,
          phone_sec: phoneSec === undefined ? undefined : phoneSec,
          isDefault: dto.isDefault ?? undefined,
        },
      });
    });

    return serializeAddress(updated);
  }

  async deleteAddress(userId: string, id: string) {
    const existing = await this.db.address.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException("Address not found");

    await this.db.address.delete({ where: { id } });

    // If we deleted the default, promote the most recent remaining one
    if (existing.isDefault) {
      const next = await this.db.address.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (next) {
        await this.db.address.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    return { id };
  }
}