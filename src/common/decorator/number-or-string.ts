import { applyDecorators } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsNumber } from "class-validator";

export function IsNumberLike() {
  return applyDecorators(
    Transform(({ value }) => (value === undefined || value === null || value === "" ? value : Number(value))),
    IsNumber(),
  );
}