"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ACTIVITY_KINDS, ACTIVITY_LABELS, type ActivityKind, type ActivityReport, type GroupBy } from "@/lib/activity";

export default function ActivityChart({ series, groupBy }: { series: ActivityReport["series"]; groupBy: GroupBy }) {
  const container = useRef<HTMLDivElement>(null);
  const tableHeader = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600), [labelSize, setLabelSize] = useState(14), [all, setAll] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10);
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      setWidth(Math.max(1, entries[0].contentRect.width));
      setLabelSize(parseFloat(getComputedStyle(entries[0].target).fontSize) * .875);
    });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const found = series.findIndex(row => row.date === selectedDate);
  const selected = found >= 0 ? found : Math.max(0, series.length - 1);
  const row = series[selected];
  const keys: readonly ActivityKind[] = all ? ACTIVITY_KINDS : ["applied", "interview_completed"];
  // Keep individual bars usable even for a five-year daily report. Every period
  // remains available through the period selector and the paginated exact table.
  const left = Math.max(44, Math.ceil(labelSize * 3.5)), right = Math.ceil(labelSize);
  const visibleCount = Math.max(1, Math.floor((width - left - right) / (all ? 84 : 46)));
  const start = Math.max(0, Math.min(selected - Math.floor(visibleCount / 2), series.length - visibleCount));
  const visible = series.slice(start, start + visibleCount);
  const max = Math.max(1, ...visible.flatMap(value => keys.map(key => value[key])));
  const plotWidth = Math.max(1, width - left - right), slot = plotWidth / Math.max(1, visible.length);
  const barWidth = Math.min(32, slot * .72 / keys.length);
  const pageCount = Math.max(1, Math.ceil(series.length / pageSize)), currentPage = Math.min(page, pageCount);
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];
  const columns = <colgroup><col style={{ width: "11rem" }} />{ACTIVITY_KINDS.map(key => <col key={key} />)}</colgroup>;
  return <section className="panel activity-chart">
    <header><h2>Activity over time</h2><p>Compare counts side by side. {groupBy === "week" ? "Weeks start Monday." : groupBy === "month" ? "Periods start on the first of each month." : "Each period is one day."} Dates use UTC.</p></header>
    <div className="chart-controls"><label className="field-label">Show in chart<select aria-label="Chart metrics" value={all ? "all" : "primary"} onChange={event => setAll(event.target.value === "all")}><option value="primary">Applications & interviews</option><option value="all">All activity</option></select></label></div>
    <div className="activity-legend">{keys.map(key => <span key={key}><i style={{ background: `var(--chart-${key})` }} />{ACTIVITY_LABELS[key]}</span>)}</div>
    <div ref={container} className="chart-canvas"><svg viewBox={`0 0 ${width} 284`} width={width} height="284" role="img" aria-label="Activity counts over time">
      <title>Separate counts for {keys.map(key => ACTIVITY_LABELS[key]).join(" and ")}</title><desc>Select a chart period below to read exact counts. The chart shows {visible.length} periods around the selected date.</desc>
      {ticks.map(value => <g key={value}><line x1={left} y1={232 - value / max * 198} x2={width - right} y2={232 - value / max * 198} stroke="var(--line)" /><text x={left - 10} y={232 + labelSize / 3 - value / max * 198} textAnchor="end" fill="var(--muted)" fontSize={labelSize}>{value}</text></g>)}
      {visible.map((value, index) => <g key={value.date}>
        {keys.map((key, metric) => <rect key={key} x={left + index * slot + (slot - barWidth * keys.length) / 2 + metric * barWidth} y={232 - value[key] / max * 198} width={Math.max(1, barWidth - 2)} height={value[key] / max * 198} fill={`var(--chart-${key})`} />)}
        <rect x={left + index * slot} y="24" width={slot} height="212" fill="transparent" stroke={value.date === row?.date ? "var(--muted)" : "none"} strokeDasharray="4 4" className="chart-hit" onClick={() => setSelectedDate(value.date)}><title>{value.date}: {keys.map(key => `${ACTIVITY_LABELS[key]} ${value[key]}`).join(", ")}</title></rect>
        {(index % Math.max(1, Math.ceil(visible.length / Math.max(1, Math.floor(plotWidth / (labelSize * (groupBy === "month" ? 7 : 5)))))) === 0) && <text x={left + (index + .5) * slot} y="263" textAnchor="middle" fill="var(--muted)" fontSize={labelSize}>{(groupBy === "month" ? value.date.slice(0, 7) : value.date.slice(5))}</text>}
      </g>)}
    </svg></div>
    <div className="chart-period-controls"><button className="icon-button" aria-label="Previous chart period" disabled={selected === 0} onClick={() => setSelectedDate(series[selected - 1].date)}><ChevronLeft size={20} /></button><label className="field-label">Chart period (UTC)<select aria-label="Chart period" value={row?.date ?? ""} onChange={event => setSelectedDate(event.target.value)}>{series.map(value => <option key={value.date}>{value.date}</option>)}</select></label><button className="icon-button" aria-label="Next chart period" disabled={selected >= series.length - 1} onClick={() => setSelectedDate(series[selected + 1].date)}><ChevronRight size={20} /></button></div>
    <div className="chart-selection" aria-live="polite"><strong>{row?.date}</strong>{keys.map(key => <span key={key}>{ACTIVITY_LABELS[key]}: <b>{row?.[key] ?? 0}</b></span>)}</div>
    {series.length > visible.length && <p className="activity-note">Showing {visible[0]?.date}–{visible.at(-1)?.date}. Choose a period to move through the full range.</p>}
    <details className="activity-numbers"><summary>View exact numbers by {groupBy}</summary><div className="activity-table-wrap">
      {/* Outside the horizontal scroller, this header can stick to the page.
          The real table retains its own column headers for assistive technology. */}
      <div ref={tableHeader} className="activity-table-header"><table aria-hidden="true">{columns}<thead><tr><th>Period starts (UTC)</th>{ACTIVITY_KINDS.map(key => <th key={key}>{ACTIVITY_LABELS[key]}</th>)}</tr></thead></table></div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Exact activity counts" onScroll={event => { if (tableHeader.current) tableHeader.current.scrollLeft = event.currentTarget.scrollLeft; }}><table className="activity-values">{columns}<thead className="sr-only"><tr><th scope="col">Period starts (UTC)</th>{ACTIVITY_KINDS.map(key => <th scope="col" key={key}>{ACTIVITY_LABELS[key]}</th>)}</tr></thead><tbody>{series.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(value => <tr key={value.date}><th scope="row">{value.date}</th>{ACTIVITY_KINDS.map(key => <td key={key}>{value[key]}</td>)}</tr>)}</tbody></table></div></div>
      <footer className="table-footer"><span>{series.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, series.length)} of ${series.length} periods` : "No periods"}</span><label className="page-size-control">Periods per page<select aria-label="Periods per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 20, 50].map(size => <option key={size}>{size}</option>)}</select></label><div><button className="icon-button" aria-label="Previous numbers page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={20} /></button><span>{currentPage} / {pageCount}</span><button className="icon-button" aria-label="Next numbers page" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={20} /></button></div></footer>
    </details>
  </section>;
}
