import { Injectable } from "@nestjs/common";
import { UpdateNotificationSettingsDto } from "./dto/update-notification-settings.dto.js";
import { serializeNotificationSettings } from "./settings.serializer.js";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class NotificationsService {
  constructor(private db: DatabaseService) {}

  async get(userId: string) {
    const [settings, prefs] = await Promise.all([
      this.db.adminNotificationSettings.findUnique({ where: { userId } }),
      this.db.notificationPreference.findMany({ where: { userId } }),
    ]);
    return serializeNotificationSettings(settings, prefs);
  }

  async update(userId: string, dto: UpdateNotificationSettingsDto) {
    await this.db.$transaction(async (tx) => {
      // Quiet hours / sound
      if (dto.quietHours !== undefined || dto.sound !== undefined) {
        await tx.adminNotificationSettings.upsert({
          where: { userId },
          update: {
            quietHoursOn: dto.quietHours?.enabled,
            quietStart: dto.quietHours?.startTime,
            quietEnd: dto.quietHours?.endTime,
            sound: dto.sound,
          },
          create: {
            userId,
            quietHoursOn: dto.quietHours?.enabled ?? false,
            quietStart: dto.quietHours?.startTime ?? "22:00",
            quietEnd: dto.quietHours?.endTime ?? "07:00",
            sound: dto.sound ?? "chime",
          },
        });
      }

      // Per-event preferences
      if (dto.preferences?.length) {
        for (const pref of dto.preferences) {
          await tx.notificationPreference.upsert({
            where: { userId_key: { userId, key: pref.key } },
            update: {
              email: pref.email,
              push: pref.push,
            },
            create: {
              userId,
              key: pref.key,
              email: pref.email ?? true,
              push: pref.push ?? true,
            },
          });
        }
      }
    });

    return this.get(userId);
  }
}