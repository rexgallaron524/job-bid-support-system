import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, users } from "@/db/schema";
import { EMPTY_PROFILE } from "@/lib/profile";
import { api, ApiError, json, managerFor } from "@/lib/server";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    await managerFor(request);
    const { id } = await context.params;
    const [owner] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, id));
    if (!owner) throw new ApiError(404, "This user was not found.");
    const [row] = await getDb().select().from(profiles).where(eq(profiles.userId, id));
    return json({ profile: row?.data ?? EMPTY_PROFILE, revision: row?.revision ?? 0, updatedAt: row?.updatedAt ?? null });
  });
}
