import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Función auxiliar para ejecutar transacciones en CockroachDB con reintento automático
 * ante contención de concurrencia (Error 40001: retry transaction).
 */
export async function withCockroachTransaction<T>(
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
  maxRetries = 5,
  delayMs = 100
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await prisma.$transaction(async (tx) => {
        return await fn(tx);
      }, {
        isolationLevel: "Serializable", // CockroachDB usa Serializable por defecto
      });
    } catch (error: unknown) {
      attempt++;
      // Error de contención de CockroachDB o código 40001
      const errorCode =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : undefined;
      const errorMessage = error instanceof Error ? error.message : "";
      const isContentionError =
        errorCode === "P2034" ||
        errorMessage.includes("restart transaction") ||
        errorMessage.includes("40001");

      if (isContentionError && attempt < maxRetries) {
        const backoff = delayMs * Math.pow(2, attempt - 1) + Math.random() * 50;
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      throw error;
    }
  }
}
