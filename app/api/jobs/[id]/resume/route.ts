import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs, resumes } from "@/db/schema";
import { MAX_RESUME_SIZE, resumeFormat } from "@/lib/domain";
import { api, ApiError, boundedFormData, json, ownedJob, ownerWhere, publicJob, userFor } from "@/lib/server";

type Context = { params: Promise<{ id: string }> };
import { resumeResponse } from "@/lib/resume";
export async function GET(request: Request, context: Context) {
  return api(async () => {
    const user = await userFor(request);
    const job = await ownedJob(user.userId, (await context.params).id);
    return resumeResponse(job.id, job.resumeName, job.resumeType);
  });
}
export async function POST(request: Request, context: Context) {
  return api(async () => {
    const user = await userFor(request);
    const { id } = await context.params;
    await ownedJob(user.userId, id);
    const form = await boundedFormData(request, MAX_RESUME_SIZE + 65536);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "Choose a PDF or DOCX resume.");
    if (file.size > MAX_RESUME_SIZE) throw new ApiError(413, "Your resume must be 10 MB or smaller.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const type = resumeFormat(file.name, bytes);
    if (!type) throw new ApiError(400, "Upload a valid PDF or DOCX document.");
    const result = await getDb().transaction(async tx => {
      const [current] = await tx.select().from(jobs).where(ownerWhere(user.userId, id)).for("update");
      if (!current) throw new ApiError(404, "This job was not found.");
      await tx.insert(resumes).values({ jobId: id, data: bytes }).onConflictDoUpdate({ target: resumes.jobId, set: { data: bytes } });
      const [job] = await tx.update(jobs).set({
        resumeKey: crypto.randomUUID(), resumeName: file.name.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 200),
        resumeType: type, resumeSize: file.size, updatedAt: new Date().toISOString(),
      }).where(ownerWhere(user.userId, id)).returning();
      return job;
    });
    return json(publicJob(result));
  });
}
export async function DELETE(request: Request, context: Context) {
  return api(async () => {
    const user = await userFor(request);
    const { id } = await context.params;
    const result = await getDb().transaction(async tx => {
      const [current] = await tx.select().from(jobs).where(ownerWhere(user.userId, id)).for("update");
      if (!current) throw new ApiError(404, "This job was not found.");
      await tx.delete(resumes).where(eq(resumes.jobId, id));
      const [job] = await tx.update(jobs).set({ resumeKey: null, resumeName: null, resumeType: null, resumeSize: null, updatedAt: new Date().toISOString() }).where(ownerWhere(user.userId, id)).returning();
      return job;
    });
    return json(publicJob(result));
  });
}
