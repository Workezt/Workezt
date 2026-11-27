import { CATEGORIES, categoryByApp } from "@/lib/launcher-categories";
import { CORE_PERMISSIONS, RESTRICTIONS, SCOPES, hasPermission } from "@/lib/core/permissions";
import { levelOf, type AppGroup, type Level } from "@/lib/core/permission-catalog";

const LEVELS: { value: Level; label: string; tone: string }[] = [
  { value: "none", label: "Sin acceso", tone: "peer-checked:bg-stone-600" },
  { value: "read", label: "Solo lectura", tone: "peer-checked:bg-sky-700" },
  { value: "write", label: "Edición", tone: "peer-checked:bg-[var(--ork-purple)]" },
];

export function PermissionFields({ catalog, granted }: { catalog: AppGroup[]; granted: string[] }) {
  const check = (key: string, label: string, hint?: string) => (
    <label key={key} className="flex items-start gap-2 py-1 text-sm">
      <input type="checkbox" name="permissions" value={key} defaultChecked={key.includes(":") ? granted.includes(key) : hasPermission(granted, key)} className="mt-0.5 accent-[var(--ork-violet)]" />
      <span>{label}{hint && <span className="block text-xs text-stone-500">{hint}</span>}</span>
    </label>
  );
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Permisos por pilar</h2>
      {CATEGORIES.map((pillar) => {
        const groups = catalog.filter(({ key }) => (categoryByApp.get(key) ?? "administracion") === pillar.key);
        const core = CORE_PERMISSIONS.filter(({ key }) =>
          (key === "intelligence.ask" || key === "approvals.override" ? "gerencia" : "administracion") === pillar.key,
        );

        return (
          <details key={pillar.key} className="overflow-hidden rounded-xl border border-[var(--ork-rule)] bg-white">
            <summary className="cursor-pointer border-l-4 px-4 py-3 text-sm font-semibold" style={{ borderColor: pillar.palette.base }}>{pillar.name}</summary>
            <div className="border-t border-[var(--ork-rule)]">
              {groups.map((g) => (
                <div key={g.key} className="border-b border-stone-100 last:border-0">
                  <div className="grid items-center gap-2 bg-stone-50 px-4 py-2 md:grid-cols-[1fr_auto]">
                    <p className="font-semibold text-[var(--ork-purple)]">{g.name}</p>
                  </div>
                  {g.areas.map((a) => {
                    const current = levelOf(granted, a.prefix);
                    return (
                      <div key={a.prefix} className="grid items-center gap-2 px-4 py-2 md:grid-cols-[1fr_auto]">
                        <p className="text-sm">{a.label}</p>
                        <div role="radiogroup" aria-label={`${g.name}: ${a.label}`} className="flex overflow-hidden rounded-lg border border-stone-300 bg-white text-xs">
                          {LEVELS.map((l) => (
                            <label key={l.value} className="cursor-pointer">
                              <input type="radio" name={`lvl:${a.prefix}`} value={l.value} defaultChecked={current === l.value} className="peer sr-only" />
                              <span className={`block px-3 py-1.5 text-stone-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ork-violet)] ${l.tone}`}>{l.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {g.extras.length > 0 && <div className="flex flex-wrap gap-x-6 px-4 pb-2">{g.extras.map((p) => check(p.key, p.label))}</div>}
                </div>
              ))}
              {core.length > 0 && <div className="px-4 py-2">{core.map((p) => check(p.key, p.label))}</div>}
              {groups.length === 0 && core.length === 0 && <p className="px-4 py-3 text-sm text-stone-500">No hay aplicaciones activas en este pilar.</p>}
            </div>
          </details>
        );
      })}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-stone-200 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-600">Alcance de registros</h3>
          {SCOPES.map((sc) => (
            <label key={sc.key} className="flex items-start gap-2 py-1 text-sm">
              <input type="checkbox" name="permissions" value={sc.key} defaultChecked={granted.includes(sc.key)} className="mt-0.5 accent-[var(--ork-violet)]" />
              <span><b>{sc.label}:</b> solo los suyos<span className="block text-xs text-stone-500">{sc.hint}. Sin marcar, ve los de todo el equipo.</span></span>
            </label>
          ))}
        </section>
        <section className="rounded-xl border border-stone-200 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-600">Datos sensibles</h3>
          {RESTRICTIONS.map((r) => check(r.key, r.label, r.hint))}
        </section>
      </div>
    </div>
  );
}
