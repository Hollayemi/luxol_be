import { Transform } from "class-transformer";
import { IsEnum } from "class-validator";
import { CustomerStatus } from "../../generated/prisma/enums.js";

/**
 * Staff can only set ACTIVE or SUSPENDED.
 * INACTIVE is derived by the backend (no orders in N days) and cannot be set.
 */
export class UpdateAdminCustomerStatusDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase() : value,
  )
  @IsEnum(CustomerStatus)
  status: CustomerStatus;
}