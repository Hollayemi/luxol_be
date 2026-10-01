import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { MembershipService } from "./membership.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { SubscribeDto } from "./dto/subscribe.dto.js";
import { ChangePlanDto } from "./dto/change-plan.dto.js";
import { UpdateMixDto } from "./dto/update-mix.dto.js";
import { CancelMembershipDto } from "./dto/cancel-membership.dto.js";

// ─── Public catalogue ───────────────────────────────────────
@Controller("membership")
export class PublicMembershipController {
  constructor(private svc: MembershipService) {}

  @Get("plans")
  async listPlans() {
    return { message: "OK", data: await this.svc.listPlans() };
  }

  @Get("plans/:slugOrId")
  async getPlan(@Param("slugOrId") slugOrId: string) {
    return { message: "OK", data: await this.svc.getPlan(slugOrId) };
  }

  @Get("proteins")
  async listProteins() {
    return { message: "OK", data: await this.svc.listProteins() };
  }

  @Get("options")
  async options() {
    return { message: "OK", data: this.svc.options() };
  }
}

// ─── Subscribing + my subscription ──────────────────────────
@UseGuards(JwtAuthGuard)
@Controller("membership/subscriptions")
export class SubscriptionController {
  constructor(private svc: MembershipService) {}

  @Post()
  async subscribe(@CurrentUser() u: { id: string }, @Body() dto: SubscribeDto) {
    return {
      message: "Subscription started",
      data: await this.svc.subscribe(u.id, dto),
    };
  }

  @Get("me")
  async mine(@CurrentUser() u: { id: string }) {
    return { message: "OK", data: await this.svc.getMine(u.id) };
  }

  @Post(":id/pause")
  async pause(@CurrentUser() u: { id: string }, @Param("id") id: string) {
    return { message: "Paused", data: await this.svc.pause(u.id, id) };
  }

  @Post(":id/resume")
  async resume(@CurrentUser() u: { id: string }, @Param("id") id: string) {
    return { message: "Resumed", data: await this.svc.resume(u.id, id) };
  }

  @Post(":id/skip-delivery")
  async skip(@CurrentUser() u: { id: string }, @Param("id") id: string) {
    return { message: "Delivery skipped", data: await this.svc.skipDelivery(u.id, id) };
  }

  @Patch(":id/plan")
  async changePlan(
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body() dto: ChangePlanDto,
  ) {
    return { message: "Plan changed", data: await this.svc.changePlan(u.id, id, dto) };
  }

  @Patch(":id/mix")
  async updateMix(
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body() dto: UpdateMixDto,
  ) {
    return { message: "Mix updated", data: await this.svc.updateMix(u.id, id, dto) };
  }

  @Post(":id/cancel")
  async cancel(
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body() dto: CancelMembershipDto,
  ) {
    return { message: "Cancelled", data: await this.svc.cancel(u.id, id, dto) };
  }
}