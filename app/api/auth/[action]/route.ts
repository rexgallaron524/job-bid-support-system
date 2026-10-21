import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users, sessions } from "@/db/schema";
import { api, ApiError, assertSameOrigin, json, jsonBody, userFor } from "@/lib/server";
import { clearSession, clientKey, consumeAuthLimit, SESSION_SECONDS, setSessionCookie } from "@/lib/auth";
import { hashPassword, verifyPassword, dummyPasswordHash, tokenHash } from "@/lib/password.mjs";

const email = z.string().trim().email().max(254).transform(v => v.toLowerCase());
const password = z.string().min(12, "Use a password with 12–128 characters.").max(128);
type Context = { params: Promise<{ action: string }> };
export async function POST(request: Request, context: Context) {
  return api(async () => {
    assertSameOrigin(request);
    const { action } = await context.params;
    if (action === "logout") { await clearSession(); return json({ success: true }); }
    if (!["signup", "login", "password"].includes(action)) throw new ApiError(404, "Not found.");
    if (!await consumeAuthLimit("auth:" + action + ":" + clientKey(request), action === "signup" ? 10 : 60))
      throw new ApiError(429, "Too many attempts. Please try again in 15 minutes.");
    const body = await jsonBody(request, 4096);
    const db = getDb();
    if (action === "signup") {
      const input = z.object({ email, password, name: z.string().trim().min(1).max(100), privacyAccepted: z.literal(true) }).strict().parse(body);
      const passwordHash = await hashPassword(input.password);
      await db.insert(users).values({ id: randomUUID(), email: input.email, name: input.name, passwordHash, createdAt: new Date().toISOString() }).onConflictDoNothing({ target: users.email });
      return json({ message: "Your request has been received. An approved account can sign in; new accounts need manager approval." }, 202);
    }
    if (action === "password") {
      const user = await userFor(request);
      const input = z.object({ currentPassword: z.string().max(128), newPassword: password }).strict().parse(body);
      await db.transaction(async tx => {
        const [account] = await tx.select().from(users).where(eq(users.id, user.userId)).for("update");
        if (!await verifyPassword(input.currentPassword, account.passwordHash)) throw new ApiError(400, "The current password is incorrect.");
        await tx.update(users).set({ passwordHash: await hashPassword(input.newPassword) }).where(eq(users.id, user.userId));
        await tx.delete(sessions).where(eq(sessions.userId, user.userId));
      });
      await clearSession();
      return json({ message: "Password changed. Please sign in again." });
    }
    const input = z.object({ email, password: z.string().min(1).max(128) }).strict().parse(body);
    if (!await consumeAuthLimit("login-email:" + input.email, 10)) throw new ApiError(429, "Too many attempts. Please try again in 15 minutes.");
    const [account] = await db.select().from(users).where(eq(users.email, input.email));
    const valid = await verifyPassword(input.password, account?.passwordHash ?? dummyPasswordHash);
    if (!valid || !account) throw new ApiError(401, "Email or password is incorrect.");
    if (account.status !== "approved") throw new ApiError(403, account.status === "pending" ? "Your account is waiting for manager approval." : "Your account is not approved. Contact the manager.");
    const token = randomBytes(32).toString("hex");
    // Lock the account so suspension/deletion/password resets cannot race a login.
    await db.transaction(async tx => {
      const [fresh] = await tx.select().from(users).where(eq(users.id, account.id)).for("update");
      if (!fresh || fresh.status !== "approved" || fresh.passwordHash !== account.passwordHash) throw new ApiError(403, "Please sign in again.");
      await tx.delete(sessions).where(sql`${sessions.expiresAt} < now()`);
      await tx.insert(sessions).values({ tokenHash: tokenHash(token), userId: account.id, expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) });
    });
    await setSessionCookie(token);
    return json({ success: true });
  });
}

