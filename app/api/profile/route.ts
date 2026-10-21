import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { profiles, users } from "@/db/schema";
import { EMPTY_PROFILE, profileSchema } from "@/lib/profile";
import { api, ApiError, json, jsonBody, userFor } from "@/lib/server";

export async function GET(request: Request) {
  return api(async () => {
    const user = await userFor(request);
    const [row] = await getDb().select().from(profiles).where(eq(profiles.userId, user.userId));
    return json({ profile: row?.data ?? EMPTY_PROFILE, revision: row?.revision ?? 0, updatedAt: row?.updatedAt ?? null });
  });
}
export async function PUT(request: Request) {
  return api(async () => {
    const user = await userFor(request);
    const input = z.object({ profile: profileSchema, revision: z.number().int().min(0).max(2147483646) }).strict().parse(await jsonBody(request, 1000000));
    return getDb().transaction(async tx => {
      // Serialize initial inserts as well as updates; stale tabs must not overwrite a newer profile.
      const [owner] = await tx.select({ id: users.id }).from(users).where(eq(users.id, user.userId)).for("update");
      if (!owner) throw new ApiError(401, "Please sign in again to continue.");
      const [prior] = await tx.select().from(profiles).where(eq(profiles.userId, user.userId));
      if ((prior?.revision ?? 0) !== input.revision) throw new ApiError(409, "Your profile was updated in another tab. Keep a copy of your edits, then reload to get the latest version.");
      const value = { data: input.profile, revision: input.revision + 1, updatedAt: new Date().toISOString() };
      if (prior) await tx.update(profiles).set(value).where(eq(profiles.userId, user.userId));
      else await tx.insert(profiles).values({ userId: user.userId, ...value });
      return json({ profile: value.data, revision: value.revision, updatedAt: value.updatedAt });
    });
  });
}
