import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "../generated/prisma/client.js";
import { randomBytes } from "crypto";
import * as bcrypt from "bcrypt";
import { InviteAdminUserDto } from "./dto/invite-admin.dto.js";
import { UpdateTeamStatusDto } from "./dto/update-team-status.dto.js";
import { AcceptInviteDto } from "./dto/accept-invite.dto.js";
import { serializeTeamMember } from "./settings.serializer.js";
import { ROLE_LABELS, STAFF_ROLES } from "./settings.constants.js";
import { DatabaseService } from "../database/database.service.js";
import { NotificationsService } from "../notification/notifications.service.js";
import { serializeUserProfile, UserRow } from "../users/users.serializer.js";

@Injectable()
export class TeamService {
  constructor(
    private db: DatabaseService,
    private notifications: NotificationsService
  ) { }

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
      ...users.map((u) =>
        serializeTeamMember(
          { ...u, teamStatus: "ACTIVE" },
          { canManage: u.id !== currentUserId },
        ),
      ),
      ...invitations.map((inv) => ({
        id: `invite_${inv.id}`,
        fullName: inv.email.split("@")[0],
        avatar: null,
        email: inv.email,
        role: inv.role.toLowerCase(),
        roleLabel: ROLE_LABELS[inv.role] || "Admin",
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

    // Create the invitation
    const invitation = await this.db.adminInvitation.create({
      data: {
        email,
        token,
        role: dto.role,
        invitedById,
        expiresAt,
      },
    });

    // Send the email
    await this.notifications.notifyTemplate("ADMIN_INVITE_NEW_STAFF", {
      userId: existingUser?.id,
      context: {
        memberName: existingUser?.name || email.split("@")[0],
        roleLabel: ROLE_LABELS[dto.role],
        actionUrl: `${process.env.FRONTEND_URL}/admin/auth/invite?token=${token}`,
      },
    });

    return {
      id: `invite_${invitation.id}`,
      fullName: email.split("@")[0],
      avatar: null,
      email,
      role: dto.role.toLowerCase(),
      roleLabel: ROLE_LABELS[dto.role],
      lastActiveAt: null,
      status: "invited" as const,
      canManage: true,
    };
  }

  async resend(invitationId: string) {
    const id = invitationId.split("_")[1]
    const invite = await this.db.adminInvitation.findUnique({
      where: { id },
    });
    if (!invite || invite.acceptedAt || invite.revokedAt) {
      throw new NotFoundException("Invitation not found or already accepted");
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const user = await this.db.user.findUnique({ where: { email: invite.email } });

    const invitation = await this.db.adminInvitation.update({
      where: { id },
      data: { token, expiresAt },
    });

    await this.notifications.notifyTemplate("ADMIN_INVITE_NEW_STAFF", {
      userId: user?.id,
      email: invitation.email,
      context: {
        memberName: user?.name || invite.email.split("@")[0],
        roleLabel: ROLE_LABELS[invite.role],
        actionUrl: `${process.env.FRONTEND_URL}/admin/accept-invite?token=${token}`,
      },
    });

    return { id: `invite_${invitationId}` };
  }

  // ─── NEW: Accept Flow ────────────────────────────────────────

  async verifyInvitation(token: string) {
    const invite = await this.db.adminInvitation.findUnique({
      where: { token },
    });

    console.log(invite)

    if (!invite) throw new NotFoundException("Invalid invitation link");
    if (invite.acceptedAt) throw new BadRequestException("Invitation already accepted");
    if (invite.revokedAt) throw new BadRequestException("Invitation was revoked");
    if (invite.expiresAt < new Date()) throw new BadRequestException("Invitation has expired");

    const existingUser = await this.db.user.findUnique({
      where: { email: invite.email },
    });

    console.log(existingUser)

    return {
      email: invite.email,
      role: invite.role.toLowerCase(),
      roleLabel: ROLE_LABELS[invite.role],
      user: existingUser && serializeUserProfile(existingUser as UserRow) || {},
      hasAccount: !!existingUser,
    };
  }

  async acceptInvitation(token: string, dto: AcceptInviteDto) {
    const invite = await this.db.adminInvitation.findUnique({
      where: { token },
    });

    if (!invite) throw new NotFoundException("Invalid invitation link");
    if (invite.acceptedAt) throw new BadRequestException("Invitation already accepted");
    if (invite.revokedAt) throw new BadRequestException("Invitation was revoked");
    if (invite.expiresAt < new Date()) throw new BadRequestException("Invitation has expired");

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.db.$transaction(async (tx) => {
      // Find or create the user
      let existingUser = await tx.user.findUnique({
        where: { email: invite.email },
      });

      if (existingUser) {
        // Upgrade existing customer to staff
        existingUser = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            role: invite.role,
            emailVerified: existingUser.emailVerified ?? new Date(), // auto-verify since they clicked the email
            teamStatus: "ACTIVE",
            isActive: true,
          },
        });
      } else {
        existingUser = await tx.user.create({
          data: {
            email: invite.email,
            name: dto.name,
            passwordHash,
            phone: dto.phone,
            role: invite.role,
            teamStatus: "ACTIVE",
            emailVerified: new Date(),
            isActive: true,
          },
        });
      }

      // Mark invite accepted
      await tx.adminInvitation.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return existingUser;
    });

    // Return the user and a token so they can immediately login
    return {
      message: "Invitation accepted. You can now log in.",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  // ─── Manage Team ─────────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateTeamStatusDto, currentUserId: string) {
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
        isActive: dto.status === "active",
      },
    });

    if (dto.status === "suspended") {
      await this.db.adminSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const refreshed = await this.db.user.findUniqueOrThrow({ where: { id } });
    return serializeTeamMember(refreshed, { canManage: true });
  }

  async remove(invitationId: string, currentUserId: string) {
    const id = invitationId.split("_")[1]
    const isInvite = invitationId.split("_")[0] === "invite"
    if (id === currentUserId) {
      throw new BadRequestException("You cannot remove yourself");
    }

    const user = await this.db.user.findUnique({ where: { id } });
    if (!user || !STAFF_ROLES.includes(user.role)) {
      if (isInvite) {
        await this.db.adminInvitation.deleteMany({ where: { id } });
        return { id };
      }
      throw new NotFoundException("Team member not found--");
    }

    if (user.role === "SUPER_ADMIN") {
      const superCount = await this.db.user.count({
        where: { role: "SUPER_ADMIN", teamStatus: "ACTIVE" },
      });
      if (superCount <= 1) {
        throw new BadRequestException("Cannot remove the last Super Admin");
      }
    }

    await this.db.user.update({ where: { id }, data: { role: Role.CUSTOMER } });

    await this.db.adminInvitation.deleteMany({ where: { email: user.email } });
    return { id };
  }
}