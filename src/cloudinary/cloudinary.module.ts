// src/cloudinary/cloudinary.module.ts
import { Global, Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.js';

@Global()
@Module({
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}