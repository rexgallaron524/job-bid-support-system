import { cookies } from "next/headers";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users, authLimits } from "@/db/schema";
import { tokenHash } from "./password.mjs";

export const COOKIE = process.env.NODE_ENV === "production" ? "__Host-job-support-session" : "job-support-session";
export const SESSION_SECONDS = 60 * 60 * 12;
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [row] = await getDb().select({ userId: users.id, name: users.name, email: users.email, role: users.role, theme: users.theme, applicationPageSize: users.applicationPageSize })
    .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date()), eq(users.status, "approved")));
  return row ?? null;
}
export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
}
export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
  jar.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
export function managerPath() {
  const slug = process.env.MANAGER_PATH || "manager";
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug)) throw new Error("MANAGER_PATH must be 3–80 lowercase letters, numbers or hyphens.");
  return "/" + slug;
}
export async function consumeAuthLimit(key: string, max: number, seconds = 900) {
  const db = getDb();
  await db.delete(authLimits).where(lt(authLimits.resetsAt, new Date()));
  // Persistent and atomic across workers/restarts. No raw email/IP is stored.
  const [limit] = await db.insert(authLimits).values({ key: tokenHash(key), count: 1, resetsAt: new Date(Date.now() + seconds * 1000) })
    .onConflictDoUpdate({ target: authLimits.key, set: {
      count: sql`CASE WHEN ${authLimits.resetsAt} < now() THEN 1 ELSE ${authLimits.count} + 1 END`,
      resetsAt: sql`CASE WHEN ${authLimits.resetsAt} < now() THEN now() + ${seconds} * interval '1 second' ELSE ${authLimits.resetsAt} END`,
    } }).returning();
  if (limit.count > max) return false;
  return true;
}
export function clientKey(request: Request) {
  // Only enable behind a trusted proxy with the app port inaccessible externally.
  return process.env.TRUST_PROXY === "true" ? request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown" : "direct";
}

