import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class DatabaseService extends PrismaClient {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: "postgresql://admin:12345@localhost:5432/luxol?schema=public" // process.env.DATABASE_URL!,
    });

    super({ adapter });
  }
}