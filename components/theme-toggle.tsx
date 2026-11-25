"use client";

import { useSyncExternalStore } from "react";

/**
 * Modo claro / oscuro / automático de cada usuario (se guarda en este navegador).
 * El script MODE_SCRIPT del layout raíz lo aplica antes de pintar para evitar el destello blanco.
 */
export type Mode = "light" | "dark" | "system";
export const MODE_KEY = "wz.mode";

const listeners = new Set<() => void>();
let mem: Mode | null = null;
function read(): Mode {
  if (mem) return mem;
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "dark" || v === "light" ? v : "system";
  } catch {
    return "system";
  }
}
function subscribe(l: () => void) {
  listeners.add(l);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSys = () => { if (read() === "system") apply("system"); };
  mq.addEventListener("change", onSys);
  return () => { listeners.delete(l); mq.removeEventListener("change", onSys); };
}
function apply(m: Mode) {
  const dark = m === "dark" || (m === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.mode = dark ? "dark" : "light";
}
function setMode(m: Mode) {
  mem = m;
  try { localStorage.setItem(MODE_KEY, m); } catch {}
  apply(m);
  listeners.forEach((l) => l());
}

const NEXT: Record<Mode, Mode> = { light: "dark", dark: "system", system: "light" };
const LABEL: Record<Mode, string> = { light: "Modo claro", dark: "Modo oscuro", system: "Automático (según el sistema)" };

export function ThemeToggle({ className = "grid h-9 w-9 place-items-center rounded-lg text-stone-600 hover:bg-black/5" }: { className?: string }) {
  const mode = useSyncExternalStore(subscribe, read, () => "system" as Mode);
  return (
    <button type="button" onClick={() => setMode(NEXT[mode])} className={className}
      title={`${LABEL[mode]} · clic para cambiar`} aria-label={`Tema: ${LABEL[mode]}. Cambiar`}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {mode === "light" && <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>}
        {mode === "dark" && <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />}
        {mode === "system" && <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /><path d="M12 6.5v7a3.5 3.5 0 0 0 0-7z" fill="currentColor" /></>}
      </svg>
    </button>
  );
}
