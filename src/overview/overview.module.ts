import { Module } from '@nestjs/common';
import { AdminOverviewController } from './overview.controller.js';
import { AdminOverviewService } from './admin-overview.service.js';
import { DatabaseService } from '../database/database.service.js';

@Module({
  controllers: [AdminOverviewController],
  providers: [AdminOverviewService, DatabaseService],
})
export class OverviewModule {}
