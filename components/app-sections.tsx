"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    <nav aria-label="Secciones de la app" className="border-t border-[var(--ork-rule)]">
      <div className="mx-auto flex max-w-[1400px] gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6">
        {items.map((n) => {
          const on = n.href === active;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={on ? "page" : undefined}
              className="group flex min-w-[84px] shrink-0 flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 transition hover:bg-black/5"
              style={on ? { background: `${tone.base}1f` } : undefined}
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-xl transition group-hover:scale-105"
                style={on
                  ? { color: "#fff", background: `linear-gradient(135deg, ${tone.light}, ${tone.dark})`, boxShadow: `0 6px 16px -6px ${tone.base}` }
                  : { color: tone.base, background: `${tone.base}1a` }}
              >
                <SectionIcon label={n.label} size={19} />
              </span>
              <span className={`whitespace-nowrap text-[11.5px] leading-tight ${on ? "font-semibold" : "text-stone-600"}`} style={on ? { color: tone.base } : undefined}>{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
