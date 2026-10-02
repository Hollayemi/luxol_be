import { IsEmail, IsEnum } from "class-validator";
import { Role } from "../../generated/prisma/client.js";

export class InviteAdminUserDto {
  @IsEmail() email: string;

  @IsEnum(Role) role: Role;
}