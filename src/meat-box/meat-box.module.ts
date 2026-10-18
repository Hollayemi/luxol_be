import { Module } from '@nestjs/common';
import { MeatBoxService } from './meat-box.service.js';
import { PublicMeatBoxController , MeatBoxOrdersController} from './meat-box.controller.js';
import { PaystackService } from '../payments/paystack.service.js';
import { DatabaseService } from '../database/database.service.js';
import { AdminMeatBoxController } from './admin/admin-meat-box.controller.js';
import { AdminMeatBoxOrdersService } from './admin/meat-box-orders.service.js';
import { AdminMeatBoxCatalogueService } from './admin/meat-box-catalogue.service.js';
import { CloudinaryService } from '../cloudinary/cloudinary.js';

@Module({
  controllers: [PublicMeatBoxController, MeatBoxOrdersController, AdminMeatBoxController ],
  providers: [MeatBoxService, PaystackService, DatabaseService, AdminMeatBoxOrdersService, AdminMeatBoxCatalogueService, CloudinaryService, DatabaseService],
})
export class MeatBoxModule {}
