"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Eye, LoaderCircle, Moon, Sun, ShieldCheck, Trash2, Users } from "lucide-react";
import type { Job } from "@/lib/domain";
import SignOut from "./sign-out";
import ActivityDashboard from "./activity-dashboard";
import InterviewHistory from "./interview-history";
import { profileText, type ProfileResponse } from "@/lib/profile";
type Account = { id: string; email: string; name: string; role: string; status: string; createdAt: string; jobCount: number };
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not complete the request.");
  return result;
}
export default function ManagerDashboard({ initialTheme }: { initialTheme: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Account | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const requestId = useRef(0);
  const load = useCallback(async () => {
    setLoading(true);
    try { setAccounts(await request<Account[]>("/api/manager/users")); }
    catch (error) { setError((error as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { document.documentElement.dataset.theme = initialTheme; }, [initialTheme]);
  async function inspect(account: Account) {
    const id = ++requestId.current;
    setSelected(account); setShowActivity(false); setJob(null); setJobs([]); setProfile(null); setError(""); setLoading(true);
    try {
      const [result, career] = await Promise.all([
        request<Job[]>("/api/manager/jobs?userId=" + encodeURIComponent(account.id)),
        request<ProfileResponse>("/api/manager/profiles/" + encodeURIComponent(account.id)),
      ]);
      if (id === requestId.current) { setJobs(result); setProfile(career); }
    } catch (error) { if (id === requestId.current) setError((error as Error).message); }
    finally { if (id === requestId.current) setLoading(false); }
  }
  async function status(account: Account, value: string) {
    setBusy(true); setError("");
    try { await request("/api/manager/users/" + account.id, { method: "PATCH", body: JSON.stringify({ status: value }) }); await load(); if (selected?.id === account.id) setSelected({ ...account, status: value }); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true); setError("");
    try {
      await request("/api/manager/users/" + deleting.id, { method: "DELETE", body: JSON.stringify({ confirmationEmail: confirmation }) });
      if (selected?.id === deleting.id) { ++requestId.current; setSelected(null); setJobs([]); setJob(null); setProfile(null); }
      setDeleting(null); setConfirmation(""); await load();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  function toggleTheme() {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("jobbid-theme", theme); } catch {}
    void request("/api/preferences", { method: "PATCH", body: JSON.stringify({ theme }) }).catch(error => setError(error.message));
  }
  return <main className="manager-shell">
    <header className="manager-header"><a href="/" className="btn"><ArrowLeft size={15} />My workspace</a><div><button className="icon-button" onClick={toggleTheme} aria-label="Toggle theme"><Sun size={17} /><Moon size={17} /></button><SignOut /></div></header>
    <section className="page-heading"><div><span className="eyebrow"><ShieldCheck size={14} /> MANAGER WORKSPACE</span><h1>People & progress</h1><p>Approve account requests and view application data. Application records are read-only here.</p></div><button className="btn" disabled={busy || loading} onClick={load}>Refresh users</button></section>
    <div className="stat-grid manager-stats"><article className="stat-card"><span><Users size={16} /> Total accounts</span><strong>{accounts.length}</strong></article><article className="stat-card"><span>Waiting for approval</span><strong>{accounts.filter(a => a.status === "pending").length}</strong></article><article className="stat-card"><span>Approved accounts</span><strong>{accounts.filter(a => a.status === "approved").length}</strong></article></div>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {deleting && <section className="panel delete-account"><h2>Delete {deleting.name}’s account?</h2><p>This permanently deletes this user, their master profile, jobs, descriptions, notes, resume files, and sessions from the live database. Local exports and previous backups remain.</p><label className="field-label">Type {deleting.email} to confirm<input autoFocus value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><div className="manager-actions"><button className="btn" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button className="btn danger" disabled={busy || confirmation !== deleting.email} onClick={remove}><Trash2 size={15} />Delete user and all their data</button></div></section>}
    <div className="manager-grid"><section className="panel"><header className="panel-heading"><h2>Accounts</h2></header><div className="search-row"><input aria-label="Search accounts" placeholder="Search name or email" value={filter} onChange={e => setFilter(e.target.value)} /></div>
      <div className="account-list">{accounts.filter(a => (a.name + " " + a.email).toLowerCase().includes(filter.toLowerCase())).map(account => <article key={account.id} className={selected?.id === account.id ? "account-card chosen" : "account-card"}><div><strong>{account.name}</strong><small>{account.email}</small><small>{account.role} · {account.status} · {account.jobCount} jobs</small></div><div className="manager-actions"><button className="btn" disabled={busy} onClick={() => inspect(account)}><Eye size={14} />View process</button>{account.role !== "manager" && <><button className="btn" disabled={busy || account.status === "approved"} onClick={() => status(account, "approved")}><Check size={14} />Approve</button>{account.status === "pending" ? <button className="btn" disabled={busy} onClick={() => status(account, "rejected")}>Reject</button> : <button className="btn" disabled={busy || account.status === "suspended"} onClick={() => status(account, "suspended")}>Suspend</button>}<button className="icon-button danger-text" disabled={busy} onClick={() => { setDeleting(account); setConfirmation(""); }} aria-label={"Delete " + account.email}><Trash2 size={16} /></button></>}</div></article>)}</div></section>
      <section className="panel manager-process"><header className="panel-heading"><div><h2>{selected ? selected.name + "’s applications" : "Application processes"}</h2><p>{selected ? selected.email + " · Read-only" : "Select an account to view its saved jobs and progress."}</p></div></header>{loading ? <div className="loading-center"><LoaderCircle className="spin" /></div> : selected && !jobs.length ? <div className="empty-state"><h3>No saved applications</h3></div> : <div className="manager-job-list">{jobs.map(item => <button className={job?.id === item.id ? "manager-job chosen" : "manager-job"} key={item.id} onClick={() => setJob(item)}><span><strong>{item.title}</strong><small>{item.company} · {item.shortId}</small></span><span>{item.status}</span></button>)}</div>}
      {selected && !loading && <details className="manager-activity" open={showActivity} onToggle={event => setShowActivity(event.currentTarget.open)}><summary>Progress dashboard · Read-only</summary>{showActivity && <ActivityDashboard key={selected.id} jobs={jobs} today={new Date().toISOString().slice(0, 10)} ownerId={selected.id} onOpenJob={id => setJob(jobs.find(item => item.id === id) ?? null)} />}</details>}{selected && profile && !loading && <details className="manager-profile"><summary>Master profile · Read-only</summary>{profile.revision ? <p className="preserve-lines">{profileText(profile.profile)}</p> : <p>No master profile saved.</p>}</details>}{job && <article className="manager-detail"><h2>{job.title}</h2><p>{job.company} · {job.location || "Location not set"} · {job.workMode}</p><dl><dt>Opportunity ID</dt><dd>{job.shortId}</dd><dt>Status</dt><dd>{job.status}</dd><dt>Saved</dt><dd>{job.createdAt}</dd><dt>Last updated</dt><dd>{job.updatedAt}</dd><dt>Applied</dt><dd>{job.appliedAt || "Not applied"}</dd><dt>Deadline</dt><dd>{job.deadline || "None"}</dd><dt>Salary</dt><dd>{job.salary || "Not provided"}</dd></dl><a className="btn" href={job.url} target="_blank" rel="noopener noreferrer">View posting</a><InterviewHistory key={job.id} jobId={job.id} readOnly /><h3>Job description</h3><p className="preserve-lines">{job.description || "No description saved."}</p><h3>Notes</h3><p className="preserve-lines">{job.notes || "No notes saved."}</p><h3>Resume</h3>{job.resumeName ? <a className="btn" href={"/api/manager/jobs/" + job.id + "/resume"}>Download {job.resumeName}</a> : <p>No resume attached.</p>}</article>}</section></div>
  </main>;
}

