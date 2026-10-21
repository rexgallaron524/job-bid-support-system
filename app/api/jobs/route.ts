import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { normalizeJobUrl } from "@/lib/domain";
import { api, jobInput, json, jsonBody, publicJob, userFor } from "@/lib/server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return api(async () => {
    const user = await userFor(request);
    const result = await getDb().select().from(jobs).where(eq(jobs.userId, user.userId)).orderBy(desc(jobs.updatedAt)).all();
    return json(result.map(publicJob));
  });
}
export async function POST(request: Request) {
  return api(async () => {
    const user = await userFor(request);
    const input = jobInput.parse(await jsonBody(request));
    const now = new Date().toISOString();
    const result = await getDb().insert(jobs).values({ ...input, id: crypto.randomUUID(), userId: user.userId, canonicalUrl: normalizeJobUrl(input.url), createdAt: now, updatedAt: now }).returning().get();
    return json(publicJob(result), 201);
  });
}
