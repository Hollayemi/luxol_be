import {
  Controller, Post, Delete, Param, Query,
  UploadedFile, UploadedFiles, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CloudinaryService } from './cloudinary.js';


const multerOpts = { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } };

@Controller('upload')
export class CloudinaryController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  // Single upload → { url }
  @Post()
  @UseInterceptors(FileInterceptor('file', multerOpts))
  async uploadOne(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file');
    const url = await this.cloudinary.upload(file);
    return { url };
  }

  // Bulk upload → { urls: [...] }
  @Post('bulk')
  @UseInterceptors(FilesInterceptor('files', 10, multerOpts))
  async uploadBulk(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('No files');
    const urls = await this.cloudinary.uploadMany(files);
    return { urls };
  }

  // Delete → pass the publicId
  @Delete(':publicId')
  async remove(@Param('publicId') publicId: string, @Query('type') type?: any) {
    return this.cloudinary.delete(publicId, type);
  }
}