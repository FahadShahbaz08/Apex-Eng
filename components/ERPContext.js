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
  const [connection, setConnection] = useState("checking");
  const stateRef = useRef(state), lastSyncedRef = useRef(state), versionRef = useRef(0), queueRef = useRef(Promise.resolve()), onlineRef = useRef(true);

  const setConnectionState = useCallback(next => { onlineRef.current = next === "online"; setConnection(next); }, []);
  const checkConnectivity = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) { setConnectionState("offline"); return false; }
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(`/api/health?t=${Date.now()}`, { cache: "no-store", signal: controller.signal });
      const online = response.ok;
      setConnectionState(online ? "online" : "offline");
      return online;
    } catch {
      setConnectionState("offline");
      return false;
    } finally { clearTimeout(timeout); }
  }, [setConnectionState]);

  const loadData = useCallback(async () => {
    const response = await fetch("/api/erp", { cache: "no-store" });
    if (!response.ok) throw new Error((await response.json()).error || "Unable to load ERP data.");
    const data = await response.json();
    const next = migrateERP(data.state);
    versionRef.current = data.version || 0; stateRef.current = next; lastSyncedRef.current = structuredClone(next); setState(next); setSyncError(""); setConnectionState("online");
  }, [setConnectionState]);

  useEffect(() => {
    const run = () => checkConnectivity();
    run(); const timer = setInterval(run, 5000);
    const offline = () => setConnectionState("offline"), online = () => run();
    window.addEventListener("offline", offline); window.addEventListener("online", online);
    return () => { clearInterval(timer); window.removeEventListener("offline", offline); window.removeEventListener("online", online); };
  }, [checkConnectivity, setConnectionState]);

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
      if (!response.ok) {
        if (response.status === 409) { await loadData(); setSyncError(data.error || "The latest server data was loaded. Please repeat your action."); return; }
        throw new Error(data.error || "Unable to save changes.");
      }
      versionRef.current = data.version; const next = migrateERP(data.state); stateRef.current = next; lastSyncedRef.current = structuredClone(next); setState(next); setSyncError(""); setConnectionState("online");
    }).catch(error => {
      const rollback = structuredClone(lastSyncedRef.current); stateRef.current = rollback; setState(rollback);
      setSyncError(`${error.message} Your unsaved action was rolled back safely.`); setConnectionState("offline");
    }).finally(() => setSaving(false));
  };

  const mutate = (operation, permission = "all") => {
    if (!onlineRef.current) throw new Error("Internet or database connection is unavailable. Wait for reconnection before making changes.");
    if (!user || (permission && !user.permissions?.includes("all") && !user.permissions?.includes(permission))) throw new Error("You do not have permission for this action.");
    const next = structuredClone(stateRef.current); next.__actor = { id: user.id || "environment-admin", name: user.name, username: user.username, role: user.role }; const result = operation(next); delete next.__actor;
    stateRef.current = next; setState(next); saveSnapshot(next, permission); return result;
  };
  const replace = (next) => mutate(s => Object.assign(s, migrateERP(next)), "all");
  const clear = () => { const empty = createEmptyERP(); mutate(s => { Object.keys(s).forEach(k => delete s[k]); Object.assign(s, empty); }, "all"); };
  const login = async (username, password) => { const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Login failed."); setUser(data.user); await loadData(); };
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); const empty = createEmptyERP(); stateRef.current = empty; setState(empty); };
  const can = permission => !!user && (user.permissions?.includes("all") || user.permissions?.includes(permission) || permission === "view");

  return <ERPContext.Provider value={{ state, mutate, replace, clear, ready, user, login, logout, can, saving, syncError, connection, checkConnectivity }}>{children}{connection === "offline" && <div className="offline-guard" role="alertdialog" aria-modal="true" aria-labelledby="offline-title"><div><span>!</span><p className="eyebrow">CONNECTION SAFETY LOCK</p><h1 id="offline-title">No internet or database connection</h1><p>Editing and posting are temporarily blocked so offline changes cannot be lost or overwrite confirmed MongoDB data.</p><small>Keep this page open. The ERP checks the connection automatically every five seconds.</small><button type="button" onClick={checkConnectivity}>Check connection now</button></div></div>}</ERPContext.Provider>;
}

export const useERP = () => { const context = useContext(ERPContext); if (!context) throw new Error("useERP must be used inside ERPProvider"); return context; };
