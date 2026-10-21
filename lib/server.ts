import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { jobs, type JobRecord } from "@/db/schema";
import { isValidDate, normalizeJobUrl, WORK_MODES } from "./domain";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function userFor(request: Request) {
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) throw new ApiError(403, "This request must come from your workspace.");
  }
  const user = await getChatGPTUser();
  if (!user) throw new ApiError(401, "Please sign in again to continue.");
  return user;
}

export async function ownedJob(userId: string, id: string) {
  const job = await getDb().select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId))).get();
  if (!job) throw new ApiError(404, "This job was not found.");
  return job;
}

export const ownerWhere = (userId: string, id: string) => and(eq(jobs.id, id), eq(jobs.userId, userId));
export function publicJob(job: JobRecord) {
  const { userId, canonicalUrl, resumeKey, resumeType, ...result } = job;
  void userId; void canonicalUrl; void resumeKey; void resumeType;
  return result;
}

export const jobInput = z.object({
  url: z.string().trim().min(1).max(4000).refine((v) => { try { normalizeJobUrl(v); return true; } catch { return false; } }, "Enter a valid HTTP or HTTPS job URL."),
  company: z.string().trim().min(1, "Company is required.").max(200),
  title: z.string().trim().min(1, "Job title is required.").max(250),
  location: z.string().trim().max(250).default(""),
  workMode: z.enum(WORK_MODES).default("Unspecified"),
  salary: z.string().trim().max(150).default(""),
  description: z.string().max(60000).default(""),
  notes: z.string().max(30000).default(""),
  deadline: z.union([z.string().refine(isValidDate, "Choose a valid deadline."), z.null()]).default(null),
}).strict();

export async function jsonBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 200000) throw new ApiError(413, "The job details are too large.");
  const body = await request.text();
  if (body.length > 200000) throw new ApiError(413, "The job details are too large.");
  try { return JSON.parse(body); } catch { throw new ApiError(400, "Invalid request data."); }
}

export async function boundedFormData(request: Request, limit: number) {
  if (!request.body) throw new ApiError(400, "Choose a file to upload.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new ApiError(413, "Your resume must be 10 MB or smaller."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData(); }
  catch { throw new ApiError(400, "Invalid file upload. Please choose the document again."); }
}

export function json(value: unknown, status = 200) { return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } }); }

export async function api(action: () => Promise<Response>) {
  try { return await action(); } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return json({ error: error.issues[0]?.message ?? "Check your job details." }, 400);
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message + String(error.cause))) return json({ error: "You already saved this job URL. Find it in All applications." }, 409);
    console.error("Jobbid API error", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
