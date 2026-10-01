import { PartialType } from "@nestjs/mapped-types";
import { CreateProteinDto } from "./create-protein.dto.js";
export class UpdateProteinDto extends PartialType(CreateProteinDto) {}