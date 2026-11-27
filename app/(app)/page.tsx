import Link from "@/components/plink";
import { requireContext } from "@/lib/core/context";
import { CATEGORIES } from "@/lib/launcher-categories";
import { AppIcon } from "@/components/app-icons";
import { visibleInsightWhere } from "@/lib/radar/visibility";
import { fileUrl } from "@/lib/core/files";

export const metadata = { title: "Inicio" };

/** Inicio: lanzador de apps. Cada organización ve solo sus apps activas y permitidas. */
export default async function Home() {
  const ctx = await requireContext();
  const [alerts, approvals, tasks] = await Promise.all([
    ctx.hasModule("radar") && ctx.can("radar.read") ? ctx.db.insight.count({ where: { ...visibleInsightWhere(ctx), status: "OPEN", severity: { in: ["HIGH", "CRITICAL"] } } }) : 0,
    ctx.can("approvals.read") ? ctx.db.approval.count({ where: { status: "PENDING", ...(ctx.can("approvals.override") ? {} : { requiredRoleKey: ctx.role.key }) } }) : 0,
    ctx.can("tasks.read") ? ctx.db.task.count({ where: { assigneeId: ctx.user.id, status: "OPEN" } }) : 0,
  ]);
  const chips = [
    alerts > 0 && { href: "/radar", label: `${alerts} alertas importantes en Radar`, tone: "bg-[var(--ork-pink)] text-white" },
    approvals > 0 && { href: "/approvals", label: `${approvals} aprobaciones esperan por ti`, tone: "bg-[var(--ork-violet)] text-white" },
    tasks > 0 && { href: "/tasks", label: `${tasks} tareas abiertas`, tone: "bg-white text-[var(--ork-ink)] border border-[var(--ork-rule)]" },
  ].filter(Boolean) as { href: string; label: string; tone: string }[];

  return (
    <div className="pb-20">
      <section className="wz-hero relative -mx-4 -mt-6 overflow-hidden sm:-mx-6 sm:mt-0 sm:rounded-3xl">
        {ctx.org.branding.heroVideoId ? (
          <>
            {/* Video de marca de la empresa (Ajustes → Apariencia) con velo para que el texto se lea */}
            <video src={fileUrl(ctx.org.branding.heroVideoId)} autoPlay muted loop playsInline preload="metadata" aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
          </>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- imagen estática de marca */
          <img src="/brand/workezt-orca.jpg" alt="" className="absolute inset-y-0 right-0 h-full w-auto max-w-none opacity-60 [mask-image:linear-gradient(90deg,transparent,#000_30%)] sm:opacity-100" />
        )}
        <div className="relative px-6 py-9 sm:px-10 sm:py-12">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-[40px]">
            Tu empresa, en arm<span className="text-[#c4a6ff]">onía.</span>
          </h1>
          <p className="mt-2 text-sm tracking-[0.22em] text-white/70 sm:text-base">Understand · Transform · Scale</p>
        </div>
      </section>

      {chips.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map((c) => <Link key={c.href} href={c.href} className={`rounded-full px-4 py-1.5 text-sm font-medium transition hover:scale-[1.03] ${c.tone}`}>{c.label} →</Link>)}
        </div>
      )}

      <section className="mt-8" aria-labelledby="launcher-title">
        <h2 id="launcher-title" className="font-display text-2xl font-bold text-[var(--ork-ink)] sm:text-3xl">Aplicaciones</h2>
        <div className="mx-auto mt-6 grid max-w-[1000px] grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((area) => (
            <Link
              key={area.key}
              href={`/aplicaciones/${area.key}`}
              className="flex min-w-0 flex-col items-center gap-2.5 rounded-3xl p-2 text-center outline-none transition hover:bg-[var(--ork-violet)]/10 focus-visible:ring-2 focus-visible:ring-[var(--ork-violet)]"
            >
              <span className="app-tile grid h-[84px] w-[84px] place-items-center sm:h-[96px] sm:w-[96px]" aria-hidden="true">
                <AppIcon name={area.icon} size={76} pack="area" palette={area.palette} />
              </span>
              <span className="text-sm font-semibold leading-tight text-[var(--ork-ink)]">{area.name}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
