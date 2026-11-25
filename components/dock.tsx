"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon } from "./app-icons";
import { useSavedAppOrder } from "./app-grid";
import { currentApp, type LauncherApp } from "@/lib/launcher";

/** Cuántas apps caben en el dock (además de Inicio). */
const MAX_APPS = 10;

/**
 * Dock inferior estilo macOS (tomado de OR-K Flipper): Inicio + apps del lanzador
 * en el mismo orden que el usuario dejó en la cuadrícula (máximo 10). Se agranda al pasar el mouse.
 */
export function Dock({ apps }: { apps: LauncherApp[] }) {
  const path = usePathname();
  const saved = useSavedAppOrder();
  const active = path === "/" ? null : currentApp(apps, path);
  const pos = new Map(saved.map((k, i) => [k, i]));
  const ordered = apps
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (pos.get(x.a.key) ?? saved.length + x.i) - (pos.get(y.a.key) ?? saved.length + y.i))
    .map(({ a }) => a);
  // Máximo 10 apps: las primeras del orden propio; si la app abierta no está entre ellas, se agrega al final
  const shown = ordered.slice(0, MAX_APPS);
  if (active && !shown.some((a) => a.key === active.key)) shown.push(active);

  return (
    <nav className="wz-dock print:hidden" aria-label="Aplicaciones">
      <div className="wz-dock-scroll">
        <div className="wz-dock-inner">
          <Link href="/" className={`wz-dock-item ${path === "/" ? "current" : ""}`} aria-label="Inicio" aria-current={path === "/" ? "page" : undefined}>
            <span className="wz-dock-home" style={{ background: "none", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- ícono estático de la app */}
              <img src="/brand/workezt-app-icon.png" alt="" width={46} height={46} style={{ width: "100%", height: "100%" }} />
            </span>
            <span className="wz-dock-tip">Inicio</span>
          </Link>
          <span className="wz-dock-sep" aria-hidden="true" />
          {shown.map((a) => {
            const cur = active?.key === a.key;
            return (
              <Link key={a.key} href={a.href} className={`wz-dock-item ${cur ? "current" : ""}`} aria-label={a.name} aria-current={cur ? "page" : undefined}>
                <AppIcon name={a.icon} size={46} />
                <span className="wz-dock-tip">{a.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
