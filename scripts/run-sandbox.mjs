import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { createServer } from "node:net";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const backend = join(root, "backend"),
  frontend = join(root, "frontend");
const envFile = join(backend, ".env.sandbox");
if (existsSync(envFile)) loadEnvFile(envFile);
for (const path of [
  "backend/node_modules/typescript/bin/tsc",
  "frontend/node_modules/vite/bin/vite.js",
]) {
  if (!existsSync(join(root, path)))
    throw new Error(
      "Install dependencies first: npm ci --prefix backend && npm ci --prefix frontend",
    );
}
if (process.env.PORT && process.env.PORT !== "3100")
  throw new Error(
    "This local launcher uses API port 3100, matching the frontend proxy.",
  );
async function available(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Port ${port} is already in use. Stop the previous sandbox first.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
await available(3100);
await available(8081);
const built = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "tsconfig.sandbox.json"],
  { cwd: backend, stdio: "inherit" },
);
if (built.status !== 0) process.exit(built.status || 1);
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGINT");
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
function launch(command, args, cwd, extra = {}) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...extra },
  });
  children.push(child);
  child.once("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.once("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
  return child;
}
if (process.env.OLLAMA_MODEL && process.env.OLLAMA_BIN) {
  const running = await fetch("http://127.0.0.1:11434/api/tags")
    .then((r) => r.ok)
    .catch(() => false);
  if (!running)
    launch(process.env.OLLAMA_BIN, ["serve"], backend, {
      OLLAMA_HOST: "127.0.0.1:11434",
      OLLAMA_NO_CLOUD: "1",
    });
}
launch(process.execPath, ["dist-sandbox/sandbox/main.js"], backend, {
  PORT: "3100",
  SANDBOX_HOST: "127.0.0.1",
});
let ready = false;
for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
  ready = await fetch("http://127.0.0.1:3100/api/v1/sandbox/auth/me")
    .then((r) => r.status === 401)
    .catch(() => false);
  if (ready) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!ready) {
  console.error("The sandbox API did not become ready.");
  stop(1);
} else {
  launch(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "8081",
      "--strictPort",
    ],
    frontend,
    { VITE_SANDBOX_MODE: "true" },
  );
  console.log("\nAngainor sandbox: http://127.0.0.1:8081");
  console.log(
    "Invitation code: backend/.sandbox/invite-code (or SANDBOX_INVITE_CODE). Keep this private.",
  );
  console.log("Stop with Ctrl+C. Data persists in backend/.sandbox.");
}
