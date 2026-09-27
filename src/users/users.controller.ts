import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UsersService } from "./users.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { UpdateProfileDto } from "./dto/update-profile.dto.js";
import { ChangePasswordDto } from "./dto/change-password.dto.js";
import { CreateAddressDto } from "./dto/create-address.dto.js";
import { UpdateAddressDto } from "./dto/update-address.dto.js";
import { CloudinaryService } from "../cloudinary/cloudinary.js";

@UseGuards(JwtAuthGuard)
@Controller("users/me")
export class UsersController {
  constructor(
    private users: UsersService,
    private cloudinary: CloudinaryService,
  ) {}

  @Get()
  async getMe(@CurrentUser() user: { id: string }) {
    return { message: "OK", data: await this.users.getMe(user.id) };
  }

  @Patch()
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return {
      message: "Profile updated",
      data: await this.users.updateProfile(user.id, dto),
    };
  }

  @Patch("password")
  async changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
  ) {
    await this.users.changePassword(user.id, dto);
    return { message: "Password updated", data: null };
  }

  // ─── Avatar ─────────────────────────────────────────────────

  @Post("avatar")
  @UseInterceptors(
    FileInterceptor("avatar", {
      limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file provided");

    const avatarUrl = await this.cloudinary.upload(file, user.id);
    return {
      message: "Avatar updated",
      data: await this.users.setAvatar(user.id, avatarUrl),
    };
  }

  // ─── Addresses ──────────────────────────────────────────────

  @Get("addresses")
  async listAddresses(@CurrentUser() user: { id: string }) {
    return {
      message: "OK",
      data: await this.users.listAddresses(user.id),
    };
  }

  @Post("addresses")
  async addAddress(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateAddressDto,
  ) {
    return {
      message: "Address added",
      data: await this.users.addAddress(user.id, dto),
    };
  }

  @Patch("addresses/:id")
  async updateAddress(
    @CurrentUser() user: { id: string },
    @Param("id") id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return {
      message: "Address updated",
      data: await this.users.updateAddress(user.id, id, dto),
    };
  }

  @Delete("addresses/:id")
  async deleteAddress(
    @CurrentUser() user: { id: string },
    @Param("id") id: string,
  ) {
    return {
      message: "Address deleted",
      data: await this.users.deleteAddress(user.id, id),
    };
  }
}