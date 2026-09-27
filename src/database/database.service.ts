import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class DatabaseService extends PrismaClient {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: "postgresql://neondb_owner:npg_pqI0BGsTxM1K@ep-weathered-sun-b5i81afm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require" // process.env.DATABASE_URL!,
    });

    super({ adapter });
  }
}