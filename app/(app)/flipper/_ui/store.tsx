"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { E } from "@/lib/apps/flipper/engine";
import type { FlipperPerms, FlipperSyncPayload } from "@/lib/apps/flipper/server";
import { saveFlipper } from "../actions";

/**
 * Estado de Flipper en el navegador. Igual que la versión en la nube de OR-K Flipper:
 * todo el estado vive en memoria (S), cada cambio llama a commit() y los registros que
 * cambiaron se guardan en la base de datos 700 ms después.
 */
export type View = "dashboard" | "quoter" | "clients" | "catalog" | "quotes" | "scenarios" | "kpis" | "profit" | "team" | "settings";
export const VIEW_PATH: Record<View, string> = {
  dashboard: "/flipper", quoter: "/flipper/quoter", clients: "/flipper/clients", catalog: "/flipper/catalog", quotes: "/flipper/quotes",
  scenarios: "/flipper/scenarios", kpis: "/flipper/kpis", profit: "/flipper/profit", team: "/flipper/team", settings: "/flipper/settings",
};

type Modal = { id: number; title: string; body: () => ReactNode; footer?: (close: (r?: unknown) => void) => ReactNode; wide?: boolean; resolve?: (r: unknown) => void };
type Toast = { id: number; msg: string; kind: "" | "ok" | "err" };
export type SaveStatus = "ok" | "pending" | "saving" | "error";

export type Flipper = {
  S: any;
  ui: any;
  perms: FlipperPerms;
  /** Modo interno (no presentación): muestra notas privadas, ajustes de negociación e indicadores. */
  isInternal: boolean;
  /** Puede ver costos, márgenes, equipo y configuración. */
  isAdmin: boolean;
  status: SaveStatus;
  commit: () => void;
  rerender: () => void;
  go: (v: View, patch?: Record<string, unknown>) => void;
  setMode: (m: "internal" | "present") => void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  confirm: (title: string, body: ReactNode, opts?: { ok?: string; danger?: boolean; cancel?: string }) => Promise<boolean>;
  info: (title: string, body: ReactNode) => void;
  openModal: (m: Omit<Modal, "id">) => Promise<unknown>;
  closeModal: (r?: unknown) => void;
};

const Ctx = createContext<Flipper | null>(null);
export function useFlipper() {
  const f = useContext(Ctx);
  if (!f) throw new Error("useFlipper fuera de FlipperProvider");
  return f;
}

const MODE_KEY = "wz.flipper.mode";
/** Modo interno / presentación por navegador; `memMode` cubre el caso sin localStorage. */
let memMode: "internal" | "present" | null = null;
const modeListeners = new Set<() => void>();
function subscribeMode(l: () => void) { modeListeners.add(l); return () => { modeListeners.delete(l); }; }
function readMode(): "internal" | "present" {
  if (memMode) return memMode;
  try { return localStorage.getItem(MODE_KEY) === "present" ? "present" : "internal"; } catch { return "internal"; }
}
function writeMode(m: "internal" | "present") {
  memMode = m;
  try { localStorage.setItem(MODE_KEY, m); } catch {}
  modeListeners.forEach((l) => l());
}

/** Huella de lo guardado: permite enviar solo lo que cambió (como la versión en la nube). */
function snapshot(S: any, userId: string) {
  const pub = { ...S.settings };
  delete pub.team; delete pub.capProfiles;
  const notes: Record<string, string> = {};
  S.quotes.forEach((q: any) => { if (q.privateNotes) notes[q.id] = q.privateNotes; });
  if (S.draft?.privateNotes) notes[`__draft_${userId}`] = S.draft.privateNotes;
  const strip = (q: any) => { if (!q) return q; const c = E.clone(q); c.privateNotes = ""; return c; };
  return {
    settings: JSON.stringify({ settings: pub, catalog: S.catalog }),
    counters: JSON.stringify(S.counters),
    internal: JSON.stringify({ team: S.settings.team, capProfiles: S.settings.capProfiles, costs: S.costs, notes }),
    clients: Object.fromEntries(S.clients.map((c: any) => [c.id, JSON.stringify(c)])) as Record<string, string>,
    quotes: Object.fromEntries(S.quotes.map((q: any) => [q.id, JSON.stringify(strip(q))])) as Record<string, string>,
    draft: JSON.stringify(strip(S.draft)),
  };
}
type Snap = ReturnType<typeof snapshot>;

export function FlipperProvider({ initial, perms, userId, fresh, children }: { initial: any; perms: FlipperPerms; userId: string; fresh: boolean; children: ReactNode }) {
  const router = useRouter();
  // Objetos mutables y estables durante toda la visita (se crean una sola vez)
  const [S] = useState<any>(() => {
    const s = E.normalizeState(initial);
    delete s._migrated;
    // Usuarios sin acceso interno: no hay equipo ni costos en memoria
    if (!perms.internal) { s.settings.team = []; s.settings.capProfiles = {}; s.costs = {}; }
    return s;
  });
  const [ui] = useState<any>(() => ({ open: {}, open3: {}, step: 1, clientSearch: "", quoteSearch: "", quoteFilter: "all", distView: "capability", adminTab: "general", compare: [], compareGroup: null, profitQuoteId: null, clientId: null, capEditId: null }));
  const [firstSnap] = useState<Snap>(() => {
    // Organización sin configuración guardada: se sube el catálogo inicial en el primer guardado
    const snap = snapshot(S, userId);
    return { ...snap, settings: fresh ? "" : snap.settings, internal: initial.hasInternal ? snap.internal : "" };
  });
  const synced = useRef<Snap>(firstSnap);
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const mode = useSyncExternalStore(subscribeMode, readMode, () => "internal" as const);
  const [status, setStatus] = useState<SaveStatus>("ok");
  const [modals, setModals] = useState<Modal[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushing = useRef(false);
  const again = useRef(false);
  const seq = useRef(0);

  const toast = useCallback((msg: string, kind: Toast["kind"] = "") => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 5200 : 3000);
  }, []);

  const push = useCallback(async () => {
    if (pushing.current) { again.current = true; return; }
    pushing.current = true;
    setStatus("saving");
    const cur = snapshot(S, userId);
    const prev = synced.current!;
    const changed = (a: Record<string, string>, b: Record<string, string>) => Object.keys(a).filter((k) => a[k] !== b[k]);
    const p: FlipperSyncPayload = {};
    if (perms.internal && cur.settings !== prev.settings) p.settings = { ...JSON.parse(cur.settings), counters: S.counters };
    else if (cur.counters !== prev.counters) p.counters = S.counters;
    if (perms.internal && cur.internal !== prev.internal) p.internal = JSON.parse(cur.internal);
    if (perms.write) {
      const cc = changed(cur.clients, prev.clients); const cr = Object.keys(prev.clients).filter((id) => !(id in cur.clients));
      if (cc.length || cr.length) p.clients = { upsert: cc.map((id) => JSON.parse(cur.clients[id])), remove: cr };
      const qc = changed(cur.quotes, prev.quotes); const qr = Object.keys(prev.quotes).filter((id) => !(id in cur.quotes));
      if (qc.length || qr.length) p.quotes = { upsert: qc.map((id) => JSON.parse(cur.quotes[id])), remove: qr };
    }
    if (cur.draft !== prev.draft) p.draft = JSON.parse(cur.draft);
    try {
      if (Object.keys(p).length) {
        const r = await saveFlipper(p);
        if (r?.error) throw new Error(r.error);
      }
      synced.current = cur;
      setStatus("ok");
    } catch (e) {
      setStatus("error");
      toast(`No se pudo guardar: ${(e as Error).message}`, "err");
    } finally {
      pushing.current = false;
      if (again.current) { again.current = false; void push(); }
    }
  }, [S, perms, userId, toast]);

  const commit = useCallback(() => {
    tick();
    if (timer.current) clearTimeout(timer.current);
    setStatus("pending");
    timer.current = setTimeout(() => { void push(); }, 700);
  }, [push]);

  // Guarda lo pendiente antes de salir
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (timer.current && status !== "ok") { void push(); e.preventDefault(); } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [push, status]);

  const openModal = useCallback((m: Omit<Modal, "id">) => new Promise<unknown>((resolve) => {
    setModals((ms) => [...ms, { ...m, id: ++seq.current, resolve }]);
  }), []);
  const closeModal = useCallback((r?: unknown) => {
    setModals((ms) => {
      const last = ms[ms.length - 1];
      last?.resolve?.(r);
      return ms.slice(0, -1);
    });
  }, []);
  const confirm = useCallback((title: string, body: ReactNode, o: { ok?: string; danger?: boolean; cancel?: string } = {}) =>
    openModal({
      title, body: () => <div className="space-y-2 text-sm">{body}</div>,
      footer: (close) => (<>
        <button className="fl-btn" onClick={() => close(false)}>{o.cancel ?? "Cancelar"}</button>
        <button className={`fl-btn ${o.danger ? "danger" : "primary"}`} autoFocus onClick={() => close(true)}>{o.ok ?? "Confirmar"}</button>
      </>),
    }).then((r) => r === true), [openModal]);
  const info = useCallback((title: string, body: ReactNode) => {
    void openModal({ title, body: () => <div className="space-y-2 text-sm">{body}</div>, footer: (close) => <button className="fl-btn primary" autoFocus onClick={() => close()}>Entendido</button> });
  }, [openModal]);

  const go = useCallback((v: View, patch: Record<string, unknown> = {}) => {
    Object.assign(ui, patch);
    tick();
    router.push(VIEW_PATH[v]);
    window.scrollTo(0, 0);
  }, [router, ui]);

  const setMode = useCallback((m: "internal" | "present") => {
    writeMode(m);
    toast(m === "present" ? "Modo presentación: costos, márgenes y notas privadas ocultos en pantalla." : "Modo interno activo.");
  }, [toast]);

  const isInternal = mode !== "present";
  // Objeto nuevo en cada render: así cada commit() vuelve a pintar las vistas que leen S
  const value: Flipper = {
    S, ui, perms, isInternal, isAdmin: isInternal && perms.internal, status,
    commit, rerender: tick, go, setMode, toast, confirm, info, openModal, closeModal,
  };

  // Esc cierra el modal superior
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && modals.length) closeModal(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [modals.length, closeModal]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {modals.map((m) => (
        <div key={m.id} className="fl-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(false); }}>
          <div className={`fl-modal ${m.wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={m.title}>
            <div className="fl-modal-h">
              <h2>{m.title}</h2>
              <button className="fl-btn ghost icon" aria-label="Cerrar" onClick={() => closeModal(false)}>✕</button>
            </div>
            <div className="fl-modal-b">{m.body()}</div>
            {m.footer && <div className="fl-modal-f">{m.footer(closeModal)}</div>}
          </div>
        </div>
      ))}
      <div className="fl-toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`fl-toast ${t.kind}`}>{t.msg}</div>)}
      </div>
    </Ctx.Provider>
  );
}
