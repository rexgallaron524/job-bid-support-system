import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
const paths = [...new Set(git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean))];
const blocked = /(^|\/)(node_modules|\.next|\.vinext|\.wrangler|\.sites-runtime|\.tools|\.openai|dist|outputs|backups|exports)(\/|$)/;
const secretPatterns = [
  ["private key", /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/],
  ["GitHub access token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["npm access token", /\bnpm_[A-Za-z0-9]{30,}\b/],
];
let failed = false, count = 0;
function reject(path, reason) { console.error("CHECK " + path + ": " + reason); failed = true; }
for (const path of paths) {
  const url = new URL(path.split("/").map(encodeURIComponent).join("/"), new URL("../", import.meta.url));
  if (!existsSync(url) || !statSync(url).isFile()) continue; // Tracked deletions are expected during migration.
  count++;
  if (blocked.test(path)) reject(path, "generated files or local runtime data must be excluded");
  if (/(^|\/)\.env(?:\.|$)/.test(path) && !/(^|\/)\.env\.example$/.test(path)) reject(path, "environment credentials must remain local");
  if (/\.(?:pem|key|dump|backup|zip|tar\.gz)$/i.test(path) || /(^|\/)(?:id_rsa|id_ed25519)$/.test(path)) reject(path, "private keys, database backups and archives must remain local");
  if (statSync(url).size > 5 * 1024 * 1024) { reject(path, "review this unusually large source file before publishing"); continue; }
  const content = readFileSync(url, "utf8");
  for (const [name, pattern] of secretPatterns) if (pattern.test(content)) reject(path, "possible " + name + " (value not displayed)");
}
const examples = git("check-ignore", "--no-index", ".env", "node_modules/example", ".next/example", "outputs/example", "backups/example").trim().split(/\r?\n/);
for (const expected of [".env", "node_modules/example", ".next/example", "outputs/example", "backups/example"]) {
  if (!examples.includes(expected)) reject(expected, "required ignore rule is missing");
}
console.log("Reviewed " + count + " current source files and required ignore rules.");
console.log("This checks common accidental inclusions; manually review staged changes before pushing.");
process.exitCode = failed ? 1 : 0;
