"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowDownToLine, Check, LoaderCircle, Save, UserRound } from "lucide-react";
import { EMPTY_PROFILE, PROFILE_SECTIONS, profileText, type CareerProfile, type ProfileResponse } from "@/lib/profile";

const CONTACT_FIELDS = [
  { key: "fullName", label: "Full name", max: 150, type: "text" },
  { key: "headline", label: "Professional headline", max: 300, type: "text" },
  { key: "location", label: "Location", max: 250, type: "text" },
  { key: "contactEmail", label: "Resume contact email", max: 254, type: "email" },
  { key: "phone", label: "Phone", max: 100, type: "tel" },
  { key: "linkedInUrl", label: "LinkedIn URL", max: 2000, type: "url" },
  { key: "websiteUrl", label: "Portfolio or website URL", max: 2000, type: "url" },
] as const;

export default function ProfilePage({ name, email, onDirtyChange }: { name: string; email: string; onDirtyChange: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState<CareerProfile>(EMPTY_PROFILE);
  const [baseline, setBaseline] = useState(JSON.stringify(EMPTY_PROFILE));
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = !loading && !loadError && JSON.stringify(draft) !== baseline;
  const completed = PROFILE_SECTIONS.filter(section => draft[section.key].trim()).length;

  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load your profile.");
      const saved = result as ProfileResponse;
      const value = saved.revision ? saved.profile : { ...EMPTY_PROFILE, fullName: name, contactEmail: email };
      setDraft(value); setBaseline(JSON.stringify(value)); setRevision(saved.revision); setUpdatedAt(saved.updatedAt);
    } catch (error) { setLoadError((error as Error).message || "Could not load your profile."); }
    finally { setLoading(false); }
  }, [name, email]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function edit(key: keyof CareerProfile, value: string) {
    setDraft(prior => ({ ...prior, [key]: value })); setMessage(""); setError("");
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: draft, revision }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your profile.");
      const saved = result as ProfileResponse;
      setDraft(saved.profile); setBaseline(JSON.stringify(saved.profile)); setRevision(saved.revision); setUpdatedAt(saved.updatedAt);
      setMessage("Your master profile is saved.");
    } catch (error) { setError((error as Error).message || "Could not save your profile."); }
    finally { setBusy(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([profileText(draft)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "profile.txt";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (loading) return <div className="loading-center"><LoaderCircle className="spin" aria-label="Loading profile" /></div>;
  if (loadError) return <div className="error-banner" role="alert"><span>{loadError}</span><button className="btn" onClick={load}>Retry profile</button></div>;
  return <form className="master-profile" onSubmit={save}>
    <section className="panel profile-intro">
      <span className="stat-icon purple"><UserRound size={22} /></span>
      <div><h2>Career profile</h2><p>Your profile is visible to you and the manager. Your resume contact email can differ from your sign-in email.</p><p className="profile-state" aria-live="polite">{dirty ? "Unsaved changes — save your profile to keep your edits." : revision ? "All changes saved" : "Ready for your first save"}</p><small>{completed} of {PROFILE_SECTIONS.length} career sections filled</small></div>
      <button className="btn" type="button" disabled={!revision || dirty || busy} onClick={download}><ArrowDownToLine size={15} />Download profile TXT</button>
    </section>
    <nav id="profile-sections" className="profile-section-links" aria-label="Profile sections"><a href="#profile-basics">Contact & headline</a>{PROFILE_SECTIONS.map(section => <a key={section.key} href={"#profile-" + section.key}>{section.label}</a>)}</nav>
    <fieldset disabled={busy} className="profile-fields">
      <section className="panel profile-section" id="profile-basics"><header><h2>Contact & headline</h2><p>The details you want employers to see on your resume.</p></header><div className="form-grid">{CONTACT_FIELDS.map(field => <label key={field.key} className="field-label">{field.label}<input type={field.type} maxLength={field.max} value={draft[field.key]} onChange={event => edit(field.key, event.target.value)} /></label>)}</div></section>
      {PROFILE_SECTIONS.map(section => <section className="panel profile-section" id={"profile-" + section.key} key={section.key}><header><h2>{section.label}</h2><a className="profile-back-link" href="#profile-sections">Back to sections</a><p id={"hint-" + section.key}>{section.hint}</p></header><label className="field-label"><span className="sr-only">{section.label}</span><textarea aria-label={section.label} aria-describedby={"hint-" + section.key} rows={section.key === "experience" ? 12 : 6} maxLength={section.max} placeholder={section.placeholder} value={draft[section.key]} onChange={event => edit(section.key, event.target.value)} /></label></section>)}
    </fieldset>
    <section className="panel profile-workflow"><h2>Use this profile for a job application</h2><p>Save your profile and download <strong>profile.txt</strong>. Open an opportunity and export its <strong>jd.txt</strong>. Use both files in your local Codex workspace to prepare a tailored resume, then upload the final PDF or DOCX to that opportunity.</p><p>Downloading the profile includes every saved section. Review the content before sharing it.</p></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="profile-save-message" role="status"><Check size={15} />{message}</p>}
    <footer className="panel profile-save-bar" data-sticky={dirty || !revision}><div><strong>{dirty ? "Unsaved changes" : revision ? "All changes saved" : "Ready for your first save"}</strong><small>{updatedAt ? "Last saved: " + new Date(updatedAt).toLocaleString() : "Save your details to keep them in your account."}{dirty ? " Save before downloading your profile." : ""}</small></div><button className="btn primary" type="submit" disabled={busy || (!dirty && revision > 0)}>{busy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{busy ? "Saving…" : "Save profile"}</button></footer>
  </form>;
}
