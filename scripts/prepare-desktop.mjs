import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = path.join(projectRoot, ".next", "standalone");

function copy(sourceRelativePath, destinationRelativePath = sourceRelativePath) {
  const source = path.join(projectRoot, sourceRelativePath);
  const destination = path.join(standaloneRoot, destinationRelativePath);

  if (!existsSync(source)) {
    throw new Error(`Falta un archivo requerido para el paquete de escritorio: ${sourceRelativePath}`);
  }

  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}

if (!existsSync(path.join(standaloneRoot, "server.js"))) {
  throw new Error("No se encontró .next/standalone/server.js. Ejecuta primero next build.");
}

for (const entry of readdirSync(standaloneRoot)) {
  if (/^\.env(?:\..*)?$/.test(entry)) {
    rmSync(path.join(standaloneRoot, entry), { force: true });
  }
}

copy("public");
copy(".next/static", ".next/static");
copy("prisma/schema.prisma");
copy("prisma/migrations");
copy("prisma/seed.ts");
copy("server/services/data-store.ts");

for (const packagePath of [
  "node_modules/prisma",
  "node_modules/@prisma",
  "node_modules/.prisma",
  "node_modules/tsx",
  "node_modules/esbuild",
  "node_modules/esbuild-register",
  "node_modules/get-tsconfig",
  "node_modules/resolve-pkg-maps",
  "node_modules/@esbuild",
]) {
  if (existsSync(path.join(projectRoot, packagePath))) copy(packagePath);
}

console.log("Preparación de escritorio completada: servidor Next, recursos locales, Prisma y migraciones incluidos.");
