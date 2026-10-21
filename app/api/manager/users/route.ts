import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs, users } from "@/db/schema";
import { api, json, managerFor } from "@/lib/server";
export async function GET(request: Request) {
  return api(async () => {
    await managerFor(request);
    const result = await getDb().select({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status, createdAt: users.createdAt, jobCount: sql<number>`count(${jobs.id})::int` })
      .from(users).leftJoin(jobs, eq(jobs.userId, users.id)).groupBy(users.id).orderBy(users.createdAt);
    return json(result);
  });
}

