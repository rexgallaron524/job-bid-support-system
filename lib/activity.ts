export const ACTIVITY_KINDS = ["saved", "applied", "interview_completed", "offer", "rejected", "withdrawn"] as const;
export type ActivityKind = typeof ACTIVITY_KINDS[number];
export type GroupBy = "day" | "week" | "month";
export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  saved: "Jobs saved", applied: "Applications submitted", interview_completed: "Interviews completed",
  offer: "Offers recorded", rejected: "Rejections recorded", withdrawn: "Withdrawals recorded",
};
export type ActivityCounts = Record<ActivityKind, number>;
export type ActivityEntry = { id: string; jobId: string; shortId: string; title: string; company: string; kind: ActivityKind; occurredAt: string; label: string; notes: string; source: string };
export type ActivityReport = {
  totals: ActivityCounts; series: ({ date: string } & ActivityCounts)[]; entries: ActivityEntry[];
  total: number; page: number; pageCount: number;
};
export const emptyCounts = (): ActivityCounts => ({ saved: 0, applied: 0, interview_completed: 0, offer: 0, rejected: 0, withdrawn: 0 });
export function activityBucket(date: string, groupBy: GroupBy): string {
  const value = new Date(date.slice(0, 10) + "T00:00:00.000Z");
  if (groupBy === "week") value.setUTCDate(value.getUTCDate() - (value.getUTCDay() + 6) % 7);
  if (groupBy === "month") value.setUTCDate(1);
  return value.toISOString().slice(0, 10);
}
export function activitySeries(from: string, to: string, groupBy: GroupBy, rows: { date: string; kind: ActivityKind; count: number }[]) {
  const values = new Map<string, ActivityCounts>();
  for (const row of rows) {
    const counts = values.get(row.date) ?? emptyCounts(); counts[row.kind] += Number(row.count); values.set(row.date, counts);
  }
  const cursor = new Date(activityBucket(from, groupBy) + "T00:00:00.000Z");
  const end = activityBucket(to, groupBy);
  const series = [];
  while (cursor.toISOString().slice(0, 10) <= end) {
    const date = cursor.toISOString().slice(0, 10);
    series.push({ date, ...(values.get(date) ?? emptyCounts()) });
    if (groupBy === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + (groupBy === "week" ? 7 : 1));
  }
  return series;
}
export function presetRange(preset: string, today: string) {
  const date = new Date(today + "T00:00:00.000Z");
  if (preset === "week") date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  if (preset === "month") date.setUTCDate(1);
  if (preset === "7days") date.setUTCDate(date.getUTCDate() - 6);
  if (preset === "30days") date.setUTCDate(date.getUTCDate() - 29);
  return { from: date.toISOString().slice(0, 10), to: today };
}
