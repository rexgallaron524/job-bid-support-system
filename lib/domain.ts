export const STATUSES = ["Saved", "Preparing", "Applied", "Interview", "Offer", "Rejected", "Withdrawn"] as const;
export type Status = typeof STATUSES[number];
export const WORK_MODES = ["Unspecified", "Remote", "Hybrid", "On-site"] as const;
export const MAX_RESUME_SIZE = 10 * 1024 * 1024;
export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type Job = {
  id: string; url: string; company: string; title: string; location: string;
  workMode: string; salary: string; description: string; notes: string; status: string;
  deadline: string | null; appliedAt: string | null; resumeName: string | null;
  resumeSize: number | null; createdAt: string; updatedAt: string;
};

export function normalizeJobUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new Error("Enter a full job URL, beginning with https://."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".")) {
    throw new Error("Enter a valid public HTTP or HTTPS job URL without login credentials.");
  }
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || /^(fbclid|gclid|msclkid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (!url.hash.startsWith("#/") && !/^#!?\/.*\w/.test(url.hash)) url.hash = "";
  return url.toString();
}

const displayCompany = (value: string) => value.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export function inferCompany(raw: string): string {
  try {
    const url = new URL(normalizeJobUrl(raw));
    const host = url.hostname;
    const parts = url.pathname.split("/").filter(Boolean);
    if (["jobs.lever.co", "boards.greenhouse.io", "job-boards.greenhouse.io", "jobs.ashbyhq.com", "apply.workable.com", "careers.smartrecruiters.com"].includes(host)) return parts[0] ? displayCompany(parts[0]) : "";
    if (host.endsWith(".myworkdayjobs.com")) return displayCompany(host.split(".")[0]);
    if (["linkedin.com", "indeed.com", "wellfound.com", "glassdoor.com", "greenhouse.io", "lever.co"].some((h) => host === h || host.endsWith(`.${h}`))) return "";
    const labels = host.split(".");
    const secondLevel = /\.(co|com|org)\.[a-z]{2}$/.test(host);
    return displayCompany(labels.at(secondLevel ? -3 : -2) ?? "");
  } catch { return ""; }
}

export function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function transitionStatus(current: { status: string; appliedAt: string | null }, next: Status, now: string) {
  if (current.appliedAt && ["Saved", "Preparing"].includes(next)) throw new Error("Undo the application first to move this job back to Saved or Preparing.");
  return { status: next, appliedAt: current.appliedAt ?? (["Applied", "Interview", "Offer"].includes(next) ? now : null) };
}

export function resumeFormat(name: string, bytes: Uint8Array): string | null {
  if (/\.pdf$/i.test(name) && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  if (/\.docx$/i.test(name) && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const content = new TextDecoder().decode(bytes);
    if (content.includes("[Content_Types].xml") && content.includes("word/document.xml")) return DOCX_TYPE;
  }
  return null;
}

export function deadlineLabel(deadline: string, today: string) {
  const days = Math.round((Date.parse(deadline) - Date.parse(today)) / 86_400_000);
  return days < 0 ? "Overdue" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
}
