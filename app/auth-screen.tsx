"use client";
import { useState, type FormEvent } from "react";
import { Moon, Sun, ArrowRight, ShieldCheck } from "lucide-react";
export default function AuthScreen() {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const data = new FormData(event.currentTarget);
    const body = { email: data.get("email"), password: data.get("password"), ...(signup ? { name: data.get("name"), privacyAccepted: data.get("privacy") === "on" } : {}) };
    try {
      const response = await fetch("/api/auth/" + (signup ? "signup" : "login"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      if (!signup) { window.location.assign("/"); return; }
      setMessage(result.message);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function theme() {
    const mode = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = mode;
    try { localStorage.setItem("jobbid-theme", mode); } catch {}
  }
  return <main className="login-page"><div className="login-orbit" /><button className="icon-button auth-theme" onClick={theme} aria-label="Toggle light and dark theme"><Sun size={18} /><Moon size={18} /></button>
    <a className="brand login-brand" href="/"><span className="brand-mark">a.</span><span className="brand-title">All in one place<small>job support</small></span></a>
    <section className="login-card"><span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h1>Every opportunity.<br /><span>All in one place.</span></h1><p>A private workspace for your applications, tailored resumes, and next steps.</p>
      <div className="editor-tabs"><button className={!signup ? "active" : ""} onClick={() => { setSignup(false); setError(""); setMessage(""); }}>Sign in</button><button className={signup ? "active" : ""} onClick={() => { setSignup(true); setError(""); setMessage(""); }}>Request an account</button></div>
      <form className="auth-form" onSubmit={submit}>
        {signup && <label className="field-label">Your name<input name="name" autoComplete="name" required maxLength={100} /></label>}
        <label className="field-label">Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label className="field-label">Password<input name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 12 : 1} maxLength={128} required /></label>
        {signup && <><p className="field-hint">Use 12–128 characters. The manager must approve your account before you can sign in.</p><label className="privacy-consent"><input type="checkbox" name="privacy" required />I understand the manager can view my jobs, descriptions, notes, and resumes. Other ordinary users cannot access them. Deleting my account also deletes its stored application data.</label></>}
        {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="inline-note" role="status">{message}</p>}
        <button className="btn primary login-button" disabled={busy}>{busy ? "Please wait…" : signup ? "Request an account" : "Sign in"}<ArrowRight size={16} /></button>
      </form><p className="field-hint">{signup ? "Please use an email address you control." : "Forgot your password? Contact the manager for a password reset."}</p>
      <div className="login-trust"><ShieldCheck size={15} />Approval required · Private workspace</div>
    </section><footer className="login-footer">All in one place-job support</footer>
  </main>;
}

