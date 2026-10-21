import { removeStoredResume } from "@/lib/storage";
import { z } from "zod";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { normalizeJobUrl, STATUSES, transitionStatus } from "@/lib/domain";
import { api, ApiError, jobInput, json, jsonBody, ownedJob, ownerWhere, publicJob, userFor } from "@/lib/server";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  return api(async () => {
    const user = await userFor(request);
    const { id } = await context.params;
    const current = await ownedJob(user.userId, id);
    const body = await jsonBody(request);
    const now = new Date().toISOString();
    let changes: Partial<typeof jobs.$inferInsert>;
    if (body?.action === "undoApplied") {
      z.object({ action: z.literal("undoApplied") }).strict().parse(body);
      changes = { status: "Saved", appliedAt: null };
    } else if (body?.action === "setStatus") {
      const input = z.object({ action: z.literal("setStatus"), status: z.enum(STATUSES) }).strict().parse(body);
      try { changes = transitionStatus(current, input.status, now); } catch (e) { throw new ApiError(400, (e as Error).message); }
    } else {
      const input = jobInput.parse(body);
      changes = { ...input, canonicalUrl: normalizeJobUrl(input.url) };
    }
    const result = await getDb().update(jobs).set({ ...changes, updatedAt: now }).where(ownerWhere(user.userId, id)).returning().get();
    if (!result) throw new ApiError(404, "This job was not found.");
    return json(publicJob(result));
  });
}
export async function DELETE(request: Request, context: Context) {
  return api(async () => {
    const user = await userFor(request);
    const { id } = await context.params;
    const job = await getDb().delete(jobs).where(ownerWhere(user.userId, id)).returning().get();
    if (!job) throw new ApiError(404, "This job was not found.");
    await removeStoredResume(job.resumeKey);
    return json({ success: true });
  });
}
