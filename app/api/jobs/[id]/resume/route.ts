import { env } from "cloudflare:workers";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { MAX_RESUME_SIZE, resumeFormat } from "@/lib/domain";
import { removeStoredResume } from "@/lib/storage";
import { api, ApiError, boundedFormData, json, ownedJob, ownerWhere, publicJob, userFor } from "@/lib/server";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return api(async () => {
    const user = await userFor(request);
    const job = await ownedJob(user.userId, (await context.params).id);
    if (!job.resumeKey || !env.BUCKET) throw new ApiError(404, "No resume is attached to this job.");
    const object = await env.BUCKET.get(job.resumeKey);
    if (!object) throw new ApiError(404, "This file was not found. Please upload it again.");
    const safeName = encodeURIComponent(job.resumeName ?? "resume.pdf").replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
    return new Response(object.body, { headers: { "Content-Type": job.resumeType ?? "application/octet-stream", "Content-Disposition": `attachment; filename="resume"; filename*=UTF-8''${safeName}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  });
}
export async function POST(request: Request, context: Context) {
  return api(async () => {
    const user = await userFor(request);
    const { id } = await context.params;
    const current = await ownedJob(user.userId, id);
    if (!env.BUCKET) throw new ApiError(503, "Document storage is not available. Please try again later.");
    if (Number(request.headers.get("content-length")) > MAX_RESUME_SIZE + 65536) throw new ApiError(413, "Your resume must be 10 MB or smaller.");
    const form = await boundedFormData(request, MAX_RESUME_SIZE + 65536);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "Choose a PDF or DOCX resume.");
    if (file.size > MAX_RESUME_SIZE) throw new ApiError(413, "Your resume must be 10 MB or smaller.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = resumeFormat(file.name, bytes);
    if (!type) throw new ApiError(400, "Upload a valid PDF or DOCX document.");
    const key = `resumes/${user.userId}/${id}/${crypto.randomUUID()}`;
    await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: type } });
    let result;
    try {
      result = await getDb().update(jobs).set({ resumeKey: key, resumeName: file.name.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 200), resumeType: type, resumeSize: file.size, updatedAt: new Date().toISOString() }).where(and(ownerWhere(user.userId, id), current.resumeKey ? eq(jobs.resumeKey, current.resumeKey) : isNull(jobs.resumeKey))).returning().get();
      if (!result) throw new ApiError(409, "This attachment changed in another tab. Refresh before uploading again.");
    } catch (error) { await env.BUCKET.delete(key); throw error; }
    await removeStoredResume(current.resumeKey);
    return json(publicJob(result));
  });
}
export async function DELETE(request: Request, context: Context) {
  return api(async () => {
    const user = await userFor(request);
    const { id } = await context.params;
    const current = await ownedJob(user.userId, id);
    const result = await getDb().update(jobs).set({ resumeKey: null, resumeName: null, resumeType: null, resumeSize: null, updatedAt: new Date().toISOString() }).where(and(ownerWhere(user.userId, id), current.resumeKey ? eq(jobs.resumeKey, current.resumeKey) : isNull(jobs.resumeKey))).returning().get();
    if (!result) throw new ApiError(409, "This attachment changed in another tab. Refresh before removing it.");
    await removeStoredResume(current.resumeKey);
    return json(publicJob(result));
  });
}
