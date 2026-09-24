import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ObserveModule.forRoot({
      appKey: 'Ovb9DPHg&zOypzWs',
      appSecret: 'v6fzLl22$XB$GbtmzXM^roiVoQefjrK9^ELcx$$nFZnTX',
      serviceId: 'luxol_backend',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
