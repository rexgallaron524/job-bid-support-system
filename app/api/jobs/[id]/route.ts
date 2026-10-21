import { z } from "zod";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { normalizeJobUrl, STATUSES, transitionStatus } from "@/lib/domain";
import { api, ApiError, canonicalHash, jobInput, json, jsonBody, ownerWhere, publicJob, userFor } from "@/lib/server";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  return api(async () => {
    const user = await userFor(request);
    const { id } = await context.params;
    const body = await jsonBody(request);
    const result = await getDb().transaction(async tx => {
      // Status/date decisions must see the latest record, including simultaneous tabs.
      const [current] = await tx.select().from(jobs).where(ownerWhere(user.userId, id)).for("update");
      if (!current) throw new ApiError(404, "This job was not found.");
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
        changes = { ...input, canonicalUrl: normalizeJobUrl(input.url), canonicalHash: canonicalHash(input.url) };
      }
      const [job] = await tx.update(jobs).set({ ...changes, updatedAt: now }).where(ownerWhere(user.userId, id)).returning();
      return job;
    });
    return json(publicJob(result));
  });
}
export async function DELETE(request: Request, context: Context) {
  return api(async () => {
    const user = await userFor(request);
    const { id } = await context.params;
    const [job] = await getDb().delete(jobs).where(ownerWhere(user.userId, id)).returning();
    if (!job) throw new ApiError(404, "This job was not found.");
    return json({ success: true });
  });
}
