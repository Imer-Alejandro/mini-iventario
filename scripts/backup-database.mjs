import { readFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(projectRoot, ".env");

try {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

function getDataDirectory() {
  if (process.env.MINI_INVENTARIO_DATA_DIR) {
    return path.resolve(process.env.MINI_INVENTARIO_DATA_DIR);
  }
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

function hasAbsoluteDatabasePath(databaseUrl) {
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
  !process.env.DATABASE_URL ||
  (process.env.NODE_ENV === "production" && !hasAbsoluteDatabasePath(process.env.DATABASE_URL))
) {
  const dataDirectory = getDataDirectory();
  mkdirSync(dataDirectory, { recursive: true });
  const databasePath = path.join(dataDirectory, "mini-inventario.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${databasePath}`;
}

if (!process.env.DATABASE_URL.startsWith("file:")) {
  throw new Error("DATABASE_URL debe apuntar a una base SQLite con el prefijo file:.");
}

const databaseUrlPath = process.env.DATABASE_URL.slice(5).split("?")[0];
const normalizedDatabasePath =
  process.platform === "win32" && /^\/+[A-Za-z]:\//.test(databaseUrlPath)
    ? databaseUrlPath.replace(/^\/+/, "")
    : databaseUrlPath;
const databasePath = path.isAbsolute(normalizedDatabasePath)
  ? normalizedDatabasePath
  : path.resolve(projectRoot, "prisma", normalizedDatabasePath);
const backupDirectory =
  process.env.MINI_INVENTARIO_BACKUP_DIR || path.join(path.dirname(databasePath), "backups");
const retentionDays = Number(process.env.MINI_INVENTARIO_BACKUP_RETENTION_DAYS || "30");

if (!Number.isInteger(retentionDays) || retentionDays < 1) {
  throw new Error("MINI_INVENTARIO_BACKUP_RETENTION_DAYS debe ser un entero mayor que cero.");
}

mkdirSync(backupDirectory, { recursive: true });
const now = new Date();
const timestamp = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
].join("-") + "_" + [
  String(now.getHours()).padStart(2, "0"),
  String(now.getMinutes()).padStart(2, "0"),
  String(now.getSeconds()).padStart(2, "0"),
].join("-");
const backupPath = path.join(backupDirectory, `mini-inventario-${timestamp}.db`);
const prisma = new PrismaClient();

try {
  const escapedPath = backupPath.replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${escapedPath}'`);

  if (statSync(backupPath).size === 0) {
    throw new Error("La copia SQLite creada está vacía.");
  }

  const expiry = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  for (const filename of readdirSync(backupDirectory)) {
    if (!/^mini-inventario-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/.test(filename)) continue;
    const fullPath = path.join(backupDirectory, filename);
    if (statSync(fullPath).mtimeMs < expiry) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(fullPath);
    }
  }

  console.log(`Copia SQLite creada: ${backupPath}`);
} finally {
  await prisma.$disconnect();
}
