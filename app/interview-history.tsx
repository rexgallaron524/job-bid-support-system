"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
type Interview = { id: string; label: string; notes: string; occurredAt: string };
export default function InterviewHistory({ jobId, readOnly = false, onChange }: { jobId: string; readOnly?: boolean; onChange?: () => void }) {
  const endpoint = (readOnly ? "/api/manager/jobs/" : "/api/jobs/") + jobId + "/interviews";
  const [records, setRecords] = useState<Interview[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false), [label, setLabel] = useState("Interview"), [notes, setNotes] = useState("");
  const [completedOn, setCompletedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [removing, setRemoving] = useState<string | null>(null);
  const requestId = useRef<string | undefined>(undefined);
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await fetch(endpoint, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load interviews."); setRecords(data); }
    catch (error) { setError((error as Error).message); } finally { setLoading(false); }
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      requestId.current ??= crypto.randomUUID();
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: requestId.current, label, notes, completedOn }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not record this interview.");
      requestId.current = undefined; setLabel("Interview"); setNotes(""); setShowForm(false); setMessage("Completed interview recorded."); await load(); onChange?.();
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError(""); setMessage("");
    try { const response = await fetch(endpoint + "/" + id, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not remove this interview."); setRemoving(null); await load(); onChange?.(); setMessage("Interview record removed from activity counts."); }
    catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  return <section className="interview-panel detail-section"><h3>Completed interviews</h3><p className="field-hint">Record each finished round with its actual completion date (UTC). This does not change the job’s application status.</p>
    {loading ? <p className="activity-note">Loading interviews…</p> : !records.length ? <p className="activity-note">No completed interviews logged.</p> : <div className="interview-list">{records.map(record => <article key={record.id}><div><strong>{record.label}</strong><time dateTime={record.occurredAt}>{record.occurredAt.slice(0, 10)} UTC</time>{record.notes && <p className="preserve-lines">{record.notes}</p>}</div>{!readOnly && <button className="icon-button danger-text" disabled={busy} aria-label={"Remove interview " + record.label} onClick={() => setRemoving(record.id)}><Trash2 size={15} /></button>}{removing === record.id && <div className="interview-remove"><p>Remove this interview record from the dashboard?</p><button className="btn" disabled={busy} onClick={() => setRemoving(null)}>Keep record</button><button className="btn danger" disabled={busy} onClick={() => void remove(record.id)}>Remove interview record</button></div>}</article>)}</div>}
    {!readOnly && !showForm && <button className="btn" onClick={() => { setShowForm(true); setError(""); setMessage(""); }}><Plus size={15} />Log completed interview</button>}
    {!readOnly && showForm && <form onSubmit={save} className="interview-form"><fieldset disabled={busy}><label className="field-label">Round or interview name<input aria-label="Interview round name" required maxLength={120} value={label} onChange={event => { setLabel(event.target.value); requestId.current = undefined; }} /></label><label className="field-label">Completion date (UTC)<input type="date" aria-label="Interview completion date" required max={new Date().toISOString().slice(0, 10)} value={completedOn} onChange={event => { setCompletedOn(event.target.value); requestId.current = undefined; }} /></label><label className="field-label">Interview notes<textarea aria-label="Interview notes" rows={3} maxLength={2000} value={notes} onChange={event => { setNotes(event.target.value); requestId.current = undefined; }} /></label><div className="manager-actions"><button className="btn primary" type="submit">{busy ? "Saving…" : "Save completed interview"}</button><button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button></div></fieldset></form>}
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="profile-save-message" role="status"><Check size={14} />{message}</p>}
  </section>;
}
