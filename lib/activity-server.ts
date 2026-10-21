import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { jobs, jobActivity } from "@/db/schema";
import { ACTIVITY_KINDS, activitySeries, emptyCounts } from "./activity";
import { isValidDate, WORK_MODES } from "./domain";
import { ApiError } from "./server";

const date = z.string().refine(isValidDate, "Choose valid start and end dates.");
export async function activityReport(owner: string, params: URLSearchParams) {
  const input = z.object({
    from: date, to: date, groupBy: z.enum(["day", "week", "month"]).default("day"),
    kind: z.enum(["all", ...ACTIVITY_KINDS]).default("all"), company: z.string().max(200).default(""),
    workMode: z.enum(["all", ...WORK_MODES]).default("all"), page: z.coerce.number().int().min(1).max(100000).default(1),
  }).parse(Object.fromEntries(params));
  const start = new Date(input.from + "T00:00:00.000Z"), end = new Date(input.to + "T00:00:00.000Z");
  if (start > end) throw new ApiError(400, "Start date must be on or before end date.");
  if (end.getTime() - start.getTime() > 5 * 366 * 86400000) throw new ApiError(400, "Choose a date range of five years or less.");
  end.setUTCDate(end.getUTCDate() + 1);
  const where = and(eq(jobs.userId, owner), gte(jobActivity.occurredAt, start), lt(jobActivity.occurredAt, end),
    input.kind === "all" ? undefined : eq(jobActivity.kind, input.kind), input.company ? eq(jobs.company, input.company) : undefined,
    input.workMode === "all" ? undefined : eq(jobs.workMode, input.workMode));
  const bucket = sql<string>`to_char(date_trunc(${input.groupBy}::text, ${jobActivity.occurredAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`;
  return getDb().transaction(async tx => {
    const rows = await tx.select({ date: bucket.as("activity_date"), kind: jobActivity.kind, count: sql<number>`count(*)::int` }).from(jobActivity)
      .innerJoin(jobs, eq(jobActivity.jobId, jobs.id)).where(where).groupBy(sql`activity_date`, jobActivity.kind).orderBy(sql`activity_date`);
    const totals = emptyCounts(); for (const row of rows) totals[row.kind] += Number(row.count);
    const total = Object.values(totals).reduce((sum, value) => sum + value, 0), pageCount = Math.max(1, Math.ceil(total / 20));
    const page = Math.min(input.page, pageCount);
    const entries = await tx.select({ id: jobActivity.id, jobId: jobs.id, shortId: jobs.shortId, title: jobs.title, company: jobs.company,
      kind: jobActivity.kind, occurredAt: jobActivity.occurredAt, label: jobActivity.label, notes: jobActivity.notes, source: jobActivity.source })
      .from(jobActivity).innerJoin(jobs, eq(jobActivity.jobId, jobs.id)).where(where)
      .orderBy(desc(jobActivity.occurredAt), desc(jobActivity.recordedAt), desc(jobActivity.id)).limit(20).offset((page - 1) * 20);
    return { totals, series: activitySeries(input.from, input.to, input.groupBy, rows), entries, total, page, pageCount };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
