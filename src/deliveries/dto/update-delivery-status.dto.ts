import { Transform } from "class-transformer";
import { IsEnum } from "class-validator";
import { DeliveryStatus } from "../../generated/prisma/enums.js";

/**
 * Only these three can be set by hand. SCHEDULED is the default; SKIPPED is
 * set by the customer's skip action, not by staff.
 */
export class UpdateDeliveryStatusDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase() : value,
  )
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;
}