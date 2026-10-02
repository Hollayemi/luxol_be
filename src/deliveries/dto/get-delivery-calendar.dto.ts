export class CreateDeliveryDto { }
import { Transform } from "class-transformer";
import { IsEnum, IsISO8601, IsOptional, Matches } from "class-validator";
import { DeliveryStatus } from "../../generated/prisma/enums.js";
import { AdminDeliveryTypeEnum } from "../delivery-types.enum.js";

/**
 * YYYY-MM-DD format expected (not ISO datetime).
 * Use Matches, not IsISO8601 — the frontend sends plain dates.
 */
export class GetDeliveryCalendarDto {
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "from must be YYYY-MM-DD" })
    from: string;

    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "to must be YYYY-MM-DD" })
    to: string;

    @IsOptional()
    @Transform(({ value }) =>
        typeof value === "string" ? value.toLowerCase() : value,
    )

    @IsOptional()
    @Transform(({ value }) =>
        typeof value === "string" ? value.toUpperCase() : value,
    )
    @IsEnum(DeliveryStatus)
    status?: DeliveryStatus;

    @IsOptional()
    @IsEnum(AdminDeliveryTypeEnum)
    type?: AdminDeliveryTypeEnum;
}
