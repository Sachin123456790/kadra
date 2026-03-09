import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    // Serverless: 1 connection per function instance to avoid exhausting Supabase pooler
    // Session mode pooler required for interactive transactions ($transaction)
    const poolSize = process.env.VERCEL ? 1 : 10;
    const adapter = new PrismaPg({
      connectionString,
      max: poolSize,
      idleTimeoutMillis: process.env.VERCEL ? 5000 : 30000,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
