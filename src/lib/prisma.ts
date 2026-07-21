import { PrismaClient } from '@prisma/client';

// O endpoint Neon (pooler) suspende o compute quando ocioso; o "acordar" na
// primeira conexão pode passar do timeout padrão do driver e derrubar a
// requisição com "Can't reach database server". Garante um connect_timeout
// generoso o suficiente para aguardar esse cold start.
function withConnectTimeout(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '20');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

// Reutiliza a instância em serverless (hot reloads / warm lambdas)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: { url: withConnectTimeout(process.env.DATABASE_URL) },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
