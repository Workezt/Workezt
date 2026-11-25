"use client";

import Link from "next/link";
import "./app-sections.css";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { SectionIcon } from "./section-icons";

type Item = { href: string; label: string };
type Tone = { light: string; base: string; dark: string };

/**
 * Barra de secciones de la app, bajo la barra superior: cada sección con su ícono
 * en un recuadro y el nombre debajo, con el color de la app. Si no caben, se desliza horizontalmente.
 */
export function AppSections({ items, tone }: { items: Item[]; tone: Tone }) {
  const path = usePathname();
  // Activa = la sección cuya ruta es el prefijo más largo de la ruta actual
  const active = items.filter((x) => path === x.href || path.startsWith(`${x.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label="Secciones de la app" className="app-sections border-t border-[var(--ork-rule)]" style={{ "--section-base": tone.base, "--section-dark": tone.dark } as CSSProperties}>
      <div className="mx-auto flex max-w-[1400px] gap-1.5 overflow-x-auto px-4 py-2 sm:px-6">
        {items.map((n) => {
          const on = n.href === active;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={on ? "page" : undefined}
              className="app-section group relative flex min-w-[88px] shrink-0 flex-col items-center gap-1.5 rounded-xl px-3 py-2 transition-colors"
            >
              <span
                className="app-section-icon grid h-10 w-10 place-items-center rounded-xl"
              >
                <SectionIcon label={n.label} size={22} />
              </span>
              <span className={`whitespace-nowrap text-xs leading-4 ${on ? "font-semibold" : "font-medium"}`}>{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
