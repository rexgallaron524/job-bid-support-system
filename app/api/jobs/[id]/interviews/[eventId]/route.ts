import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs, jobActivity } from "@/db/schema";
import { api, ApiError, json, ownerWhere, userFor } from "@/lib/server";
export async function DELETE(request: Request, context: { params: Promise<{ id: string; eventId: string }> }) {
  return api(async () => {
    const user = await userFor(request), { id, eventId } = await context.params;
    return getDb().transaction(async tx => {
      const [owner] = await tx.select({ id: jobs.id }).from(jobs).where(ownerWhere(user.userId, id)).for("update");
      if (!owner) throw new ApiError(404, "This job was not found.");
      const [removed] = await tx.delete(jobActivity).where(and(eq(jobActivity.id, eventId), eq(jobActivity.jobId, id), eq(jobActivity.kind, "interview_completed"))).returning({ id: jobActivity.id });
      if (!removed) throw new ApiError(404, "This interview record was not found.");
      return json({ success: true });
    });
  });
}
