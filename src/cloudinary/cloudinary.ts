// src/cloudinary/cloudinary.service.ts
import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  // Upload one file → returns the URL
  async upload(file: Express.Multer.File, folder = 'lawticha'): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (err, result) => {
          if (err || !result) return reject(err);
          resolve(result.secure_url);
        },
      );
      Readable.from(file.buffer).pipe(stream);
    });
  }

  // Upload many files → returns array of URLs
  async uploadMany(files: Express.Multer.File[], folder = 'lawticha'): Promise<string[]> {
    return Promise.all(files.map((f) => this.upload(f, folder)));
  }

  // Delete by public ID
  async delete(publicId: string, type: 'image' | 'raw' | 'video' = 'image') {
    return cloudinary.uploader.destroy(publicId, { resource_type: type });
  }
}