import { cp, mkdir } from "node:fs/promises";
const root = new URL("../", import.meta.url);
await mkdir(new URL(".next/standalone/.next/", root), { recursive: true });
await cp(new URL(".next/static/", root), new URL(".next/standalone/.next/static/", root), { recursive: true, force: true });
await cp(new URL("public/", root), new URL(".next/standalone/public/", root), { recursive: true, force: true });
console.log("Standalone server assets prepared.");
