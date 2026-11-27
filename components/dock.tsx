"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon } from "./app-icons";
import { currentApp, type LauncherApp } from "@/lib/launcher";
import { CATEGORIES, categoryByApp } from "@/lib/launcher-categories";

/** Accesos fijos al inicio y a las categorías del lanzador. */
export function Dock({ apps }: { apps: LauncherApp[] }) {
  const path = usePathname();
  const app = currentApp(apps, path);
  const appCategory = app ? (categoryByApp.get(app.key) ?? "administracion") : undefined;

  return (
    <nav className="wz-dock print:hidden" aria-label="Categorías de aplicaciones">
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
          {CATEGORIES.map((category) => {
            const href = `/aplicaciones/${category.key}`;
            const current = path === href ? "page" : appCategory === category.key ? "location" : undefined;
            return (
              <Link key={category.key} href={href} className={`wz-dock-item ${current ? "current" : ""}`} aria-label={category.name} aria-current={current}>
                <AppIcon name={category.icon} size={46} pack="area" palette={category.palette} />
                <span className="wz-dock-tip" aria-hidden="true">{category.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
