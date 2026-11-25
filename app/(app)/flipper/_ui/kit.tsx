"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type CSSProperties, type ReactNode } from "react";
import { E } from "@/lib/apps/flipper/engine";

/** Piezas de interfaz de Flipper (íconos lineales, botones, pasos, barras de capacidad e inputs). */

const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.5 3 5.2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  file: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M8.5 13h7M8.5 17h5" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  compare: <path d="M8 3v18M16 3v18M3 8h5M16 16h5M3 16h5M16 8h5" />,
  pie: <><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3" />,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  print: <><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" /><rect x="6" y="14" width="12" height="7" rx="1" /></>,
  download: <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 17v3h16v-3" />,
  upload: <path d="M12 15V3m0 0 4.5 4.5M12 3 7.5 7.5M4 17v3h16v-3" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17.5v.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  arrowR: <path d="M5 12h14m-5-5 5 5-5 5" />,
  arrowL: <path d="M19 12H5m5-5-5 5 5 5" />,
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  pen: <><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z" /><circle cx="11" cy="11" r="2" /></>,
  chat: <path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6A8 8 0 1 1 21 12z" />,
  chart: <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 6-7" /></>,
  box: <><path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9z" /><path d="M12 12 3.5 7.5M12 12l8.5-4.5M12 12v9" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  calc: <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M8.5 7h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15v2.5M8.5 18h.01M12 18h.01" /></>,
  team: <><circle cx="8" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.5" /><path d="M2.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M13.5 14.6c.9-.6 1.9-.9 3-.9 2.3 0 4.1 1.5 4.6 4.3" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="17" r="2" /></>,
  chevDown: <path d="m6 9 6 6 6-6" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
};

export function Ic({ n, size = 16, className = "", style }: { n: string; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>
      {PATHS[n]}
    </svg>
  );
}

export const money = (v: number) => E.fmtCOP(v);
export const fmtNum = (v: number) => E.fmtNum(v);
export const fmtPct = (bp: number) => (E.int(bp) / 100).toLocaleString("es-CO", { maximumFractionDigits: 2 }) + "%";
export const parseMoney = (v: unknown) => E.nonNeg(String(v ?? "").replace(/[^\d]/g, ""));
export const parseIntSafe = (v: unknown) => E.nonNeg(String(v ?? "").replace(/[^\d]/g, ""));
export const parsePct = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };
export const pctText = (v: unknown) => String(v ?? 0).replace(".", ",");
export const initials = (s: string) => String(s || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
export const brandName = (q: any, id: string) => (q.client?.brands.find((b: any) => b.id === id) || {}).name || "—";

type BtnProps = { children?: ReactNode; onClick?: () => void; kind?: "" | "primary" | "danger" | "ghost"; size?: "" | "sm" | "xs"; icon?: string; title?: string; disabled?: boolean; className?: string; style?: CSSProperties };
export function Btn({ children, onClick, kind = "", size = "", icon, title, disabled, className = "", style }: BtnProps) {
  return (
    <button type="button" className={`fl-btn ${kind} ${size} ${!children ? "icon" : ""} ${className}`} onClick={onClick} title={title} aria-label={!children ? title : undefined} disabled={disabled} style={style}>
      {icon && <Ic n={icon} size={size === "xs" ? 13 : 15} />}{children}
    </button>
  );
}

export function Stepper({ value, onMinus, onPlus, min = 0, max = Infinity, sm = false, plusTitle }: { value: number; onMinus: () => void; onPlus: () => void; min?: number; max?: number; sm?: boolean; plusTitle?: string }) {
  return (
    <span className={`fl-stepper ${sm ? "sm" : ""}`}>
      <button type="button" onClick={onMinus} disabled={value <= min} aria-label="Restar">−</button>
      <span>{value}</span>
      <button type="button" onClick={onPlus} disabled={value >= max} aria-label="Sumar" title={plusTitle}>+</button>
    </span>
  );
}

function restText(rest: number) {
  return <b style={{ color: rest < 0 ? "var(--fl-err)" : rest === 0 ? "var(--fl-ok)" : "inherit" }}>{rest < 0 ? `exceso ${fmtNum(-rest)}` : `disponible ${fmtNum(rest)}`}</b>;
}
export function Progress({ used, cap, label, unit = "" }: { used: number; cap: number; label: string; unit?: string }) {
  const pct = cap > 0 ? Math.min(100, Math.round((used * 100) / cap)) : used > 0 ? 100 : 0;
  const cls = used > cap ? "over" : used === cap && cap > 0 ? "full" : "";
  return (
    <div className="fl-res">
      <div className="flex justify-between gap-2 text-xs"><span className="font-medium text-stone-600">{label}</span><span className="tabular-nums">{fmtNum(used)} / {fmtNum(cap)}{unit ? ` ${unit}` : ""} · {restText(cap - used)}</span></div>
      <div className={`fl-bar ${cls}`}><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
export function Progress2({ appr, resv, cap, label }: { appr: number; resv: number; cap: number; label: string }) {
  const used = appr + resv;
  const pa = cap > 0 ? Math.min(100, (appr * 100) / cap) : 0;
  const pr = cap > 0 ? Math.min(100 - pa, (resv * 100) / cap) : 0;
  return (
    <div className="fl-res">
      <div className="flex justify-between gap-2 text-xs"><span className="font-medium text-stone-600">{label}</span><span className="tabular-nums">{fmtNum(used)} / {fmtNum(cap)} · {restText(cap - used)}</span></div>
      <div className={`fl-bar two ${used > cap ? "over" : ""}`}><i className="a" style={{ width: `${pa}%` }} /><i className="r" style={{ width: `${pr}%` }} /></div>
    </div>
  );
}

const ST_TONE: Record<string, string> = { Borrador: "", Presentada: "v", Aprobada: "ok", Rechazada: "err", Vencida: "warn" };
export const StatusBadge = ({ st }: { st: string }) => <span className={`fl-badge ${ST_TONE[st] ?? ""}`}>{st}</span>;
export const Badge = ({ children, tone = "", style }: { children: ReactNode; tone?: "" | "v" | "b" | "ok" | "warn" | "err"; style?: CSSProperties }) => <span className={`fl-badge ${tone}`} style={style}>{children}</span>;

export function Alert({ kind, children, icon, action }: { kind: "err" | "warn" | "ok" | "info"; children: ReactNode; icon?: string; action?: ReactNode }) {
  return (
    <div className={`fl-alert ${kind}`}>
      <Ic n={icon ?? (kind === "err" ? "alert" : kind === "ok" ? "check" : "info")} size={17} className="mt-0.5 shrink-0" />
      <div className="min-w-0 grow">{children}</div>
      {action}
    </div>
  );
}

export function MarginBadge({ bp, status }: { bp: number; status: "below" | "within" | "above" }) {
  const m = { below: ["err", "Inferior al objetivo"], within: ["ok", "Dentro del objetivo"], above: ["b", "Superior al objetivo"] }[status] as ["err" | "ok" | "b", string];
  return <span className={`fl-badge ${m[0]}`} title={m[1]}>{fmtPct(bp)} · {m[1]}</span>;
}

export function Card({ children, className = "", style, tight }: { children: ReactNode; className?: string; style?: CSSProperties; tight?: boolean }) {
  return <div className={`fl-card ${tight ? "tight" : ""} ${className}`} style={style}>{children}</div>;
}
export function CardHead({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-[15px] font-semibold text-[var(--ork-ink)]">{title}</h3>{sub && <p className="mt-0.5 text-xs text-stone-500">{sub}</p>}</div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
export function PageHead({ title, sub, kicker, children }: { title: ReactNode; sub?: ReactNode; kicker?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && <div className="fl-upper mb-1 flex items-center gap-1.5">{kicker}</div>}
        <h1 className="font-display text-2xl font-semibold text-[var(--ork-ink)]">{title}</h1>
        {sub && <p className="mt-1 max-w-3xl text-sm text-stone-500">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
export const Internal = () => (<><Ic n="lock" size={12} /> Uso interno</>);

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, ReactNode][]; onChange: (v: T) => void }) {
  return (
    <div className="fl-seg">
      {options.map(([v, l]) => <button key={v} type="button" className={value === v ? "on" : ""} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

/* ---------- inputs que confirman al salir del campo (como los «change» del original) ---------- */
type InProps = { value: string | number; onCommit: (v: string) => void; className?: string; placeholder?: string; type?: string; style?: CSSProperties; id?: string; disabled?: boolean; inputMode?: "numeric" | "decimal" | "text"; onEnter?: (v: string) => void; ariaLabel?: string };
export function TextIn({ value, onCommit, className = "", placeholder, type = "text", style, id, disabled, inputMode, onEnter, ariaLabel }: InProps) {
  const [v, setV] = useState(String(value ?? ""));
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); setV(String(value ?? "")); }
  const fire = () => { if (v !== String(value ?? "")) onCommit(v); };
  return (
    <input id={id} className={`fl-in ${className}`} value={v} placeholder={placeholder} type={type} style={style} disabled={disabled} inputMode={inputMode} aria-label={ariaLabel}
      onChange={(e) => setV(e.target.value)} onBlur={fire}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (onEnter) onEnter(v); else (e.target as HTMLInputElement).blur(); } }} />
  );
}
export function AreaIn({ value, onCommit, className = "", style, placeholder }: { value: string; onCommit: (v: string) => void; className?: string; style?: CSSProperties; placeholder?: string }) {
  const [v, setV] = useState(value ?? "");
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); setV(value ?? ""); }
  return <textarea className={`fl-in ${className}`} style={style} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onCommit(v); }} />;
}
export function MoneyIn({ value, onCommit, className = "", style, placeholder, ariaLabel }: { value: number | null; onCommit: (v: string) => void; className?: string; style?: CSSProperties; placeholder?: string; ariaLabel?: string }) {
  const shown = value === null || value === undefined ? "" : fmtNum(value);
  return <TextIn value={shown} onCommit={onCommit} className={`num ${className}`} style={style} inputMode="numeric" placeholder={placeholder} ariaLabel={ariaLabel} />;
}
export function Sel({ value, onChange, options, className = "", style, disabled, ariaLabel }: { value: string; onChange: (v: string) => void; options: (string | [string, string])[]; className?: string; style?: CSSProperties; disabled?: boolean; ariaLabel?: string }) {
  return (
    <select className={`fl-in ${className}`} value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={style} disabled={disabled} aria-label={ariaLabel}>
      {options.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{t}</option>; })}
    </select>
  );
}
export function FieldL({ label, hint, children, className = "" }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-stone-400">{hint}</span>}
    </label>
  );
}

/** Ícono tipo app de Flipper (degradado de dos colores, como en el original). */
export function AppTile({ icon, g, size = 64, badge }: { icon: string; g: [string, string]; size?: number; badge?: string }) {
  return (
    <span className="fl-appicon" style={{ width: size, height: size, borderRadius: size * 0.26, ["--g1" as string]: g[0], ["--g2" as string]: g[1] } as CSSProperties}>
      <Ic n={icon} size={size * 0.5} />
      {badge && <span className="fl-appbadge">{badge}</span>}
    </span>
  );
}

/** Igualdad profunda sin importar el orden de las claves (Postgres jsonb reordena las claves al guardar). */
export function sameJson(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown => Array.isArray(v) ? v.map(norm) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])])) : v;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}
