import Link from "@/components/plink";
import { requirePermission } from "@/lib/core/context";
import { buildCatalog, summarize, type AppGroup } from "@/lib/core/permission-catalog";
import { PermissionFields } from "@/components/permission-fields";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { btn, input, PageHeader } from "@/components/ui";
import { deleteRole, saveRole } from "../actions";
import { BASE_ROLES } from "@/lib/templates/industries";

export const metadata = { title: "Roles y permisos" };
const BASE_KEYS = new Set(BASE_ROLES.map((r) => r.key));

function RoleForm({ catalog, granted, role }: {
  catalog: AppGroup[]; granted: string[];
  role?: { id: string; name: string; description: string | null };
}) {
  return (
    <ActionForm action={saveRole} className="space-y-6">
      {role && <input type="hidden" name="id" value={role.id} />}
      <div className="grid gap-3 md:grid-cols-[18rem_1fr]">
        <label className="text-sm"><span className="mb-1 block text-xs font-medium text-stone-600">Nombre del rol *</span><input name="name" required defaultValue={role?.name} placeholder="Ej. Vendedor externo" className={input} /></label>
        <label className="text-sm"><span className="mb-1 block text-xs font-medium text-stone-600">Descripción</span><input name="description" defaultValue={role?.description ?? ""} placeholder="Para qué sirve este rol" className={input} /></label>
      </div>

      <PermissionFields catalog={catalog} granted={granted} />
      <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-4">
        <SubmitButton className={btn.primary} pendingText="Guardando…">{role ? "Guardar rol" : "Crear rol"}</SubmitButton>
        <p className="text-xs text-stone-500">Nadie puede otorgar permisos que no tiene. Los cambios aplican en la siguiente acción del usuario.</p>
      </div>
    </ActionForm>
  );
}

export default async function Roles({ searchParams }: PageProps<"/settings/roles">) {
  const ctx = await requirePermission("org.roles.manage");
  const sp = await searchParams;
  const [roles, customs] = await Promise.all([
    ctx.db.role.findMany({ orderBy: { name: "asc" }, include: { memberships: { include: { user: { select: { name: true } } } } } }),
    ctx.db.customEntity.findMany({ where: { active: true }, select: { key: true, labelPlural: true } }),
  ]);
  const catalog = buildCatalog(ctx.modules, customs);
  const open = typeof sp.edit === "string" ? sp.edit : "";
  const dup = typeof sp.dup === "string" ? roles.find((r) => r.id === sp.dup) : undefined;
  const creating = sp.new === "1" || !!dup;

  return (
    <>
      <PageHeader title="Roles y permisos"
        subtitle="Define qué puede ver y hacer cada rol, app por app: sin acceso, solo lectura o edición; qué registros ve; y qué datos sensibles se le ocultan. Los roles también deciden quién aprueba en los flujos."
        actions={<Link href="/settings/roles?new=1" className={btn.primary}>Nuevo rol</Link>} />

      <div className="space-y-3">
        {roles.map((r) => {
          const editing = open === r.id;
          const users = r.memberships.map((m) => m.user.name);
          return (
            <section key={r.id} className={`rounded-2xl border bg-white/90 ${editing ? "border-[var(--ork-violet)] shadow-sm" : "border-[var(--ork-rule)]"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{r.name} <code className="ml-1 text-[11px] font-normal text-stone-400">{r.key}</code>{r.isSystem && <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">sistema</span>}</p>
                  {r.description && <p className="text-sm text-stone-600">{r.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {summarize(r.permissions, catalog).map((s) => <span key={s} className={`rounded-full px-2 py-0.5 text-[11px] ${s.startsWith("sin ") || s.startsWith("solo ") ? "bg-amber-100 text-amber-900" : "bg-[var(--ork-lavender)]/30 text-[var(--ork-purple)]"}`}>{s}</span>)}
                  </div>
                  <p className="mt-2 text-xs text-stone-500">{users.length ? `${users.length} usuario(s): ${users.slice(0, 4).join(", ")}${users.length > 4 ? "…" : ""}` : "Sin usuarios"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!r.isSystem && <Link href={editing ? "/settings/roles" : `/settings/roles?edit=${r.id}`} className={btn.secondary}>{editing ? "Cerrar" : "Editar permisos"}</Link>}
                  <Link href={`/settings/roles?dup=${r.id}`} className={btn.ghost}>Duplicar</Link>
                  {!r.isSystem && !BASE_KEYS.has(r.key) && users.length === 0 && <form action={deleteRole}><input type="hidden" name="id" value={r.id} /><button className={btn.ghost}>Eliminar</button></form>}
                </div>
              </div>
              {editing && !r.isSystem && (
                <div id={`rol-${r.id}`} className="border-t border-stone-100 p-4">
                  <RoleForm catalog={catalog} granted={r.permissions} role={r} />
                </div>
              )}
              {r.isSystem && editing && <p className="border-t border-stone-100 p-4 text-sm text-stone-500">Acceso total. No editable.</p>}
            </section>
          );
        })}

        {creating && (
          <section id="nuevo" className="rounded-2xl border border-[var(--ork-violet)] bg-white p-4 shadow-sm">
            <p className="mb-4 font-semibold">{dup ? `Nuevo rol a partir de «${dup.name}»` : "Nuevo rol"}</p>
            <RoleForm catalog={catalog} granted={dup && !dup.isSystem ? dup.permissions : dup?.isSystem ? ["*"] : []} />
          </section>
        )}
      </div>
    </>
  );
}
