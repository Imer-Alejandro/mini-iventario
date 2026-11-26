import { app, BrowserWindow, dialog } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const electronDirectory = path.dirname(fileURLToPath(import.meta.url));
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  let mainWindow;
  let applicationUrl;

  app.setName("Mini Inventario");
  const configuredDataDirectory = process.env.MINI_INVENTARIO_DATA_DIR;
  const userDataDirectory = configuredDataDirectory
    ? path.resolve(configuredDataDirectory)
    : path.join(app.getPath("appData"), "Mini Inventario");
  app.setPath("userData", userDataDirectory);

  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(startApplication);
  app.on("window-all-closed", () => app.quit());

  async function startApplication() {
    try {
      const serverRoot = getServerRoot();
      const dataDirectory = app.getPath("userData");
      fs.mkdirSync(dataDirectory, { recursive: true });

      const databasePath = path.join(dataDirectory, "mini-inventario.db").replace(/\\/g, "/");
      const runtimeEnv = {
        ...process.env,
        NODE_ENV: "production",
        MINI_INVENTARIO_DATA_DIR: dataDirectory,
        DATABASE_URL: `file:${databasePath}`,
      };

      await initializeDatabase(serverRoot, runtimeEnv);

      const port = await getAvailablePort();
      process.env.NODE_ENV = "production";
      process.env.MINI_INVENTARIO_DATA_DIR = dataDirectory;
      process.env.DATABASE_URL = runtimeEnv.DATABASE_URL;
      process.env.PORT = String(port);
      process.env.HOSTNAME = "127.0.0.1";

      console.info(`Iniciando servidor local en 127.0.0.1:${port}`);
      await import(pathToFileURL(path.join(serverRoot, "server.js")).href);
      console.info("Servidor Next inicializado; esperando la API local.");
      applicationUrl = `http://localhost:${port}`;
      await waitForServer(`${applicationUrl}/api/auth/status`);
      console.info(`Mini Inventario local en ${applicationUrl}`);
      await createMainWindow();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("No se pudo iniciar Mini Inventario:", error);
      dialog.showErrorBox(
        "No se pudo iniciar Mini Inventario",
        `La aplicación no pudo preparar la base local o iniciar su servidor.\n\n${message}`,
      );
      app.quit();
    }
  }

  function getServerRoot() {
    return app.isPackaged
      ? path.join(process.resourcesPath, "standalone")
      : path.join(electronDirectory, "..", ".next", "standalone");
  }

  function initializeDatabase(serverRoot, runtimeEnv) {
    const schemaPath = path.join(serverRoot, "prisma", "schema.prisma");
    const prismaCli = path.join(serverRoot, "node_modules", "prisma", "build", "index.js");
    const tsxCli = path.join(serverRoot, "node_modules", "tsx", "dist", "cli.mjs");

    console.info("Aplicando migraciones SQLite locales.");
    return runNodeScript(
      prismaCli,
      ["migrate", "deploy", "--schema", schemaPath],
      serverRoot,
      runtimeEnv,
    )
      .then(() => {
        console.info("Sembrando datos iniciales locales.");
        return runNodeScript(tsxCli, ["prisma/seed.ts"], serverRoot, runtimeEnv);
      })
      .then(() => console.info("Base local preparada."));
  }

  function runNodeScript(scriptPath, args, cwd, runtimeEnv) {
    return new Promise((resolve, reject) => {
      const bootstrap = getNodeBootstrap(scriptPath);
      const child = spawn(process.execPath, ["-e", bootstrap, ...args], {
        cwd,
        env: { ...runtimeEnv, ELECTRON_RUN_AS_NODE: "1" },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
        process.stdout.write(chunk);
      });
      child.stderr.on("data", (chunk) => {
        output += chunk.toString();
        process.stderr.write(chunk);
      });
      child.once("spawn", () => console.info(`Proceso de base iniciado: ${path.basename(scriptPath)} (PID ${child.pid}).`));
      child.once("error", (error) => {
        reject(error);
      });
      child.once("close", (code, signal) => {
        console.info(`Proceso de base finalizado: ${path.basename(scriptPath)} (código ${code}).`);
        if (code === 0) {
          resolve();
          return;
        }
        const status = signal ? `señal ${signal}` : `código ${code}`;
        const details = output.trim();
        reject(
          new Error(
            details
              ? `${details}\nPreparación de base falló (${status}).`
              : `Preparación de base falló (${status}).`,
          ),
        );
      });
    });
  }

  function getNodeBootstrap(scriptPath) {
    const encodedPath = JSON.stringify(scriptPath);
    if (path.extname(scriptPath) === ".mjs") {
      return [
        "const { pathToFileURL } = require('node:url');",
        `const scriptPath = ${encodedPath};`,
        "process.argv.splice(1, 0, scriptPath);",
        "import(pathToFileURL(scriptPath).href).catch((error) => { console.error(error); process.exitCode = 1; });",
      ].join("");
    }

    return [
      "const Module = require('node:module');",
      `const scriptPath = ${encodedPath};`,
      "process.argv.splice(1, 0, scriptPath);",
      "Module._load(scriptPath, null, true);",
    ].join("");
  }

  function getAvailablePort() {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          server.close();
          reject(new Error("No se pudo reservar un puerto local para el servidor."));
          return;
        }
        server.close((error) => {
          if (error) reject(error);
          else resolve(address.port);
        });
      });
    });
  }

  async function waitForServer(url) {
    const deadline = Date.now() + 30_000;
    let lastError;

    while (Date.now() < deadline) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`El servidor local respondió con HTTP ${response.status}.`);
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    throw new Error(`El servidor local no respondió a tiempo: ${lastError instanceof Error ? lastError.message : url}`);
  }

  async function createMainWindow() {
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 920,
      minWidth: 1024,
      minHeight: 700,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    mainWindow.webContents.on("will-navigate", (event, url) => {
      if (new URL(url).origin !== applicationUrl) event.preventDefault();
    });

    await mainWindow.loadURL(applicationUrl);
  }
}
