import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function getDataDirectory() {
  const configuredDirectory = process.env.MINI_INVENTARIO_DATA_DIR;
  if (configuredDirectory) return path.resolve(configuredDirectory);

  if (process.platform === "win32") {
    return path.join(process.env.PROGRAMDATA || "C:\\ProgramData", "MiniInventario");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "MiniInventario");
  }
  return path.join(
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"),
    "mini-inventario",
  );
}

function hasAbsoluteDatabasePath(databaseUrl: string | undefined) {
  if (!databaseUrl?.startsWith("file:")) return false;
  const rawPath = databaseUrl.slice(5).split("?")[0];
  const normalizedPath =
    process.platform === "win32" && /^\/+[A-Za-z]:\//.test(rawPath)
      ? rawPath.replace(/^\/+/, "")
      : rawPath;
  return path.isAbsolute(normalizedPath);
}

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("file:")) {
  throw new Error("DATABASE_URL debe apuntar a SQLite con el prefijo file:.");
}

if (
  process.env.MINI_INVENTARIO_DATA_DIR ||
  !process.env.DATABASE_URL ||
  (process.env.NODE_ENV === "production" && !hasAbsoluteDatabasePath(process.env.DATABASE_URL))
) {
  const dataDirectory = getDataDirectory();
  mkdirSync(dataDirectory, { recursive: true });
  const databasePath = path.join(dataDirectory, "mini-inventario.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${databasePath}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
