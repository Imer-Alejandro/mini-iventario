import { readFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
  if (process.env.MINI_INVENTARIO_DATA_DIR) return path.resolve(process.env.MINI_INVENTARIO_DATA_DIR);
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

const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";
const env = { ...process.env, NODE_ENV: production ? "production" : process.env.NODE_ENV || "development" };

if (env.DATABASE_URL && !env.DATABASE_URL.startsWith("file:")) {
  throw new Error("DATABASE_URL debe apuntar a SQLite con el prefijo file:.");
}
if (env.MINI_INVENTARIO_DATA_DIR || (production && !hasAbsoluteDatabasePath(env.DATABASE_URL))) {
  const dataDirectory = getDataDirectory();
  mkdirSync(dataDirectory, { recursive: true });
  env.DATABASE_URL = `file:${path.join(dataDirectory, "mini-inventario.db").replace(/\\/g, "/")}`;
}

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Falló el proceso ${args.join(" ")}`);
}

run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
run(["--import", "tsx", "prisma/seed.ts"]);
