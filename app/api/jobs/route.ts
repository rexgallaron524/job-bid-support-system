import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { normalizeJobUrl } from "@/lib/domain";
import { api, canonicalHash, jobInput, json, jsonBody, publicJob, userFor } from "@/lib/server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return api(async () => {
    const user = await userFor(request);
    const result = await getDb().select().from(jobs).where(eq(jobs.userId, user.userId)).orderBy(desc(jobs.updatedAt));
    return json(result.map(publicJob));
  });
}
export async function POST(request: Request) {
  return api(async () => {
    const user = await userFor(request);
    const input = jobInput.parse(await jsonBody(request));
    const now = new Date().toISOString();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const [result] = await getDb().insert(jobs).values({ ...input, id: crypto.randomUUID(), shortId: crypto.randomUUID().replaceAll("-", "").slice(0, 8), userId: user.userId, canonicalUrl: normalizeJobUrl(input.url), canonicalHash: canonicalHash(input.url), createdAt: now, updatedAt: now }).returning();
        return json(publicJob(result), 201);
      } catch (error) {
        const cause = (error as Error).cause as { code?: string; constraint?: string } | undefined;
        if (cause?.code !== "23505" || cause.constraint !== "jobs_short_id_unique" || attempt === 2) throw error;
      }
    }
    throw new Error("Could not allocate a job ID.");
  });
}
