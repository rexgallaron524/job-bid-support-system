import type { Job } from "./domain";
export function exportFolder(job: Pick<Job, "shortId" | "company" | "createdAt">) {
  const company = job.company.normalize("NFC").replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, "-").replace(/\s+/g, " ").replace(/^[. ]+|[. ]+$/g, "").slice(0, 80).replace(/[. ]+$/g, "") || "Company";
  if (!/^[a-z0-9]{4,16}$/i.test(job.shortId) || !/^\d{4}-\d{2}-\d{2}T/.test(job.createdAt)) throw new Error("Invalid job export details.");
  return job.createdAt.slice(0, 10) + "-" + company + "-" + job.shortId;
}
export function exportText(job: Pick<Job, "shortId" | "title" | "description">) {
  return "Opportunity ID: " + job.shortId + "\r\n\r\nJob title: " + job.title.replace(/[\r\n]/g, " ") + "\r\n\r\nJob description:\r\n" + job.description.replace(/\r?\n/g, "\r\n") + "\r\n";
}

