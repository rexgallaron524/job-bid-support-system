import { env } from "cloudflare:workers";

// Database changes are authoritative. A cleanup failure must not turn a saved
// attachment or deleted job into an apparent failed mutation in the client.
export async function removeStoredResume(key: string | null) {
  if (!key || !env.BUCKET) return;
  try { await env.BUCKET.delete(key); }
  catch (error) { console.error("Resume cleanup failed", error); }
}
