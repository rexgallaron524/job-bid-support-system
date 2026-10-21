"use client";
import { useState, type FormEvent } from "react";
export default function PasswordForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      if (data.get("newPassword") !== data.get("repeat")) throw new Error("New passwords do not match.");
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.assign("/");
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }
  return <section className="panel settings-panel"><h2>Change password</h2><form className="auth-form" onSubmit={submit}><label className="field-label">Current password<input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password" /></label><label className="field-label">New password<input name="newPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label><label className="field-label">Repeat new password<input name="repeat" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label><p className="field-hint">Changing your password signs out every session.</p><button className="btn" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>{message && <p role="alert" className="form-error">{message}</p>}</form></section>;
}

