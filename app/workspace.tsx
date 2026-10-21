"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ExternalLink, FileText, FolderClosed, LayoutDashboard, ListFilter, LoaderCircle, LockKeyhole, LogOut, Menu, Moon, MoreHorizontal, Pencil, Plus, Search, Settings2, ShieldCheck, Sparkles, Sun, Target, Trash2, Undo2, Upload, X } from "lucide-react";
import { deadlineLabel, inferCompany, isValidDate, MAX_RESUME_SIZE, normalizeJobUrl, STATUSES, WORK_MODES, type Job, type Status } from "@/lib/domain";

import SignOut from "./sign-out";
import ExportButton from "./export-button";
import PasswordForm from "./password-form";
import ProfilePage from "./profile-page";
import ActivityDashboard from "./activity-dashboard";
import InterviewHistory from "./interview-history";

type View = "overview" | "applications" | "deadlines" | "documents" | "profile" | "settings" | "activity";
type User = { name: string; email: string; theme: string; applicationPageSize: number };
type JobFields = { url: string; company: string; title: string; location: string; workMode: string; salary: string; deadline: string; description: string; notes: string };
const EMPTY: JobFields = { url: "", company: "", title: "", location: "", workMode: "Unspecified", salary: "", deadline: "", description: "", notes: "" };
const TITLES: Record<View, string> = { overview: "Overview", applications: "All applications", deadlines: "Deadlines", documents: "My resumes", profile: "My profile", settings: "Settings", activity: "Progress dashboard" };
const STATUS_CLASS: Record<string, string> = { Saved: "saved", Preparing: "preparing", Applied: "applied", Interview: "interview", Offer: "offer", Rejected: "rejected", Withdrawn: "withdrawn" };
const formatDate = (value: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(value));
const initials = (value: string) => value.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
const todayUTC = () => new Date().toISOString().slice(0, 10);
const isOpen = (job: Job) => !["Rejected", "Withdrawn", "Offer"].includes(job.status);
const hue = (company: string) => [...company].reduce((v, c) => v + c.charCodeAt(0), 0) % 5;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, headers: { ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...options?.headers }, cache: "no-store" });
  let result;
  try { result = await response.json(); } catch { throw new Error("Your session may have expired. Refresh and sign in again."); }
  if (!response.ok) {
    const message = result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "Could not complete that action.";
    throw new Error(message);
  }
  return result as T;
}

function CompanyLogo({ company, large = false }: { company: string; large?: boolean }) {
  return <span className={`company-logo hue-${hue(company)} ${large ? "large" : ""}`} aria-hidden="true">{initials(company)}</span>;
}
function Badge({ status }: { status: string }) { return <span className={`badge ${STATUS_CLASS[status] ?? "saved"}`}><i />{status}</span>; }
function EmptyState({ icon = "jobs", title, children, action }: { icon?: string; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon === "search" ? <Search size={25} /> : icon === "documents" ? <FileText size={25} /> : icon === "calendar" ? <CalendarDays size={25} /> : <BriefcaseBusiness size={25} />}</div><h3>{title}</h3><p>{children}</p>{action}</div>;
}

function Modal({ title, subtitle, children, onClose, className = "" }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const focusables = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]');
      if (!focusables?.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); prior?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><header className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></header>{children}</div></div>;
}

export default function Workspace({ user, managerUrl }: { user: User; managerUrl?: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>("overview");
  const [theme, setTheme] = useState("dark");
  const [sidebar, setSidebar] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [workMode, setWorkMode] = useState("All");
  const [sort, setSort] = useState("recent");
  const [filters, setFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [applicationPageSize, setApplicationPageSize] = useState(user.applicationPageSize);
  const [profileDirty, setProfileDirty] = useState(false);
  const [activityRevision, setActivityRevision] = useState(0);
  const [editor, setEditor] = useState<Job | "new" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "undo"; job: Job } | null>(null);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [today, setToday] = useState(todayUTC);
  const selected = jobs.find((j) => j.id === selectedId);

  const notify = useCallback((text: string, error = false) => setNotice({ text, error }), []);
  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try { setJobs(await request<Job[]>("/api/jobs")); } catch (e) { setLoadError((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); setTheme(user.theme); document.documentElement.dataset.theme = user.theme; const timer = setInterval(() => setToday(todayUTC()), 60000); return () => clearInterval(timer); }, [load, user.theme]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), notice.error ? 9000 : 4500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { setPage(1); }, [query, status, sort, workMode, view, applicationPageSize]);

  function toggleTheme(next?: string) { const value = next ?? (theme === "dark" ? "light" : "dark"); setTheme(value); document.documentElement.dataset.theme = value; try { localStorage.setItem("jobbid-theme", value); } catch {} void request("/api/preferences", { method: "PATCH", body: JSON.stringify({ theme: value }) }).catch(e => notify(e.message, true)); }
  function navigate(next: View) {
    if (profileDirty && next !== view && !window.confirm("Your profile has unsaved changes. Leave without saving?")) return;
    setView(next); setSidebar(false); setQuery(""); setStatus("All"); setWorkMode("All"); window.scrollTo(0, 0);
  }
  function changePageSize(size: number) {
    setApplicationPageSize(size); setPage(1);
    void request("/api/preferences", { method: "PATCH", body: JSON.stringify({ applicationPageSize: size }) }).catch(error => notify("Page size changed here, but could not be saved: " + error.message, true));
  }
  async function copyOpportunityId(job: Job) {
    try { await navigator.clipboard.writeText(job.shortId); notify("Opportunity ID copied."); }
    catch { notify("Copy this opportunity ID: " + job.shortId); }
  }
  function upsert(job: Job) { setJobs((prior) => [job, ...prior.filter((j) => j.id !== job.id)]); setActivityRevision(value => value + 1); }
  async function changeStatus(job: Job, next: Status) {
    setBusy(true);
    try { upsert(await request<Job>(`/api/jobs/${job.id}`, { method: "PATCH", body: JSON.stringify({ action: "setStatus", status: next }) })); notify(next === "Applied" ? "Application recorded. One step closer." : `Moved to ${next.toLowerCase()}.`); if (next === "Applied") setOpened(null); } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); }
  }
  async function confirmAction() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "delete") {
        await request(`/api/jobs/${confirm.job.id}`, { method: "DELETE" }); setJobs((prior) => prior.filter((j) => j.id !== confirm.job.id)); setActivityRevision(value => value + 1); setSelectedId(null); notify("Job and its attached resume deleted.");
      } else { upsert(await request<Job>(`/api/jobs/${confirm.job.id}`, { method: "PATCH", body: JSON.stringify({ action: "undoApplied" }) })); notify("Application undone. The job is back in Saved."); }
      setConfirm(null);
    } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); }
  }
  async function upload(job: Job, file: File) {
    if (file.size > MAX_RESUME_SIZE) { notify("Your resume must be 10 MB or smaller.", true); return; }
    if (!/\.(pdf|docx)$/i.test(file.name)) { notify("Choose a PDF or DOCX resume.", true); return; }
    setBusy(true);
    try { const form = new FormData(); form.append("file", file); upsert(await request<Job>(`/api/jobs/${job.id}/resume`, { method: "POST", body: form })); notify("Tailored resume saved to this job."); } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); }
  }
  async function removeResume(job: Job) {
    setBusy(true);
    try { upsert(await request<Job>(`/api/jobs/${job.id}/resume`, { method: "DELETE" })); notify("Resume removed."); } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); }
  }

  const applied = jobs.filter((j) => j.appliedAt);
  const interviews = jobs.filter((j) => j.status === "Interview");
  const saved = jobs.filter((j) => ["Saved", "Preparing"].includes(j.status));
  const upcoming = jobs.filter((j) => j.deadline && !j.appliedAt && isOpen(j)).sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  const soon = upcoming.filter((j) => j.deadline! <= new Date(Date.parse(today) + 7 * 86400000).toISOString().slice(0, 10));
  const resumes = jobs.filter((j) => j.resumeName);
  const filtered = useMemo(() => jobs.filter((job) => (status === "All" || (status === "Sent" ? !!job.appliedAt : status === "For later" ? ["Saved", "Preparing"].includes(job.status) : job.status === status)) && (workMode === "All" || job.workMode === workMode) && `${job.shortId} ${job.title} ${job.company} ${job.location} ${job.notes}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "company" ? a.company.localeCompare(b.company) : sort === "deadline" ? (a.deadline || "9999").localeCompare(b.deadline || "9999") : b.createdAt.localeCompare(a.createdAt)), [jobs, status, workMode, query, sort]);
  const pageSize = view === "overview" ? 5 : applicationPageSize;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstName = user.name.includes("@") ? user.name.split("@")[0] : user.name.split(" ")[0];

  const navItems: { view: View; label: string; icon: typeof Search; count?: number }[] = [
    { view: "overview", label: "Overview", icon: LayoutDashboard }, { view: "activity", label: "Progress dashboard", icon: CalendarDays }, { view: "applications", label: "All applications", icon: BriefcaseBusiness, count: jobs.length }, { view: "deadlines", label: "Deadlines", icon: CalendarDays, count: soon.length || undefined }, { view: "documents", label: "My resumes", icon: FileText }, { view: "profile", label: "My profile", icon: FileText },
  ];

  return <div className="app-shell">
    {sidebar && <div className="sidebar-scrim" onClick={() => setSidebar(false)} />}
    <aside className={`sidebar ${sidebar ? "is-open" : ""}`}>
      <a href="/" className="brand"><span className="brand-mark">a.</span><span className="brand-title">All in one place<small>job support</small></span></a>
      <button className="workspace-switch" onClick={() => navigate("settings")}><span className="workspace-icon"><FolderClosed size={17} /></span><span>Personal workspace<small>Just for you</small></span><LockKeyhole size={13} /></button>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="Main navigation">{navItems.map((item) => <button key={item.view} className={`nav-item ${view === item.view ? "active" : ""}`} onClick={() => navigate(item.view)}><item.icon size={18} /><span>{item.label}</span>{item.count !== undefined && <span className="nav-count">{item.count}</span>}</button>)}</nav>
      <div className="sidebar-bottom">{managerUrl && <a className="nav-item" href={managerUrl}><ShieldCheck size={18} /><span>Manager dashboard</span></a>}<div className="sidebar-tip"><span className="tip-icon"><Sparkles size={17} /></span><h4>Progress, one step at a time.</h4><p>Your next opportunity starts with a little organization.</p><button onClick={() => setEditor("new")}>Save an opportunity <ArrowUpRight size={14} /></button></div><button className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}><Settings2 size={18} /><span>Settings</span></button><button className="nav-item" onClick={() => setHelp(true)}><CircleHelp size={18} /><span>How it works</span><ArrowUpRight className="nav-end" size={14} /></button><div className="profile"><span className="avatar">{initials(user.name)}</span><div><strong>{firstName}</strong><small>Personal account</small></div><SignOut compact /></div></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" onClick={() => setSidebar(true)} aria-label="Open navigation"><Menu size={21} /></button><span>Workspace</span><ChevronRight size={13} /><strong>{TITLES[view]}</strong></div><div className="topbar-actions"><span className="private-pill"><LockKeyhole size={12} /> Private workspace</span><button className="icon-button" onClick={() => toggleTheme()} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Toggle appearance">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><button className="icon-button notification-button" onClick={() => navigate("deadlines")} aria-label={`${soon.length} upcoming deadlines`}><Bell size={18} />{soon.length > 0 && <i />}</button><span className="avatar small">{initials(user.name)}</span></div></header>

      <main className="main-content">
        <section className="page-heading"><div><div className="eyebrow">YOUR CAREER, IN MOTION</div><h1>{view === "overview" ? <>Make your next move<span className="heading-dot">.</span></> : TITLES[view]}</h1><p>{view === "overview" ? `Hey ${firstName}, a little progress today goes a long way.` : view === "applications" ? "Every opportunity. Every next step. All in one place." : view === "deadlines" ? "A little planning makes room for the right opportunity." : view === "documents" ? "The right resume, ready for the right opportunity." : view === "activity" ? "Your daily effort and career progress, measured over time." : view === "profile" ? "Your full career history, ready to shape every application." : "Your account, your space, your preferences."}</p></div>{!["settings", "profile"].includes(view) && <button className="btn primary" onClick={() => setEditor("new")}><Plus size={17} /> Add a job</button>}</section>

        {loadError ? <div className="error-banner" role="alert"><span>{loadError}</span><button className="btn" onClick={load}>Try again</button></div> : null}

        {view === "activity" && <ActivityDashboard jobs={jobs} today={today} revision={activityRevision} onOpenJob={setSelectedId} />}{view === "overview" && <>
          <div className="stat-grid">
            {[{ label: "Total opportunities", value: jobs.length, icon: BriefcaseBusiness, detail: "Your next chapter, taking shape", color: "purple", filter: "All" }, { label: "Applications sent", value: applied.length, icon: ArrowUpRight, detail: "Every application is a step forward", color: "blue", filter: "Sent" }, { label: "In conversation", value: interviews.length, icon: CalendarDays, detail: "Good things are happening", color: "amber", filter: "Interview" }, { label: "Saved for later", value: saved.length, icon: FolderClosed, detail: "Possibilities worth coming back to", color: "green", filter: "For later" }].map((stat) => <button key={stat.label} className="stat-card" onClick={() => { navigate("applications"); setStatus(stat.filter); }}><div className="stat-top"><span>{stat.label}</span><span className={`stat-icon ${stat.color}`}><stat.icon size={17} /></span></div><strong>{loading ? <span className="skeleton number-skeleton" /> : stat.value.toString().padStart(2, "0")}</strong><p>{stat.detail}</p><div className={`stat-line ${stat.color}`} /></button>)}
          </div>
          <button className="text-button progress-shortcut" onClick={() => navigate("activity")}>See daily, weekly, and monthly progress <ArrowRight size={15} /></button><section className="momentum-banner"><div className="momentum-symbol"><Target size={27} /><span /></div><div><div className="eyebrow">SMALL STEPS. BIG POSSIBILITIES.</div><h3>Your next chapter is worth showing up for.</h3><p>Keep your opportunities organized. Give each application your best shot.</p></div><button onClick={() => setHelp(true)}>Find your flow <ArrowRight size={16} /></button><div className="banner-orbits" aria-hidden="true"><i /><i /><i /></div></section>
        </>}

        {(view === "overview" || view === "applications") && <div className={`dashboard-grid ${view === "applications" ? "full-width" : ""}`}>
          <section className="panel jobs-panel"><header className="panel-heading"><div><h2>{view === "overview" ? "Your applications" : "Application workspace"}<span className="count-pill">{jobs.length}</span></h2><p>{view === "overview" ? "A clear view of where you stand." : "Manage the details. Keep moving forward."}</p></div>{view === "overview" && <button className="text-button" onClick={() => navigate("applications")}>View all <ArrowUpRight size={15} /></button>}</header>
            <div className="table-toolbar"><div className="status-tabs" role="group" aria-label="Filter by status">{["All", "Saved", "Applied", "Interview"].map((s) => <button key={s} onClick={() => setStatus(s)} className={status === s ? "selected" : ""}>{s}{s === "All" && <span>{jobs.length}</span>}</button>)}</div><button className={`btn filter-button ${filters ? "filter-active" : ""}`} onClick={() => setFilters(!filters)} aria-expanded={filters}><ListFilter size={14} />Filters{(workMode !== "All" || !["All", "Saved", "Applied", "Interview"].includes(status)) && <i className="filter-dot" />}</button></div>
            <div className="search-row"><div className="search-field"><Search size={16} /><input aria-label="Search jobs" placeholder="Search by ID, role, company, or location..." value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button className="icon-button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}</div><label className="sort-select"><ArrowDown size={13} /><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort applications"><option value="recent">Newest first</option><option value="company">Company A–Z</option><option value="deadline">Deadline first</option></select><ChevronDown size={12} /></label></div>
            {filters && <div className="expanded-filters"><label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option>All</option><option>Sent</option><option>For later</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label><label>Work arrangement<select value={workMode} onChange={(e) => setWorkMode(e.target.value)}><option>All</option>{WORK_MODES.map((s) => <option key={s}>{s}</option>)}</select></label><button className="text-button" onClick={() => { setWorkMode("All"); setStatus("All"); setQuery(""); }}>Reset filters</button></div>}
            {loading ? <div className="table-loading">{[1, 2, 3, 4].map((n) => <div className="loading-row" key={n}><span className="skeleton logo-skeleton" /><span className="skeleton text-skeleton" /><span className="skeleton badge-skeleton" /></div>)}</div> : visible.length ? <div className="table-scroll"><table><thead><tr><th>OPPORTUNITY</th><th>STATUS</th><th>DATE ADDED</th><th className="action-heading">ACTION</th></tr></thead><tbody>{visible.map((job) => <tr key={job.id}><td><button className="job-cell" onClick={() => setSelectedId(job.id)}><CompanyLogo company={job.company} /><span><strong>{job.title}</strong><small>{job.company}<span className="separator">·</span>{job.workMode !== "Unspecified" ? job.workMode : job.location || "Location not set"}</small><span className="opportunity-id">ID: {job.shortId}</span></span></button></td><td><Badge status={job.status} /></td><td className="date-cell">{formatDate(job.createdAt)}</td><td><div className="row-actions">{job.appliedAt ? <button className="apply-button applied-button" disabled><CheckCheck size={13} />Applied</button> : <a className="apply-button" href={job.url} target="_blank" rel="noopener noreferrer" onClick={() => { setOpened(job.id); setSelectedId(job.id); }}>Apply <ArrowUpRight size={13} /></a>}<button className="icon-button" onClick={() => setSelectedId(job.id)} aria-label={`Details for ${job.title} at ${job.company}`}><MoreHorizontal size={17} /></button></div></td></tr>)}</tbody></table></div> : <EmptyState icon={jobs.length ? "search" : "jobs"} title={jobs.length ? "No matching opportunities" : "Your next chapter starts with one job"}>{jobs.length ? "Try another search or adjust your filters." : "Found a role you like? Save the link, tailor your resume, and take it one step at a time."}{/* action is rendered separately for clarity */}</EmptyState>}
            {!loading && !jobs.length && <div className="empty-add"><button className="btn primary" onClick={() => setEditor("new")}><Plus size={16} /> Save your first job</button></div>}
            <footer className="table-footer"><span>{filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} opportunities` : "Your opportunities will appear here"}</span><div>{view === "applications" && <label className="page-size-control">Rows per page<select aria-label="Rows per page" value={applicationPageSize} onChange={event => changePageSize(Number(event.target.value))}>{[10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>}<button className="icon-button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button><span aria-live="polite">{currentPage} / {pageCount}</span><button className="icon-button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Next page"><ChevronRight size={15} /></button></div></footer>
          </section>

          {view === "overview" && <aside className="right-column"><section className="panel deadlines-panel"><header className="panel-heading"><div><h2><CalendarDays size={16} /> On the horizon</h2><p>A heads-up for your next steps.</p></div><span className="count-pill">{upcoming.length}</span></header>{upcoming.length ? <div className="deadline-list">{upcoming.slice(0, 3).map((job) => <button className="deadline-item" key={job.id} onClick={() => setSelectedId(job.id)}><span className="calendar-tile"><small>{new Date(job.deadline!).toLocaleDateString("en", { month: "short", timeZone: "UTC" })}</small><strong>{Number(job.deadline!.slice(-2))}</strong></span><span><strong>{job.title}</strong><small>{job.company}</small><span className={`due-label ${job.deadline! <= today ? "urgent" : ""}`}>{deadlineLabel(job.deadline!, today)}</span></span><ChevronRight size={14} /></button>)}</div> : <div className="calm-empty"><span><CalendarDays size={22} /></span><h4>A little breathing room.</h4><p>Add a deadline to a saved job and we’ll keep it in view here.</p></div>}<button className="panel-link" onClick={() => navigate("deadlines")}>View all deadlines <ArrowRight size={14} /></button></section>
            <section className="panel journey-panel"><span className="eyebrow">YOUR APPLICATION JOURNEY</span><h3>A place for every possibility.</h3><div className="journey-bar">{STATUSES.map((s) => <i key={s} className={STATUS_CLASS[s]} style={{ flex: jobs.filter((j) => j.status === s).length || (jobs.length ? 0 : 1), display: jobs.length && !jobs.some((j) => j.status === s) ? "none" : undefined }} />)}</div><div className="journey-legend">{["Saved", "Applied", "Interview", "Offer"].map((s) => <div key={s}><span><i className={STATUS_CLASS[s]} />{s}</span><strong>{jobs.filter((j) => j.status === s).length}</strong></div>)}</div><div className="private-note"><ShieldCheck size={15} /><span>Your applications are visible to you and the manager.</span></div></section>
          </aside>}
        </div>}

        {view === "deadlines" && <section className="panel"><header className="panel-heading"><div><h2>Upcoming application deadlines <span className="count-pill">{upcoming.length}</span></h2><p>Open opportunities you haven’t applied to yet. Dates use UTC.</p></div></header>{loading ? <div className="loading-center"><LoaderCircle className="spin" /></div> : upcoming.length ? <div className="deadline-grid">{upcoming.map((job) => <button key={job.id} className="deadline-card" onClick={() => setSelectedId(job.id)}><div><CompanyLogo company={job.company} /><span className={`due-label ${job.deadline! <= today ? "urgent" : ""}`}>{deadlineLabel(job.deadline!, today)}</span></div><h3>{job.title}</h3><p>{job.company} · {job.location || job.workMode}</p><span className="opportunity-id">ID: {job.shortId}</span><footer><CalendarDays size={14} />{formatDate(job.deadline!)}<ArrowUpRight size={16} /></footer></button>)}</div> : <EmptyState icon="calendar" title="A clear horizon">Add application deadlines when saving jobs. We’ll bring the nearest ones to the top.</EmptyState>}</section>}

        {view === "documents" && <section className="panel"><header className="panel-heading"><div><h2>Your tailored resumes <span className="count-pill">{resumes.length}</span></h2><p>Each document belongs to a specific opportunity. PDF and DOCX, up to 10 MB.</p></div></header>{loading ? <div className="loading-center"><LoaderCircle className="spin" /></div> : resumes.length ? <div className="document-grid">{resumes.map((job) => <article className="document-card" key={job.id}><span className="document-icon"><FileText size={25} /></span><h3>{job.resumeName}</h3><p>{job.title} · {job.company}</p><span className="opportunity-id">ID: {job.shortId}</span><small>{((job.resumeSize || 0) / 1024).toFixed(0)} KB</small><div><a className="btn" href={`/api/jobs/${job.id}/resume`}><ArrowDownToLine size={14} />Download</a><button className="text-button" onClick={() => setSelectedId(job.id)}>View job <ArrowRight size={14} /></button></div></article>)}</div> : <EmptyState icon="documents" title="Make every application personal">Open a saved job to upload its tailored resume. Your documents stay connected to the right role and are visible to you and the manager.</EmptyState>}</section>}

        {view === "profile" && <ProfilePage name={user.name} email={user.email} onDirtyChange={setProfileDirty} />}{view === "settings" && <div className="settings-grid"><section className="panel settings-panel"><header><span className="stat-icon purple"><Settings2 size={18} /></span><h2>Make yourself at home</h2><p>Choose the appearance that works for you.</p></header><div className="theme-choices">{["dark", "light"].map((mode) => <button key={mode} className={`theme-choice ${theme === mode ? "chosen" : ""}`} onClick={() => toggleTheme(mode)}><div className={`theme-preview ${mode}`}><span /><div><i /><i /><i /></div></div><span>{mode === "dark" ? <Moon size={15} /> : <Sun size={15} />}{mode === "dark" ? "Midnight" : "Daylight"}{theme === mode && <Check size={15} />}</span></button>)}</div><p className="settings-hint">Your appearance preference is saved to your account.</p></section><section className="panel settings-panel"><header><span className="stat-icon green"><ShieldCheck size={18} /></span><h2>A space that’s yours</h2><p>Signed in as <strong>{user.email}</strong></p></header><div className="privacy-details"><p><Check size={16} />Other ordinary users cannot access your jobs, notes, or resumes.</p><p><Check size={16} />Duplicate checks apply only to your own jobs.</p><p><Check size={16} />The manager can view your profile and application data, and manage account access.</p></div><SignOut /></section><PasswordForm /></div>}
        <footer className="main-footer"><span><span className="footer-spark">✦</span> A little more organized. A little closer to what’s next.</span><span><LockKeyhole size={11} />Your search stays yours.</span></footer>
      </main>
    </div>

    {selected && !editor && !confirm && <Modal title="Opportunity details" subtitle="Every detail, in one place." className="detail-modal" onClose={() => { if (!busy) setSelectedId(null); }}><div className="detail-body"><div className="detail-identity"><CompanyLogo company={selected.company} large /><div><h2>{selected.title}</h2><p>{selected.company}</p></div><button className="icon-button" onClick={() => setEditor(selected)} aria-label="Edit job"><Pencil size={17} /></button></div><div className="detail-meta"><span className="opportunity-id">Opportunity ID: {selected.shortId}</span><button className="text-button" onClick={() => void copyOpportunityId(selected)}>Copy opportunity ID</button><Badge status={selected.status} />{selected.location && <span>{selected.location}</span>}{selected.workMode !== "Unspecified" && <span>{selected.workMode}</span>}</div>
      <div className="application-actions">{selected.appliedAt ? <><button className="btn applied-confirmed" disabled><CheckCheck size={16} />Applied {formatDate(selected.appliedAt)}</button><a className="btn" href={selected.url} target="_blank" rel="noopener noreferrer">View posting <ExternalLink size={14} /></a></> : <><a className="btn primary" href={selected.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(selected.id)}>Apply on website <ArrowUpRight size={16} /></a><button className="btn" disabled={busy} onClick={() => changeStatus(selected, "Applied")}><Check size={16} />Mark as applied</button></>}</div>
      {opened === selected.id && !selected.appliedAt && <div className="inline-note"><Check size={16} /><span>Finished submitting? Use <strong>Mark as applied</strong> to record it here.</span></div>}
      <InterviewHistory key={selected.id} jobId={selected.id} onChange={() => setActivityRevision(value => value + 1)} /><div className="detail-info"><label>Application status<select value={selected.status} disabled={busy} onChange={(e) => changeStatus(selected, e.target.value as Status)}>{STATUSES.map((s) => <option key={s} disabled={!!selected.appliedAt && ["Saved", "Preparing"].includes(s)}>{s}</option>)}</select></label><div><span>Application deadline</span><strong>{selected.deadline ? `${formatDate(selected.deadline)} · ${deadlineLabel(selected.deadline, today)}` : "Not set"}</strong></div><div><span>Salary range</span><strong>{selected.salary || "Not specified"}</strong></div><div><span>Date saved</span><strong>{formatDate(selected.createdAt)}</strong></div></div>
      <section className="detail-section"><div className="section-title"><h3>Tailored resume</h3><LockKeyhole size={13} /></div>{selected.resumeName ? <div className="resume-attachment"><span className="document-icon"><FileText size={21} /></span><div><strong>{selected.resumeName}</strong><small>{((selected.resumeSize || 0) / 1024).toFixed(0)} KB · Private attachment</small></div><a className="icon-button" aria-label="Download resume" href={`/api/jobs/${selected.id}/resume`}><ArrowDownToLine size={17} /></a><button className="icon-button danger-text" disabled={busy} onClick={() => removeResume(selected)} aria-label="Remove resume"><Trash2 size={16} /></button></div> : null}<label className={`upload-area ${busy ? "disabled" : ""}`}><Upload size={19} /><span>{busy ? "Saving..." : selected.resumeName ? "Replace resume" : "Upload a resume for this role"}<small>PDF or DOCX · Up to 10 MB</small></span><input type="file" accept=".pdf,.docx" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(selected, file); e.target.value = ""; }} /></label>{selected.appliedAt && <p className="field-hint">This is the resume attached to your application. Replacing it overwrites your saved copy.</p>}</section>
      <section className="detail-section"><h3>Prepare your tailored resume</h3><p className="field-hint">Opportunity ID: {selected.shortId}. This same ID appears in the exported folder and jd.txt.</p><ExportButton job={selected} accountKey={user.email} /><button className="text-button profile-job-link" onClick={() => { setSelectedId(null); navigate("profile"); }}>Open My profile for resume preparation <ArrowRight size={14} /></button></section><section className="detail-section"><h3>Job description</h3><p className={`preserve-lines ${!selected.description ? "muted" : ""}`}>{selected.description || "No description yet. Edit this job to paste the description and keep a copy."}</p></section><section className="detail-section"><h3>Your notes</h3><p className={`preserve-lines ${!selected.notes ? "muted" : ""}`}>{selected.notes || "A place for recruiter details, interview notes, and your next steps."}</p></section><a className="original-url" href={selected.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />{selected.url}</a>
      </div><footer className="detail-footer"><button className="text-button danger-text" disabled={busy} onClick={() => setConfirm({ kind: "delete", job: selected })}><Trash2 size={14} />Delete job</button><div>{selected.appliedAt && <button className="text-button" disabled={busy} onClick={() => setConfirm({ kind: "undo", job: selected })}><Undo2 size={14} />Undo applied</button>}<button className="btn" disabled={busy} onClick={() => setEditor(selected)}><Pencil size={14} />Edit details</button></div></footer></Modal>}

    {editor && <JobEditor job={editor === "new" ? null : editor} jobs={jobs} onClose={() => setEditor(null)} onSaved={(job) => { upsert(job); setEditor(null); setSelectedId(job.id); notify(editor === "new" ? "Opportunity saved. Let’s see where it takes you." : "Job details updated."); }} />}
    {confirm && <Modal title={confirm.kind === "delete" ? "Delete this opportunity?" : "Undo this application?"} onClose={() => { if (!busy) setConfirm(null); }} className="confirm-modal"><div className="confirm-body"><p>{confirm.kind === "delete" ? `“${confirm.job.title}” at ${confirm.job.company}, its notes, and its attached resume will be permanently deleted.` : "This clears the application date and moves the job back to Saved. Your resume and notes will stay attached."}</p><div className="confirm-buttons"><button className="btn" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button><button className={`btn ${confirm.kind === "delete" ? "danger" : "primary"}`} disabled={busy} onClick={confirmAction}>{busy && <LoaderCircle size={15} className="spin" />}{confirm.kind === "delete" ? "Delete job" : "Undo application"}</button></div></div></Modal>}
    {help && <Modal title="Find your flow" subtitle="A calmer way to manage your job search." onClose={() => setHelp(false)} className="help-modal"><div className="help-steps">{[{ icon: Plus, title: "Save a possibility", text: "Paste a job URL. We’ll look for duplicates in your workspace and suggest the company when we recognize it." }, { icon: FileText, title: "Make it personal", text: "Save the description, add notes and a deadline, and upload the resume you’ve tailored for this role." }, { icon: ArrowUpRight, title: "Make your move", text: "Apply opens the company’s website. Submit your application there, then come back and mark it as applied." }, { icon: Target, title: "Keep your next step in sight", text: "Update the status as things progress. Your application date stays recorded, and your deadlines stay in view." }].map((step, i) => <div key={step.title}><span><step.icon size={19} /></span><section><small>0{i + 1}</small><h3>{step.title}</h3><p>{step.text}</p></section></div>)}</div><footer className="help-footer"><button className="btn primary" onClick={() => { setHelp(false); setEditor("new"); }}>Save an opportunity <ArrowRight size={15} /></button></footer></Modal>}
    {notice && <div className={`toast ${notice.error ? "toast-error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.error ? <CircleHelp size={18} /> : <Check size={18} />}<span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={15} /></button></div>}
    {busy && <div className="saving-indicator" role="status"><LoaderCircle className="spin" size={14} />Saving...</div>}
  </div>;
}

function JobEditor({ job, jobs, onClose, onSaved }: { job: Job | null; jobs: Job[]; onClose: () => void; onSaved: (job: Job) => void }) {
  const [fields, setFields] = useState<JobFields>(() => job ? { url: job.url, company: job.company, title: job.title, location: job.location, workMode: job.workMode, salary: job.salary, deadline: job.deadline || "", description: job.description, notes: job.notes } : EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [detected, setDetected] = useState(false);
  const [companyTouched, setCompanyTouched] = useState(!!job);
  const [file, setFile] = useState<File | null>(null);
  const [created, setCreated] = useState<Job | null>(null);
  const [tab, setTab] = useState("details");
  const update = (key: keyof JobFields, value: string) => setFields((f) => ({ ...f, [key]: value }));
  function detectCompany() {
    if (companyTouched) return;
    const company = inferCompany(fields.url);
    if (company) { update("company", company); setDetected(true); }
  }
  let duplicate: Job | undefined;
  try { const canonical = normalizeJobUrl(fields.url); duplicate = jobs.find((j) => j.id !== job?.id && j.id !== created?.id && normalizeJobUrl(j.url) === canonical); } catch {}
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try { normalizeJobUrl(fields.url); } catch (e) { setTab("details"); setError((e as Error).message); return; }
    if (!fields.company.trim() || !fields.title.trim()) { setTab("details"); setError("Company and job title are required."); return; }
    if (fields.deadline && !isValidDate(fields.deadline)) { setTab("details"); setError("Choose a valid application deadline."); return; }
    if (duplicate) { setError("This job URL is already in your workspace."); return; }
    if (file && (file.size > MAX_RESUME_SIZE || !/\.(pdf|docx)$/i.test(file.name))) { setError("Choose a PDF or DOCX resume up to 10 MB."); return; }
    setSaving(true);
    let result: Job | null = created;
    try {
      const id = job?.id || created?.id;
      result = await request<Job>(id ? `/api/jobs/${id}` : "/api/jobs", { method: id ? "PATCH" : "POST", body: JSON.stringify({ ...fields, deadline: fields.deadline || null }) });
      setCreated(result);
      if (file) { const form = new FormData(); form.append("file", file); result = await request<Job>(`/api/jobs/${result.id}/resume`, { method: "POST", body: form }); }
      onSaved(result);
    } catch (e) { setError(`${result ? "Your job details are saved. " : ""}${(e as Error).message}`); } finally { setSaving(false); }
  }
  return <Modal title={job ? "Edit opportunity" : "Save a new opportunity"} subtitle={job ? "Keep the details up to date." : "One link. A whole new possibility."} onClose={() => { if (!saving) { if (created) onSaved(created); else onClose(); } }} className="editor-modal"><form noValidate onSubmit={save}><fieldset disabled={saving}><div className="editor-tabs"><button type="button" className={tab === "details" ? "active" : ""} onClick={() => setTab("details")}><BriefcaseBusiness size={15} />Job details</button><button type="button" className={tab === "description" ? "active" : ""} onClick={() => setTab("description")}><FileText size={15} />Description & notes</button></div><div className="editor-body"><div className={tab !== "details" ? "hidden-tab" : ""}><label className="field-label">Job posting URL <span>*</span><div className="input-with-icon"><ExternalLink size={16} /><input type="url" required maxLength={4000} value={fields.url} onChange={(e) => update("url", e.target.value)} onBlur={detectCompany} placeholder="https://company.com/careers/your-next-role" /></div></label>{duplicate && <p className="field-error">Already saved: {duplicate.title} at {duplicate.company}.</p>}<p className="field-hint">We’ll check this link against the jobs in your workspace.</p><div className="form-grid"><label className="field-label">Company <span>*</span><input required maxLength={200} value={fields.company} onChange={(e) => { update("company", e.target.value); setCompanyTouched(true); setDetected(false); }} placeholder="e.g. Linear" />{detected && <small className="detected"><Sparkles size={11} />Suggested from your link · editable</small>}</label><label className="field-label">Job title <span>*</span><input required maxLength={250} value={fields.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Frontend Engineer" /></label><label className="field-label">Location<input maxLength={250} value={fields.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. San Francisco, CA" /></label><label className="field-label">Work arrangement<select value={fields.workMode} onChange={(e) => update("workMode", e.target.value)}>{WORK_MODES.map((s) => <option key={s}>{s}</option>)}</select></label><label className="field-label">Salary range<input maxLength={150} value={fields.salary} onChange={(e) => update("salary", e.target.value)} placeholder="e.g. $100,000–$140,000 / year" /></label><label className="field-label">Application deadline<input type="date" value={fields.deadline} onChange={(e) => update("deadline", e.target.value)} /></label></div><label className="field-label resume-editor-label">Tailored resume <span className="optional">Optional</span></label><label className="upload-area"><Upload size={19} /><span>{file?.name || (job?.resumeName ? "Replace attached resume" : "Choose a resume for this role")}<small>PDF or DOCX · Up to 10 MB</small></span><input type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>{file && <button className="text-button clear-file" type="button" onClick={() => setFile(null)}>Clear selected file</button>}</div><div className={tab !== "description" ? "hidden-tab" : ""}><label className="field-label">Job description<textarea rows={10} maxLength={60000} value={fields.description} onChange={(e) => update("description", e.target.value)} placeholder="Paste the job description here. You’ll have a copy even if the posting disappears." /></label><label className="field-label">Your notes<textarea rows={5} maxLength={30000} value={fields.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Recruiter contacts, things to prepare, interview notes..." /></label></div>{error && <p className="form-error" role="alert">{error}</p>}</div><footer className="editor-footer"><span><LockKeyhole size={12} />Visible to you and the manager</span><div><button className="btn" type="button" onClick={() => { if (created) onSaved(created); else onClose(); }}>Cancel</button><button className="btn primary" type="submit" disabled={!!duplicate}>{saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}{saving ? "Saving..." : job || created ? "Save changes" : "Save opportunity"}</button></div></footer></fieldset></form></Modal>;
}
