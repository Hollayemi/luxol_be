import { PartialType } from "@nestjs/mapped-types";
import { CreatePlanDto } from "./create-plan.dto.js";

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}