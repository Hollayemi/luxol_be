import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Role } from "../generated/prisma/client.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { ProfileService } from "./profile.service.js";
import { SecurityService } from "./security.service.js";
import { AdminNotificationsService } from "./notifications.service.js";
import { TeamService } from "./team.service.js";
import { UpdateAdminProfileDto } from "./dto/update-profile.dto.js";
import { ChangeAdminPasswordDto } from "./dto/change-password.dto.js";
import { SetTwoFactorDto } from "./dto/set-two-factor.dto.js";
import { ListLoginActivityDto } from "./dto/list-login-activity.dto.js";
import { UpdateNotificationSettingsDto } from "./dto/update-notification-settings.dto.js";
import { InviteAdminUserDto } from "./dto/invite-admin.dto.js";
import { UpdateTeamStatusDto } from "./dto/update-team-status.dto.js";

const STAFF: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATIONS_MANAGER",
  "INVENTORY_MANAGER",
  "SUPPORT",
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF)
@Controller("admin/settings")
export class AdminSettingsController {
  constructor(
    private profile: ProfileService,
    private security: SecurityService,
    private notifications: AdminNotificationsService,
    private team: TeamService,
  ) {}

  // ─── Profile ─────────────────────────────────────────────

  @Get("profile")
  async getProfile(@CurrentUser() u: { id: string }) {
    return { message: "OK", data: await this.profile.get(u.id) };
  }

  @Patch("profile")
  @UseInterceptors(FileInterceptor("avatar", { limits: { fileSize: 4 * 1024 * 1024 } }))
  async updateProfile(
    @CurrentUser() u: { id: string },
    @Body() dto: UpdateAdminProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const allowed = ["image/png", "image/jpeg", "image/jpg", "image/gif"];
      if (!allowed.includes(file.mimetype)) {
        throw new BadRequestException("Only PNG, JPG or GIF images are allowed");
      }
    }
    return {
      message: "Profile updated",
      data: await this.profile.update(u.id, dto, file),
    };
  }

  @Get("roles")
  async listRoles() {
    return { message: "OK", data: this.profile.listRoles() };
  }

  // ─── Security ────────────────────────────────────────────

  @Get("security")
  async getSecurity(@CurrentUser() u: { id: string }) {
    return { message: "OK", data: await this.security.get(u.id) };
  }

  @Post("security/password")
  async changePassword(
    @CurrentUser() u: { id: string },
    @Body() dto: ChangeAdminPasswordDto,
  ) {
    return {
      message: "Password changed",
      data: await this.security.changePassword(u.id, dto),
    };
  }

  @Patch("security/two-factor")
  async setTwoFactor(
    @CurrentUser() u: { id: string },
    @Body() dto: SetTwoFactorDto,
  ) {
    return {
      message: "Two-factor updated",
      data: await this.security.setTwoFactor(u.id, dto),
    };
  }

  @Get("security/sessions")
  async listSessions(
    @CurrentUser() u: { id: string },
    @Req() req: any,
  ) {
    const tokenHash = req.user?.sessionTokenHash ?? null;
    return {
      message: "OK",
      data: await this.security.listSessions(u.id, tokenHash),
    };
  }

  @Delete("security/sessions/:id")
  async revokeSession(
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Req() req: any,
  ) {
    const tokenHash = req.user?.sessionTokenHash ?? null;
    const result = await this.security.revokeSession(u.id, id, tokenHash);
    return { message: "Session revoked", data: { id: result.id } };
  }

  @Get("security/login-activity")
  async listLoginActivity(
    @CurrentUser() u: { id: string },
    @Query() dto: ListLoginActivityDto,
  ) {
    return {
      message: "OK",
      data: await this.security.listLoginActivity(u.id, dto),
    };
  }

  // ─── Notifications ───────────────────────────────────────

  @Get("notifications")
  async getNotifications(@CurrentUser() u: { id: string }) {
    return { message: "OK", data: await this.notifications.get(u.id) };
  }

  @Patch("notifications")
  async updateNotifications(
    @CurrentUser() u: { id: string },
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return {
      message: "Notification settings updated",
      data: await this.notifications.update(u.id, dto),
    };
  }

  // ─── Team ────────────────────────────────────────────────

  @Get("team")
  async listTeam(@CurrentUser() u: { id: string }) {
    return { message: "OK", data: await this.team.list(u.id) };
  }

  @Patch("team/:id/status")
  async updateTeamStatus(
    @Param("id") id: string,
    @Body() dto: UpdateTeamStatusDto,
    @CurrentUser() u: { id: string },
  ) {
    return {
      message: "Team member updated",
      data: await this.team.updateStatus(id, dto, u.id),
    };
  }

  @Delete("team/:id")
  async removeTeamMember(
    @Param("id") id: string,
    @CurrentUser() u: { id: string },
  ) {
    return {
      message: "Team member removed",
      data: await this.team.remove(id, u.id),
    };
  }
}

// ─── Invitations (separate controller, same admin guard) ───
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF)
@Controller("admin/invitations")

export class AdminInvitationsController {
  constructor(private team: TeamService) {}
  @Post()
  async invite(
    @Body() dto: InviteAdminUserDto,
    @CurrentUser() u: { id: string },
  ) {
    return {
      message: "Invitation sent",
      data: await this.team.invite(dto, u.id),
    };
  }

  @Post(":id/resend")
  async resend(@Param("id") id: string) {
    return { message: "Invitation resent", data: await this.team.resend(id) };
  }
}