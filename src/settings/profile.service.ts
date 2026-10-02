import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "../generated/prisma/client.js";
import { UpdateAdminProfileDto } from "./dto/update-profile.dto.js";
import { serializeProfile } from "./settings.serializer.js";
import { ROLE_LABELS, STAFF_ROLES } from "./settings.constants.js";
import { DatabaseService } from "../database/database.service.js";
import { CloudinaryService } from "../cloudinary/cloudinary.js";

@Injectable()
export class ProfileService {
  constructor(
    private db: DatabaseService,
    private cd: CloudinaryService,
  ) {}

  async get(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    return serializeProfile(user, {
      canChangeRole: user.role === "SUPER_ADMIN",
    });
  }

  async update(
    userId: string,
    dto: UpdateAdminProfileDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    // Only SUPER_ADMIN can change their own role
    if (dto.role && dto.role !== user.role) {
      if (user.role !== "SUPER_ADMIN") {
        throw new BadRequestException("Only a Super Admin can change their role");
      }
      if (!STAFF_ROLES.includes(dto.role)) {
        throw new BadRequestException("Invalid role");
      }
    }

    // Email uniqueness
    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const clash = await this.db.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
      if (clash) throw new ConflictException("Email already in use");
    }

    const image = file ? await this.cd.upload(file) : undefined;


    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        name: user.name,
        email: dto.email ? dto.email.toLowerCase() : undefined,
        role: dto.role ?? undefined,
        bio: dto.bio === undefined ? undefined : dto.bio,
        image: image === undefined ? undefined : image,
      },
    });

    return serializeProfile(updated, {
      canChangeRole: updated.role === "SUPER_ADMIN",
    });
  }

  listRoles() {
    return {
      items: STAFF_ROLES.map((r) => ({
        value: r.toLowerCase(),
        label: ROLE_LABELS[r],
      })),
    };
  }
}