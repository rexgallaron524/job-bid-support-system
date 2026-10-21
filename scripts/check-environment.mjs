import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const [major, minor] = process.versions.node.split(".").map(Number);
let failed = false;
function check(ok, message, fix = "") {
  console.log(`${ok ? "OK" : "MISSING"}  ${message}`);
  if (!ok) { failed = true; if (fix) console.log(`         ${fix}`); }
}
console.log("Jobbid environment check\n");
check(major > 22 || (major === 22 && minor >= 13), `Node.js ${process.versions.node}`, "Use Node.js 22.13 or newer.");
const git = spawnSync("git", ["--version"], { encoding: "utf8", windowsHide: true });
check(git.status === 0, git.status === 0 ? git.stdout.trim() : "Git", "Install Git and reopen your terminal before publishing.");
if (process.platform === "win32") {
  const system = path.join(process.env.SystemRoot || "C:/Windows", "System32");
  check(["vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll"].every((name) => existsSync(path.join(system, name))), "Microsoft Visual C++ x64 runtime", "Install the Microsoft Visual C++ v14 Redistributable (x64): https://aka.ms/vc14/vc_redist.x64.exe");
}
check(existsSync(path.join(root, "node_modules/.bin", process.platform === "win32" ? "vinext.cmd" : "vinext")), "Project dependencies", "Run npm run install:ci from the jobbid directory.");
const hosting = JSON.parse(readFileSync(path.join(root, ".openai/hosting.json"), "utf8"));
check(hosting.d1 === "DB" && hosting.r2 === "BUCKET", "Local database and resume storage bindings");
check(existsSync(path.join(root, "drizzle")) && readdirSync(path.join(root, "drizzle")).some((name) => name.endsWith(".sql")), "Database migration", "Run npm run db:generate once after the initial schema is created.");
console.log("\nNo .env file or application API keys are required by this version.");
console.log("Local development emulates storage and sign-in on loopback.");
process.exitCode = failed ? 1 : 0;
