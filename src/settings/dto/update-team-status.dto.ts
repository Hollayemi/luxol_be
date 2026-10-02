import { Transform } from "class-transformer";
import { IsEnum } from "class-validator";

export enum SettableTeamStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
}

export class UpdateTeamStatusDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.toLowerCase() : value,
  )
  @IsEnum(SettableTeamStatus)
  status: SettableTeamStatus;
}