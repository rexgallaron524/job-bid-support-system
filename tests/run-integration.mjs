// Runs the built application on loopback against a dedicated test database only.
import { spawn } from "node:child_process";
const database = process.env.TEST_DATABASE_URL;
if (!database || !new URL(database).pathname.slice(1).startsWith("job_support_test")) throw new Error("Set TEST_DATABASE_URL to a dedicated job_support_test* database.");
const port = 3100;
const origin = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["scripts/start-production.mjs"], {
  env: { ...process.env, DATABASE_URL: database, APP_ORIGIN: origin, PORT: String(port), MANAGER_PATH: "review-manager-qa", NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
});
let logs = "";
server.stdout.on("data", chunk => { logs += chunk; });
server.stderr.on("data", chunk => { logs += chunk; });
const stopped = new Promise(resolve => server.once("exit", resolve));
async function ready() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(logs);
    try { const response = await fetch(origin, { signal: AbortSignal.timeout(1000) }); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Loopback QA server did not start. " + logs);
}
try {
  await ready();
  const homepage = await (await fetch(origin)).text();
  if (!homepage.includes("All in one place-job support") || homepage.includes("Sign in with ChatGPT")) throw new Error("Unexpected sign-in page.");
  if (process.env.UI_ONLY !== "true") {
  const cli = spawn(process.execPath, ["tests/cli.mjs"], { stdio: "inherit", windowsHide: true });
  if (await new Promise(resolve => cli.once("exit", resolve)) !== 0) throw new Error("CLI checks failed.");
  const child = spawn(process.execPath, ["--experimental-strip-types", "tests/api.test.mjs"], { env: { ...process.env, TEST_BASE_URL: origin, TEST_MANAGER_PATH: "review-manager-qa" }, stdio: "inherit", windowsHide: true });
  const exit = await new Promise(resolve => child.once("exit", resolve));
  if (exit !== 0) throw new Error("API tests failed. " + logs);
  }
  if (process.env.UI_QA === "true") {
    const ui = spawn(process.execPath, ["tests/browser.mjs"], { env: { ...process.env, TEST_BASE_URL: origin }, stdio: "inherit", windowsHide: true });
    const result = await new Promise(resolve => ui.once("exit", resolve));
    if (result !== 0) throw new Error("Browser checks failed. " + logs);
  }
} finally {
  server.kill();
  await stopped;
}
