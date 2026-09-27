import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ProductsModule } from './products/products.module.js';
import { CloudinaryModule } from './cloudinary/cloudinary.module.js';
import { CloudinaryController } from './cloudinary/cloudinary.controller.js';
import { UsersModule } from './users/users.module.js';
import { CartModule } from './cart/cart.module.js';
import { PromotionsModule } from './promotions/promotion.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaymentsModule } from './payments/payments.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true }),
    DatabaseModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    CloudinaryModule,
    UsersModule,
    CartModule,
    PromotionsModule,
    OrdersModule,
    PaymentsModule,
    // ObserveModule.forRoot({
    //   appKey: 'Ovb9DPHg&zOypzWs',
    //   appSecret: 'v6fzLl22$XB$GbtmzXM^roiVoQefjrK9^ELcx$$nFZnTX',
    //   serviceId: 'luxol_backend',
    // }),
  ],
  controllers: [AppController, CloudinaryController],
  providers: [AppService],
})
export class AppModule {}
