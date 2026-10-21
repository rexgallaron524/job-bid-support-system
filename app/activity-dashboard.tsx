"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, RefreshCw } from "lucide-react";
import { ACTIVITY_KINDS, ACTIVITY_LABELS, presetRange, type ActivityReport, type GroupBy } from "@/lib/activity";
import { WORK_MODES, type Job } from "@/lib/domain";

const COLORS = ["#b8a1f8", "#7faedf", "#dfb878", "#88b69b", "#db8e96", "#9c9eac"];
export default function ActivityDashboard({ jobs, today, revision = 0, ownerId, onOpenJob }: {
  jobs: Job[]; today: string; revision?: number; ownerId?: string; onOpenJob: (id: string) => void;
}) {
  const [preset, setPreset] = useState("week"), [range, setRange] = useState(() => presetRange("week", today));
  const [draft, setDraft] = useState(range), [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [kind, setKind] = useState("all"), [company, setCompany] = useState(""), [workMode, setWorkMode] = useState("all");
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
  const series = data?.series ?? [], max = Math.max(1, ...series.map(row => ACTIVITY_KINDS.reduce((sum, key) => sum + row[key], 0)));
  const barWidth = 710 / Math.max(1, series.length), tickEvery = Math.max(1, Math.ceil(series.length / 5));
  return <div className="activity-dashboard">
    <section className="panel activity-filters"><header><h2>Explore your progress</h2><p>All dates use UTC. Weeks start Monday. Each completed interview round is counted separately.</p></header>
      <div className="activity-filter-grid"><label className="field-label">Date range<select aria-label="Activity date range" value={preset} onChange={event => { setPreset(event.target.value); setPage(1); }}><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option><option value="custom">Custom dates</option></select></label>
      <label className="field-label">Group chart by<select aria-label="Group activity by" value={groupBy} onChange={event => { setGroupBy(event.target.value as GroupBy); setPage(1); }}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label>
      <label className="field-label">Company<select aria-label="Activity company" value={company} onChange={event => { setCompany(event.target.value); setPage(1); }}><option value="">All companies</option>{companies.map(name => <option key={name}>{name}</option>)}</select></label>
      <label className="field-label">Activity type<select aria-label="Activity type" value={kind} onChange={event => { setKind(event.target.value); setPage(1); }}><option value="all">All activity</option>{ACTIVITY_KINDS.map(key => <option key={key} value={key}>{ACTIVITY_LABELS[key]}</option>)}</select></label>
      <label className="field-label">Work arrangement<select aria-label="Activity work arrangement" value={workMode} onChange={event => { setWorkMode(event.target.value); setPage(1); }}><option value="all">All arrangements</option>{WORK_MODES.map(mode => <option key={mode}>{mode}</option>)}</select></label></div>
      <form className="activity-date-form" onSubmit={event => { event.preventDefault(); if (draft.from > draft.to) { setError("Start date must be on or before end date."); return; } setError(""); setPreset("custom"); setRange({ ...draft }); setPage(1); }}>
        <label className="field-label">From (UTC)<input type="date" aria-label="Activity from date" required value={draft.from} onChange={event => { setDraft({ ...draft, from: event.target.value }); setPreset("custom"); }} /></label>
        <label className="field-label">Through (UTC)<input type="date" aria-label="Activity through date" required value={draft.to} onChange={event => { setDraft({ ...draft, to: event.target.value }); setPreset("custom"); }} /></label><button className="btn" type="submit">Apply dates</button><button className="btn" type="button" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={14} />Refresh activity</button>
      </form><p className="activity-note">Showing {range.from} through {range.to}, inclusive. Counts follow all selected filters. Partial weeks/months include only the selected dates.</p>
    </section>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {loading ? <div className="loading-center"><LoaderCircle className="spin" aria-label="Loading activity" /></div> : data && <>
      <div className="activity-metrics">{ACTIVITY_KINDS.map((key, index) => <article className="panel activity-metric" key={key} aria-label={ACTIVITY_LABELS[key]}><span style={{ color: COLORS[index] }}>{ACTIVITY_LABELS[key]}</span><strong>{data.totals[key]}</strong></article>)}</div>
      <section className="panel activity-chart"><header><h2>Activity over time</h2><p>{groupBy === "week" ? "Each bar is a Monday-start week." : groupBy === "month" ? "Each bar is a calendar month." : "Each bar is one day."} Hover over a segment for its count.</p></header>
        <div className="activity-legend">{ACTIVITY_KINDS.map((key, index) => <span key={key}><i style={{ background: COLORS[index] }} />{ACTIVITY_LABELS[key]}</span>)}</div>
        <svg viewBox="0 0 800 270" role="img" aria-label="Activity counts over time"><title>Activity counts from {range.from} through {range.to}</title>
          {[0, Math.ceil(max / 2), max].filter((value, index, all) => all.indexOf(value) === index).map(value => <g key={value}><line x1="50" y1={220 - value / max * 185} x2="770" y2={220 - value / max * 185} stroke="var(--line)" /><text x="40" y={225 - value / max * 185} textAnchor="end" fill="var(--muted)" fontSize="13">{value}</text></g>)}
          {series.map((row, index) => { let total = 0; return <g key={row.date}>{ACTIVITY_KINDS.map((key, color) => { const prior = total; total += row[key]; return row[key] ? <rect key={key} x={55 + index * barWidth} y={220 - total / max * 185} width={Math.max(.2, barWidth * .75)} height={(total - prior) / max * 185} fill={COLORS[color]}><title>{row.date}: {ACTIVITY_LABELS[key]} — {row[key]}</title></rect> : null; })}{index % tickEvery === 0 && <text x={55 + index * barWidth} y="246" fill="var(--muted)" fontSize="12">{row.date.slice(groupBy === "month" ? 0 : 5)}</text>}</g>; })}
        </svg>
        {!data.total && <p className="activity-note">No recorded activity matches these filters.</p>}
        <details className="activity-numbers"><summary>View exact numbers by {groupBy}</summary><div className="table-scroll"><table><thead><tr><th>Period starts (UTC)</th>{ACTIVITY_KINDS.map(key => <th key={key}>{ACTIVITY_LABELS[key]}</th>)}</tr></thead><tbody>{series.map(row => <tr key={row.date}><td>{row.date}</td>{ACTIVITY_KINDS.map(key => <td key={key}>{row[key]}</td>)}</tr>)}</tbody></table></div></details>
      </section>
      <section className="panel activity-feed"><header className="panel-heading"><div><h2>Activity records <span className="count-pill">{data.total}</span></h2><p>Saved jobs and applications use their recorded dates. Interview records use the completion date you entered.</p></div></header>
        <div className="activity-entries">{data.entries.map(entry => <article key={entry.id}><div><strong>{ACTIVITY_LABELS[entry.kind]}{entry.label ? " · " + entry.label : ""}</strong><button className="text-button" onClick={() => onOpenJob(entry.jobId)}>{entry.title} · {entry.company} · {entry.shortId}</button>{entry.notes && <p className="preserve-lines">{entry.notes}</p>}{entry.source === "backfill" && <small>Recovered from a previously recorded date.</small>}</div><time dateTime={entry.occurredAt}>{entry.occurredAt.slice(0, 10)}</time></article>)}</div>
        <footer className="table-footer"><span>{data.total ? `${(data.page - 1) * 20 + 1}–${Math.min(data.page * 20, data.total)} of ${data.total} records` : "No activity recorded in this range"}</span><div><button className="icon-button" aria-label="Previous activity page" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}><ChevronLeft size={15} /></button><span>{data.page} / {data.pageCount}</span><button className="icon-button" aria-label="Next activity page" disabled={data.page >= data.pageCount} onClick={() => setPage(data.page + 1)}><ChevronRight size={15} /></button></div></footer>
      </section>
    </>}
    <p className="activity-note">“Interview” status alone does not mean an interview was completed. Log rounds in opportunity details. Offers, rejections, and withdrawals count the first recorded transition per opportunity. Historical dates unavailable before this update are not guessed. Undoing Applied removes that application count; deleting a job removes its activity records. Company and work-arrangement filters use the opportunity’s current details.</p>
  </div>;
}
