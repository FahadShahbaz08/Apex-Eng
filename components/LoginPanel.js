"use client";

import { useState } from "react";
import { useERP } from "./ERPContext";
import { Button } from "./UI";

export default function LoginPanel() {
  const { login, syncError } = useERP(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async e => { e.preventDefault(); setBusy(true); setError(""); const form = new FormData(e.currentTarget); try { await login(form.get("username"), form.get("password")); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <main className="login-page"><section className="login-card"><div className="brand login-brand"><span>AE</span><div><strong>APEX</strong><small>ENGINEERING ERP</small></div></div><p className="eyebrow">SECURE WORKSPACE</p><h1>Sign in</h1><p>Use the credentials assigned by your administrator.</p><form onSubmit={submit}><label className="field"><span>Username</span><input name="username" autoComplete="username" defaultValue="admin" required autoFocus /></label><label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required /></label>{(error || syncError) && <div className="form-error">{error || syncError}</div>}<Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button></form><small className="login-help">Initial administrator credentials are configured through server environment variables.</small></section></main>;
}
