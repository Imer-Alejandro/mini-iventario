import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tests = [
  "lib/money/__tests__/money.test.ts",
  "server/services/__tests__/domain-services.test.ts",
  "lib/offline/__tests__/offline.test.ts",
];
const testAuthToken = randomBytes(32).toString("hex");

for (const test of tests) {
  const result = spawnSync(process.execPath, ["--import", "tsx", path.join(projectRoot, test)], {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: "test", TEST_AUTH_TOKEN: testAuthToken },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
