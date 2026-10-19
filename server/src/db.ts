import { PrismaClient } from '@prisma/client';

let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes('HOSTINGER_SERVER_IP_OR_DOMAIN')) {
  dbUrl = dbUrl.replace('HOSTINGER_SERVER_IP_OR_DOMAIN', '127.0.0.1');
}

export const prisma = new PrismaClient({
  datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

