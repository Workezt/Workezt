"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { AppIcon } from "./app-icons";
import { ThemeToggle } from "./theme-toggle";
import { WorkeztLogo, WorkeztMark } from "./workezt-logo";
import { currentApp, type LauncherApp } from "@/lib/launcher";
import { switchOrganization } from "@/app/(app)/shell-actions";
import { logout } from "@/app/login/actions";

type Props = {
  apps: LauncherApp[];
  org: { id: string; name: string; color: string; logoUrl?: string };
  memberships: { orgId: string; orgName: string; roleName: string }[];
  user: { name: string; email: string; role: string; isPlatformAdmin: boolean };
  unread: number;
  pendingApprovals: number;
};

/** Botón de acción rápida de la barra superior (tema, aprobaciones, notificaciones). */
const QUICK = "relative grid h-8 w-8 place-items-center rounded-full text-stone-600 transition hover:bg-[var(--ork-violet)]/10 hover:text-[var(--ork-violet)] focus-visible:outline-2 focus-visible:outline-[var(--ork-violet)]";
const BADGE = "absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--ork-pink)] px-1 text-[9.5px] font-bold leading-none text-white ring-2 ring-[var(--ork-paper-light)]";

export function TopBar({ apps, org, memberships, user, unread, pendingApprovals }: Props) {
  const path = usePathname();
  const app = currentApp(apps, path);
  const formRef = useRef<HTMLFormElement>(null);
  const home = path === "/";

  return (
    <header className="sticky top-0 z-20 print:hidden border-b border-[var(--ork-rule)] bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2 sm:px-6">
        <Link href="/" aria-label="Inicio · todas las apps" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--ork-purple)] hover:bg-black/5">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
            {[2, 8, 14].flatMap((y) => [2, 8, 14].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" rx="1" />))}
          </svg>
        </Link>

        {home || !app ? (
          <Link href="/" className="flex items-center">
            <WorkeztLogo size={22} byOrk />
          </Link>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/" aria-label="Workezt · inicio" className="hidden shrink-0 sm:block"><WorkeztMark size={18} /></Link>
            <span className="hidden text-stone-300 sm:inline">/</span>
            <Link href={app.href} className="flex shrink-0 items-center gap-2">
              <AppIcon name={app.icon} size={26} />
              <span className="font-display text-[17px] font-semibold text-[var(--ork-ink)]">{app.name}</span>
            </Link>
            {app.nav.length > 0 && (
              <nav className="ml-3 hidden items-center gap-0.5 overflow-x-auto [scrollbar-width:none] md:flex">
                {app.nav.map((n) => {
                  // Activo = el ítem cuya ruta es el prefijo más largo de la ruta actual
                  const best = app.nav.filter((x) => path === x.href || path.startsWith(`${x.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
                  const active = best?.href === n.href;
                  return (
                    <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${active ? "bg-[var(--ork-violet)]/10 font-medium text-[var(--ork-purple)]" : "text-stone-600 hover:bg-black/5"}`}>
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        )}

        <form action="/search" className={`hidden w-full lg:block ${home || !app ? "mx-auto max-w-md" : "ml-auto max-w-[220px] xl:max-w-xs"}`}>
          <label className="relative block">
            <span className="sr-only">Buscar en Workezt</span>
            <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <input name="q" placeholder="Buscar en Workezt…" className="w-full rounded-full border border-[var(--ork-violet)]/15 bg-[var(--ork-violet)]/[0.04] py-2 pl-10 pr-4 text-sm outline-none placeholder:text-stone-400 focus:border-[var(--ork-violet)]/50 focus:bg-white" />
          </label>
        </form>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          {/* Acciones rápidas: mismo estilo lineal, agrupadas en una píldora */}
          <div className="flex items-center gap-0.5 rounded-full border border-[var(--ork-rule)] bg-white/70 p-1 shadow-sm">
            <ThemeToggle className={QUICK} />
            <Link href="/approvals" title={pendingApprovals ? `Aprobaciones · ${pendingApprovals} pendiente(s)` : "Aprobaciones"} aria-label="Aprobaciones" className={QUICK}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l7 3v5c0 4.6-3 8.2-7 10-4-1.8-7-5.4-7-10V6z" /><path d="m8.8 12 2.2 2.2 4.4-4.6" />
              </svg>
              {pendingApprovals > 0 && <span className={BADGE}>{pendingApprovals > 99 ? "99+" : pendingApprovals}</span>}
            </Link>
            <Link href="/notifications" title={unread ? `Notificaciones · ${unread} sin leer` : "Notificaciones"} aria-label="Notificaciones" className={QUICK}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9" /><path d="M10 19a2 2 0 0 0 4 0" />
              </svg>
              {unread > 0 && <span className={BADGE}>{unread > 99 ? "99+" : unread}</span>}
            </Link>
          </div>

          {memberships.length > 1 ? (
            <form ref={formRef} action={switchOrganization}>
              <label className="sr-only" htmlFor="org-switch">Cambiar organización</label>
              <select id="org-switch" name="orgId" defaultValue={org.id} onChange={() => formRef.current?.requestSubmit()}
                className="max-w-44 cursor-pointer truncate rounded-full border border-[var(--ork-rule)] bg-white/70 py-1.5 pl-3 pr-7 text-xs font-medium text-stone-800 outline-none">
                {memberships.map((m) => <option key={m.orgId} value={m.orgId}>{m.orgName}</option>)}
              </select>
            </form>
          ) : (
            <span className="hidden rounded-full border border-[var(--ork-rule)] bg-white/70 px-3 py-1.5 text-xs font-medium sm:inline">{org.name}</span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- logo externo configurado por la empresa */}
          {org.logoUrl && <img src={org.logoUrl} alt={org.name} className="hidden h-7 w-auto max-w-28 object-contain sm:block" />}

          <details className="relative">
            <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full text-sm font-semibold text-white" style={{ background: org.color }} title={user.name}>
              {user.name.charAt(0)}
            </summary>
            <div className="absolute right-0 mt-2 w-60 rounded-xl border border-[var(--ork-rule)] bg-white p-3 text-sm shadow-xl">
              <p className="font-medium">{user.name}</p>
              <p className="truncate text-xs text-stone-500">{user.email}</p>
              <p className="mt-1 text-xs text-stone-500">{user.role} · {org.name}</p>
              <div className="mt-3 space-y-1 border-t border-stone-100 pt-2">
                {user.isPlatformAdmin && <Link href="/platform" className="block rounded px-2 py-1 hover:bg-stone-100">Panel OR-K</Link>}
                <form action={logout}><button className="w-full rounded px-2 py-1 text-left text-[var(--ork-pink)] hover:bg-stone-100">Cerrar sesión</button></form>
              </div>
            </div>
          </details>
        </div>
      </div>
      {app && app.nav.length > 0 && (
        <nav className="flex gap-1 overflow-x-auto border-t border-[var(--ork-rule)] px-4 py-1.5 md:hidden">
          {app.nav.map((n) => <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-2.5 py-1 text-sm text-stone-700 hover:bg-black/5">{n.label}</Link>)}
        </nav>
      )}
    </header>
  );
}
