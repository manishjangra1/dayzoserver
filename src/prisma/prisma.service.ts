import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static pool: Pool;

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://dayzo_user:dayzo_password@127.0.0.1:5432/dayzo_db?schema=public',
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    PrismaService.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await PrismaService.pool.end();
  }
}
