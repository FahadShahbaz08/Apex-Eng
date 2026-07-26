"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createEmptyERP, migrateERP } from "../lib/schema";

const ERPContext = createContext(null);

export function ERPProvider({ children }) {
  const [state, setState] = useState(createEmptyERP);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState("");
  const stateRef = useRef(state), versionRef = useRef(0), queueRef = useRef(Promise.resolve());

  const loadData = useCallback(async () => {
    const response = await fetch("/api/erp", { cache: "no-store" });
    if (!response.ok) throw new Error((await response.json()).error || "Unable to load ERP data.");
    const data = await response.json();
    const next = migrateERP(data.state);
    versionRef.current = data.version || 0; stateRef.current = next; setState(next); setSyncError("");
  }, []);

  useEffect(() => { (async () => {
    try { const response = await fetch("/api/auth/me", { cache: "no-store" }); if (response.ok) { const data = await response.json(); setUser(data.user); await loadData(); } }
    catch (error) { setSyncError(error.message); } finally { setReady(true); }
  })(); }, [loadData]);

  useEffect(() => { if (!user) return; const timer = setInterval(() => { if (!saving) loadData().catch(e => setSyncError(e.message)); }, 10000); return () => clearInterval(timer); }, [user, saving, loadData]);

  const saveSnapshot = (snapshot, permission) => {
    setSaving(true);
    queueRef.current = queueRef.current.then(async () => {
      const response = await fetch("/api/erp", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: snapshot, version: versionRef.current, permission }) });
      const data = await response.json();
      if (!response.ok) { if (response.status === 409) await loadData(); throw new Error(data.error || "Unable to save changes."); }
      versionRef.current = data.version; const next = migrateERP(data.state); stateRef.current = next; setState(next); setSyncError("");
    }).catch(error => setSyncError(error.message)).finally(() => setSaving(false));
  };

  const mutate = (operation, permission = "all") => {
    if (!user || (permission && !user.permissions?.includes("all") && !user.permissions?.includes(permission))) throw new Error("You do not have permission for this action.");
    const next = structuredClone(stateRef.current); next.__actor = { id: user.id || "environment-admin", name: user.name, username: user.username, role: user.role }; const result = operation(next); delete next.__actor;
    stateRef.current = next; setState(next); saveSnapshot(next, permission); return result;
  };
  const replace = (next) => mutate(s => Object.assign(s, migrateERP(next)), "all");
  const clear = () => { const empty = createEmptyERP(); mutate(s => { Object.keys(s).forEach(k => delete s[k]); Object.assign(s, empty); }, "all"); };
  const login = async (username, password) => { const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Login failed."); setUser(data.user); await loadData(); };
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); const empty = createEmptyERP(); stateRef.current = empty; setState(empty); };
  const can = permission => !!user && (user.permissions?.includes("all") || user.permissions?.includes(permission) || permission === "view");

  return <ERPContext.Provider value={{ state, mutate, replace, clear, ready, user, login, logout, can, saving, syncError }}>{children}</ERPContext.Provider>;
}

export const useERP = () => { const context = useContext(ERPContext); if (!context) throw new Error("useERP must be used inside ERPProvider"); return context; };
