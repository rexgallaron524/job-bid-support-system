import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { resumes } from "@/db/schema";
import { ApiError } from "./server";
export async function resumeResponse(id: string, name: string | null, type: string | null) {
  const [file] = await getDb().select().from(resumes).where(eq(resumes.jobId, id));
  if (!file) throw new ApiError(404, "No resume is attached to this job.");
  const safeName = encodeURIComponent(name ?? "resume.pdf").replace(/['()]/g, c => "%" + c.charCodeAt(0).toString(16));
  return new Response(new Uint8Array(file.data), { headers: {
    "Content-Type": type ?? "application/octet-stream",
    "Content-Disposition": `attachment; filename="resume"; filename*=UTF-8''${safeName}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
