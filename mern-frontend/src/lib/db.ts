import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  try {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })
  } catch (error: any) {
    if (error?.message?.includes('did not initialize yet')) {
      console.error(
        '\n' +
        '╔══════════════════════════════════════════════════════════════╗\n' +
        '║  Prisma Client not initialized!                             ║\n' +
        '║                                                              ║\n' +
        '║  Run these commands in the mern-frontend directory:          ║\n' +
        '║                                                              ║\n' +
        '║    npx prisma generate                                       ║\n' +
        '║    npx prisma db push                                        ║\n' +
        '║                                                              ║\n' +
        '║  Then restart the dev server.                                ║\n' +
        '╚══════════════════════════════════════════════════════════════╝\n'
      )
    }
    throw error
  }
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
