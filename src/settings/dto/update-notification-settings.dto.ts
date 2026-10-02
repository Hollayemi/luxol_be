import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from "class-validator";

class QuietHoursDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) startTime?: string;
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) endTime?: string;
}

class PreferenceDto {
  @IsString() key: string;
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() push?: boolean;
}

export class UpdateNotificationSettingsDto {
  @IsOptional() @ValidateNested() @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;

  @IsOptional() @IsString() sound?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceDto)
  preferences?: PreferenceDto[];
}