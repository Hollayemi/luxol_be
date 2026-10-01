import { Module } from '@nestjs/common';
import { MembershipService } from './membership.service.js';
import { PublicMembershipController, SubscriptionController } from './membership.controller.js';
import { AdminMembershipService } from './admin-membership.service.js';
import { DatabaseService } from '../database/database.service.js';
import { AdminMembershipController } from './admin-membership.controller.js';
import { ConfigService } from '@nestjs/config';
import { PaystackService } from '../payments/paystack.service.js';
import { CloudinaryService } from '../cloudinary/cloudinary.js';

@Module({
  controllers: [PublicMembershipController, SubscriptionController, AdminMembershipController],
  providers: [MembershipService, AdminMembershipService, DatabaseService, ConfigService, PaystackService, CloudinaryService],
  exports: [MembershipService, AdminMembershipService, DatabaseService, ConfigService, PaystackService, CloudinaryService]
})
export class MembershipModule {}
