import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "../generated/prisma/client.js";
import { randomBytes } from "crypto";
import { InviteAdminUserDto } from "./dto/invite-admin.dto.js";
import { UpdateTeamStatusDto } from "./dto/update-team-status.dto.js";
import { serializeTeamMember } from "./settings.serializer.js";
import { STAFF_ROLES } from "./settings.constants.js";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class TeamService {
  constructor(private db: DatabaseService) {}

  async list(currentUserId: string) {
    const [users, invitations] = await Promise.all([
      this.db.user.findMany({
        where: { role: { in: STAFF_ROLES } },
        orderBy: { createdAt: "desc" },
      }),
      this.db.adminInvitation.findMany({
        where: {
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const items = [
      // Real users
      ...users.map((u) =>
        serializeTeamMember(
          { ...u, teamStatus: "ACTIVE" },
          { canManage: u.id !== currentUserId },
        ),
      ),
      // Pending invitations — show them as INVITED rows
      ...invitations.map((inv) => ({
        id: `invite_${inv.id}`,
        fullName: inv.email.split("@")[0],
        avatar: null,
        email: inv.email,
        role: inv.role.toLowerCase(),
        roleLabel: STAFF_ROLES.includes(inv.role)
          ? inv.role.replace("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
          : "Admin",
        lastActiveAt: null,
        status: "invited" as const,
        canManage: true,
      })),
    ];

    return { items };
  }

  async invite(dto: InviteAdminUserDto, invitedById: string) {
    if (!STAFF_ROLES.includes(dto.role)) {
      throw new BadRequestException("Invalid role");
    }

    const email = dto.email.toLowerCase();

    // Already a staff user?
    const existingUser = await this.db.user.findUnique({ where: { email } });
    if (existingUser && STAFF_ROLES.includes(existingUser.role)) {
      throw new ConflictException("This email is already a team member");
    }

    // Pending invite already exists?
    const existingInvite = await this.db.adminInvitation.findFirst({
      where: {
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvite) {
      throw new ConflictException("An invitation is already pending for this email");
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.db.adminInvitation.create({
      data: {
        email,
        token,
        role: dto.role,
        invitedById,
        expiresAt,
      },
    });

    // TODO: send email with `${FRONTEND_URL}/admin/accept-invite?token=${token}`

    return {
      id: `invite_${invitation.id}`,
      fullName: email.split("@")[0],
      avatar: null,
      email,
      role: dto.role.toLowerCase(),
      roleLabel: dto.role.replace("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
      lastActiveAt: null,
      status: "invited" as const,
      canManage: true,
    };
  }

  async resend(invitationId: string) {
    const invite = await this.db.adminInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invite || invite.acceptedAt || invite?.revokedAt) {
      throw new NotFoundException("Invitation not found");
    }

    // Rotate the token + extend the expiry
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.db.adminInvitation.update({
      where: { id: invitationId },
      data: { token, expiresAt },
    });

    // TODO: send the email

    return { id: `invite_${invitationId}` };
  }

  async updateStatus(
    id: string,
    dto: UpdateTeamStatusDto,
    currentUserId: string,
  ) {
    if (id === currentUserId) {
      throw new BadRequestException("You cannot change your own status");
    }

    const user = await this.db.user.findUnique({ where: { id } });
    if (!user || !STAFF_ROLES.includes(user.role)) {
      throw new NotFoundException("Team member not found");
    }

    await this.db.user.update({
      where: { id },
      data: {
        teamStatus: dto.status === "active" ? "ACTIVE" : "SUSPENDED",
        // Suspending should also lock them out immediately
        isActive: dto.status === "active",
      },
    });

    // Revoke their live sessions when suspended
    if (dto.status === "suspended") {
      await this.db.adminSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const refreshed = await this.db.user.findUniqueOrThrow({ where: { id } });

    return serializeTeamMember(refreshed, { canManage: true });
  }

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException("You cannot remove yourself");
    }

    const user = await this.db.user.findUnique({ where: { id } });
    if (!user || !STAFF_ROLES.includes(user.role)) {
      throw new NotFoundException("Team member not found");
    }

    // Prevent removing the last Super Admin
    if (user.role === "SUPER_ADMIN") {
      const superCount = await this.db.user.count({
        where: { role: "SUPER_ADMIN", teamStatus: "ACTIVE" },
      });
      if (superCount <= 1) {
        throw new BadRequestException("Cannot remove the last Super Admin");
      }
    }

    await this.db.user.delete({ where: { id } });
    return { id };
  }
}