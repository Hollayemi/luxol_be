import { Injectable, UseGuards, applyDecorators } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { RolesGuard } from "./roles.guard.js";
import { Role } from "../../generated/prisma/enums.js";
import { Roles } from "../decorators/roles.decorator.js";

export function AdminOnly() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(Role.ADMIN, Role.SUPER_ADMIN),
  );
}