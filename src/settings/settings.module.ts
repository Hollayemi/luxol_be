import { Module } from '@nestjs/common';
import { AdminSettingsController } from './settings.controller.js';
import { CloudinaryService } from '../cloudinary/cloudinary.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from './notifications.service.js';
import { SecurityService } from './security.service.js';
import { ProfileService } from './profile.service.js';
import { TeamService } from './team.service.js';

@Module({
  controllers: [AdminSettingsController],
  providers: [TeamService, ProfileService, SecurityService, NotificationsService, DatabaseService, CloudinaryService],
})
export class SettingsModule {}
