import { Module } from '@nestjs/common';
import { AdminInvitationsController, AdminSettingsController } from './settings.controller.js';
import { CloudinaryService } from '../cloudinary/cloudinary.js';
import { DatabaseService } from '../database/database.service.js';
import { AdminNotificationsService } from './notifications.service.js';
import { SecurityService } from './security.service.js';
import { ProfileService } from './profile.service.js';
import { TeamService } from './team.service.js';

@Module({
  controllers: [AdminSettingsController, AdminInvitationsController],
  providers: [TeamService, ProfileService, SecurityService, AdminNotificationsService, DatabaseService, CloudinaryService,  ],
})
export class SettingsModule {}
