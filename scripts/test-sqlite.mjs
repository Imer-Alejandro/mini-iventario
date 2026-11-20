import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "mini-inventario-sqlite-"));
const dataDirectory = path.join(temporaryDirectory, "application data");
const databasePath = path.join(dataDirectory, "mini-inventario.db");
const operationId = randomUUID();

function run(args, env) {
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Falló el proceso ${args.join(" ")}`);
}

function databaseUrl(filePath) {
  return `file:${filePath.replace(/\\/g, "/")}`;
}

const env = {
  ...process.env,
  NODE_ENV: "production",
  DATABASE_URL: "file:./dev.db",
  MINI_INVENTARIO_DATA_DIR: dataDirectory,
  SQLITE_TEST_RUN_ID: operationId,
};

try {
  run(["scripts/db-setup.mjs", "--production"], env);
  if (!existsSync(databasePath)) throw new Error("La preparación de producción no creó la base en la ruta local esperada.");
  run(["--import", "tsx", "scripts/sqlite-persistence-check.ts", "write"], env);
  run(["--import", "tsx", "scripts/sqlite-persistence-check.ts", "verify"], env);

  run(["scripts/backup-database.mjs"], env);
  const backupDirectory = path.join(dataDirectory, "backups");
  const backupName = readdirSync(backupDirectory).find((name) => name.endsWith(".db"));
  if (!backupName) throw new Error("No se encontró la copia SQLite recién creada.");

  const backupEnv = {
    ...env,
    DATABASE_URL: databaseUrl(path.join(backupDirectory, backupName)),
  };
  delete backupEnv.MINI_INVENTARIO_DATA_DIR;
  run(
    ["--import", "tsx", "scripts/sqlite-persistence-check.ts", "verify"],
    backupEnv,
  );
  console.log("SQLite backup restore verification: OK");

  const configuredDataDirectory = path.join(temporaryDirectory, "machine data");
  const configuredDatabase = path.join(configuredDataDirectory, "mini-inventario.db");
  run(
    ["--import", "tsx", "scripts/sqlite-persistence-check.ts", "path"],
    {
      ...env,
      MINI_INVENTARIO_DATA_DIR: configuredDataDirectory,
      EXPECTED_SQLITE_PATH: configuredDatabase,
    },
  );
  console.log("SQLite machine-local data directory: OK");

  const expiredBackup = path.join(backupDirectory, "mini-inventario-2000-01-01_00-00-00.db");
  const unrelatedFile = path.join(backupDirectory, "keep.txt");
  writeFileSync(expiredBackup, "expired");
  writeFileSync(unrelatedFile, "keep");
  utimesSync(expiredBackup, new Date(0), new Date(0));
  run(["scripts/backup-database.mjs"], env);
  if (existsSync(expiredBackup) || !existsSync(unrelatedFile)) {
    throw new Error("La retención de respaldos no conservó los archivos esperados.");
  }
  console.log("SQLite backup retention: OK");
} finally {
  const resolvedTemp = path.resolve(temporaryDirectory);
  const tempRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!resolvedTemp.startsWith(tempRoot)) {
    throw new Error("Se rechazó la limpieza de una ruta fuera del directorio temporal.");
  }
  rmSync(resolvedTemp, { recursive: true, force: true });
}
