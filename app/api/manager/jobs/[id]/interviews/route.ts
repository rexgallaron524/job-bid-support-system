import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs, jobActivity } from "@/db/schema";
import { api, ApiError, json, managerFor } from "@/lib/server";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    await managerFor(request); const { id } = await context.params;
    const [job] = await getDb().select({ id: jobs.id }).from(jobs).where(eq(jobs.id, id));
    if (!job) throw new ApiError(404, "This job was not found.");
    return json(await getDb().select().from(jobActivity).where(and(eq(jobActivity.jobId, id), eq(jobActivity.kind, "interview_completed"))).orderBy(desc(jobActivity.occurredAt), desc(jobActivity.recordedAt)));
  });
}
