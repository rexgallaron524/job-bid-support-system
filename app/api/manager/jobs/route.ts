import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { api, ApiError, json, managerFor, publicJob } from "@/lib/server";
export async function GET(request: Request) {
  return api(async () => {
    await managerFor(request);
    const owner = new URL(request.url).searchParams.get("userId");
    if (!owner) throw new ApiError(400, "Choose a user.");
    return json((await getDb().select().from(jobs).where(eq(jobs.userId, owner)).orderBy(desc(jobs.updatedAt))).map(publicJob));
  });
}

