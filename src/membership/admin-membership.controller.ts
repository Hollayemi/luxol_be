import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { AdminMembershipService } from "./admin-membership.service.js";
import { CreatePlanDto } from "./dto/create-plan.dto.js";
import { UpdatePlanDto } from "./dto/update-plan.dto.js";
import { ListPlansDto } from "./dto/list-plans.dto.js";
import { ListSubscribersDto } from "./dto/list-subscribers.dto.js";
import { CreateProteinDto } from "./dto/create-protein.dto.js";
import { UpdateProteinDto } from "./dto/update-protein.dto.js";
import { ListProteinsDto } from "./dto/list-proteins.dto.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { Role } from "../generated/prisma/enums.js";
import { CloudinaryService } from "../cloudinary/cloudinary.js";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller("admin/membership")
export class AdminMembershipController {
    constructor(
        private svc: AdminMembershipService,
        private cd: CloudinaryService
    ) { }

    @Get("stats")
    async stats() {
        return { message: "OK", data: await this.svc.stats() };
    }

    // ─── Plans ──────────────────────────────────────────────

    @Get("plans")
    async listPlans(@Query() dto: ListPlansDto) {
        return { message: "OK", data: await this.svc.listPlans(dto) };
    }

    @Post("plans")
    async createPlan(@Body() dto: CreatePlanDto) {
        return { message: "Plan created", data: await this.svc.createPlan(dto) };
    }

    @Patch("plans/:id")
    async updatePlan(@Param("id") id: string, @Body() dto: UpdatePlanDto) {
        return { message: "Plan updated", data: await this.svc.updatePlan(id, dto) };
    }

    @Delete("plans/:id")
    async deletePlan(@Param("id") id: string) {
        return { message: "Plan deleted", data: await this.svc.deletePlan(id) };
    }

    // ─── Subscribers ────────────────────────────────────────

    @Get("subscribers")
    async listSubscribers(@Query() dto: ListSubscribersDto) {
        return { message: "OK", data: await this.svc.listSubscribers(dto) };
    }

    // ─── Proteins ───────────────────────────────────────────

    @Get("proteins")
    async listProteins(@Query() dto: ListProteinsDto) {
        return { message: "OK", data: await this.svc.listProteins(dto) };
    }

    @Post("proteins")
    @UseInterceptors(FileInterceptor("image", { limits: { fileSize: 4 * 1024 * 1024 } }))
    async createProtein(
        @Body() dto: CreateProteinDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        if (file) {
            if (file) {
                const url = await this.cd.upload(file);
                dto.image = url
            }
        }
        return { message: "Protein created", data: await this.svc.createProtein(dto, file) };
    }

    @Patch("proteins/:id")
    @UseInterceptors(FileInterceptor("image", { limits: { fileSize: 4 * 1024 * 1024 } }))
    async updateProtein(
        @Param("id") id: string,
        @Body() dto: UpdateProteinDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        if (file) {
             if (file) {
                const url = await this.cd.upload(file);
                dto.image = url
            }
        }
        return { message: "Protein updated", data: await this.svc.updateProtein(id, dto) };
    }

    @Delete("proteins/:id")
    async deleteProtein(@Param("id") id: string) {
        return { message: "Protein deleted", data: await this.svc.deleteProtein(id) };
    }
}