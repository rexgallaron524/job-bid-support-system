import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { api, ApiError, managerFor } from "@/lib/server";
import { resumeResponse } from "@/lib/resume";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    await managerFor(request);
    const [job] = await getDb().select().from(jobs).where(eq(jobs.id, (await context.params).id));
    if (!job) throw new ApiError(404, "Job not found.");
    return resumeResponse(job.id, job.resumeName, job.resumeType);
  });
}

