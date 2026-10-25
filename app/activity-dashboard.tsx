"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, RefreshCw } from "lucide-react";
import { ACTIVITY_KINDS, ACTIVITY_LABELS, presetRange, type ActivityReport, type GroupBy } from "@/lib/activity";
import { WORK_MODES, type Job } from "@/lib/domain";

import ActivityChart from "./activity-chart";
const PRIMARY_METRICS = ["applied", "interview_completed", "offer"] as const;
export default function ActivityDashboard({ jobs, today, revision = 0, ownerId, onOpenJob }: {
  jobs: Job[]; today: string; revision?: number; ownerId?: string; onOpenJob: (id: string) => void;
}) {
  const [preset, setPreset] = useState("week"), [range, setRange] = useState(() => presetRange("week", today));
  const [draft, setDraft] = useState(range), [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [kind, setKind] = useState("all"), [company, setCompany] = useState(""), [workMode, setWorkMode] = useState("all");
  const [moreFilters, setMoreFilters] = useState(false);
  const [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<ActivityReport | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { if (preset !== "custom") { const next = presetRange(preset, today); setRange(next); setDraft(next); setPage(1); } }, [preset, today]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    const query = new URLSearchParams({ ...range, groupBy, kind, company, workMode, page: String(page), ...(ownerId ? { userId: ownerId } : {}) });
    void fetch((ownerId ? "/api/manager/activity?" : "/api/activity?") + query, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not load activity.");
      if (!controller.signal.aborted) setData(result);
    }).catch(error => { if (!controller.signal.aborted) { setError(error.message || "Could not load activity."); setData(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [range.from, range.to, groupBy, kind, company, workMode, page, refresh, revision, ownerId]);
  const companies = [...new Set(jobs.map(job => job.company))].sort((a, b) => a.localeCompare(b));
  const activeFilters = Number(Boolean(company)) + Number(kind !== "all") + Number(workMode !== "all");
  function clearFilters() { setCompany(""); setKind("all"); setWorkMode("all"); setPage(1); }
  return <div className="activity-dashboard">
    <section className="panel activity-filters"><header><h2>Filters</h2><p>Dates use UTC; weeks start Monday.</p></header>
      <div className="activity-filter-grid"><label className="field-label">Date range<select aria-label="Activity date range" value={preset} onChange={event => { setPreset(event.target.value); setError(""); setPage(1); }}><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option><option value="custom">Custom dates</option></select></label>
      <label className="field-label">Group chart by<select aria-label="Group activity by" value={groupBy} onChange={event => { setGroupBy(event.target.value as GroupBy); setPage(1); }}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label>
      <button className="btn filter-toggle" aria-expanded={moreFilters} aria-controls="activity-more-filters" type="button" onClick={() => setMoreFilters(!moreFilters)}>More filters{activeFilters ? ` (${activeFilters})` : ""}</button><button className="btn" type="button" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18} />Refresh activity</button></div>
      <div id="activity-more-filters" className="activity-filter-grid" hidden={!moreFilters}><label className="field-label">Company<select aria-label="Activity company" value={company} onChange={event => { setCompany(event.target.value); setPage(1); }}><option value="">All companies</option>{companies.map(name => <option key={name}>{name}</option>)}</select></label>
      <label className="field-label">Activity type<select aria-label="Activity type" value={kind} onChange={event => { setKind(event.target.value); setPage(1); }}><option value="all">All activity</option>{ACTIVITY_KINDS.map(key => <option key={key} value={key}>{ACTIVITY_LABELS[key]}</option>)}</select></label>
      <label className="field-label">Work arrangement<select aria-label="Activity work arrangement" value={workMode} onChange={event => { setWorkMode(event.target.value); setPage(1); }}><option value="all">All arrangements</option>{WORK_MODES.map(mode => <option key={mode}>{mode}</option>)}</select></label></div>
      {preset === "custom" && <form className="activity-date-form" onSubmit={event => { event.preventDefault(); if (draft.from > draft.to) { setError("Start date must be on or before end date."); return; } setError(""); setPreset("custom"); setRange({ ...draft }); setPage(1); }}>
        <label className="field-label">From (UTC)<input type="date" aria-label="Activity from date" required value={draft.from} onChange={event => { setDraft({ ...draft, from: event.target.value }); setPreset("custom"); }} /></label>
        <label className="field-label">Through (UTC)<input type="date" aria-label="Activity through date" required value={draft.to} onChange={event => { setDraft({ ...draft, to: event.target.value }); setPreset("custom"); }} /></label><button className="btn" type="submit">Apply dates</button>
      </form>}
      {activeFilters > 0 && <div className="active-filters" aria-label="Active activity filters">{company && <button className="btn" aria-label={`Remove company filter: ${company}`} onClick={() => { setCompany(""); setPage(1); }}>Company: {company} <span aria-hidden="true">×</span></button>}{kind !== "all" && <button className="btn" aria-label="Remove activity type filter" onClick={() => { setKind("all"); setPage(1); }}>Type: {ACTIVITY_LABELS[kind as keyof typeof ACTIVITY_LABELS]} <span aria-hidden="true">×</span></button>}{workMode !== "all" && <button className="btn" aria-label={`Remove work arrangement filter: ${workMode}`} onClick={() => { setWorkMode("all"); setPage(1); }}>Arrangement: {workMode} <span aria-hidden="true">×</span></button>}<button className="text-button" onClick={clearFilters}>Clear filters</button></div>}
      <p className="activity-note">Showing {range.from} through {range.to}, inclusive. Counts follow all selected filters. Partial weeks/months include only the selected dates.</p>
    </section>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {loading ? <div className="loading-center"><LoaderCircle className="spin" aria-label="Loading activity" /></div> : data && <>
      <div className="activity-metrics">{PRIMARY_METRICS.map(key => <article className="panel activity-metric" key={key} aria-label={ACTIVITY_LABELS[key]}><span>{ACTIVITY_LABELS[key]}</span><strong>{data.totals[key]}</strong></article>)}</div>
      <div className="activity-secondary-metrics">{(["saved", "rejected", "withdrawn"] as const).map(key => <article key={key} aria-label={ACTIVITY_LABELS[key]}><span>{ACTIVITY_LABELS[key]}</span><strong>{data.totals[key]}</strong></article>)}</div>
      {!data.total && <p className="activity-note" role="status">No recorded activity matches these filters.</p>}
      <ActivityChart series={data.series} groupBy={groupBy} />
      <section className="panel activity-feed"><header className="panel-heading"><h2>Activity records <span className="count-pill">{data.total}</span></h2></header>
        <div className="activity-entries">{data.entries.map(entry => <article key={entry.id}><div><strong>{ACTIVITY_LABELS[entry.kind]}{entry.label ? " · " + entry.label : ""}</strong><button className="text-button" onClick={() => onOpenJob(entry.jobId)}>{entry.title} · {entry.company} · {entry.shortId}</button>{entry.notes && <p className="preserve-lines">{entry.notes}</p>}{entry.source === "backfill" && <small>Recovered from a previously recorded date.</small>}</div><time dateTime={entry.occurredAt}>{entry.occurredAt.slice(0, 10)}</time></article>)}</div>
        <footer className="table-footer"><span>{data.total ? `${(data.page - 1) * 20 + 1}–${Math.min(data.page * 20, data.total)} of ${data.total} records` : "No activity recorded in this range"}</span><div><button className="icon-button" aria-label="Previous activity page" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}><ChevronLeft size={15} /></button><span>{data.page} / {data.pageCount}</span><button className="icon-button" aria-label="Next activity page" disabled={data.page >= data.pageCount} onClick={() => setPage(data.page + 1)}><ChevronRight size={15} /></button></div></footer>
      </section>
    </>}
    <details className="activity-definitions"><summary>How activity is counted</summary><p className="activity-note">“Interview” status alone does not mean an interview was completed. Log rounds in opportunity details. Offers, rejections, and withdrawals count the first recorded transition per opportunity. Historical dates unavailable before this update are not guessed. Undoing Applied removes that application count; deleting a job removes its activity records. Company and work-arrangement filters use the opportunity’s current details.</p></details>
  </div>;
}
