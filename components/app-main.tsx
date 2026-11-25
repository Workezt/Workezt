"use client";

import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { FAMILIES, familyOf } from "./app-icons";
import { currentApp, type LauncherApp } from "@/lib/launcher";

/**
 * Contenido de la página con el color de la app en la que se está: botones principales,
 * enlaces y resaltados toman el tono del ícono (Industria verde azulado, Administración azul…).
 * En el inicio se conserva el color de la organización.
 */
export function AppMain({ apps, children }: { apps: LauncherApp[]; children: ReactNode }) {
  const path = usePathname();
  const app = path === "/" ? null : currentApp(apps, path);
  const t = app ? FAMILIES[familyOf(app.icon)] : null;
  const style = t
    ? ({ "--brand": t.dark, "--ork-purple": t.dark, "--ork-violet": t.base, "--ork-lavender": t.light } as CSSProperties)
    : undefined;
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-32 pt-6 sm:px-6" style={style}>
      {children}
    </main>
  );
}
