import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { jobs, jobActivity } from "@/db/schema";
import { isValidDate } from "@/lib/domain";
import { api, ApiError, json, jsonBody, ownedJob, ownerWhere, userFor } from "@/lib/server";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return api(async () => {
    const user = await userFor(request), { id } = await context.params;
    await ownedJob(user.userId, id);
    return json(await getDb().select().from(jobActivity).where(and(eq(jobActivity.jobId, id), eq(jobActivity.kind, "interview_completed"))).orderBy(desc(jobActivity.occurredAt), desc(jobActivity.recordedAt)));
  });
}
export async function POST(request: Request, context: Context) {
  return api(async () => {
    const user = await userFor(request), { id } = await context.params;
    const input = z.object({ requestId: z.string().uuid(), label: z.string().trim().min(1).max(120), notes: z.string().max(2000).default(""),
      completedOn: z.string().refine(isValidDate, "Choose a valid interview date.").refine(value => value <= new Date().toISOString().slice(0, 10), "Completed interviews cannot have a future date.") }).strict().parse(await jsonBody(request, 12000));
    return getDb().transaction(async tx => {
      const [job] = await tx.select({ id: jobs.id }).from(jobs).where(ownerWhere(user.userId, id)).for("update");
      if (!job) throw new ApiError(404, "This job was not found.");
      const value = { id: input.requestId, jobId: id, kind: "interview_completed" as const, label: input.label, notes: input.notes, occurredAt: new Date(input.completedOn + "T00:00:00.000Z") };
      const [saved] = await tx.insert(jobActivity).values(value).onConflictDoNothing().returning();
      if (saved) return json(saved, 201);
      const [prior] = await tx.select().from(jobActivity).where(and(eq(jobActivity.id, input.requestId), eq(jobActivity.jobId, id), eq(jobActivity.kind, "interview_completed")));
      if (!prior || prior.label !== value.label || prior.notes !== value.notes || prior.occurredAt.getTime() !== value.occurredAt.getTime()) throw new ApiError(409, "This interview request was already used. Refresh and try again.");
      return json(prior);
    });
  });
}
