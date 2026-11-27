import Link from "@/components/plink";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/core/context";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, btn, Card, Field, input, PageHeader, Table, td } from "@/components/ui";
import { inviteUser, resetMemberPassword, saveMemberPermissions, updateMembershipResult } from "../actions";
import { canGrantPermissions, membershipPermissions } from "@/lib/core/permissions";
import { buildCatalog, buildPersonalCatalog, summarize } from "@/lib/core/permission-catalog";
import { RolePicker } from "@/components/role-picker";
import { PermissionFields } from "@/components/permission-fields";
import { groupProfilesByPillar } from "@/lib/launcher-categories";

export const metadata = { title: "Usuarios" };

export default async function Users({ searchParams }: PageProps<"/settings/users">) {
  const ctx = await requirePermission("org.users.manage");
  const [members, roles, customs] = await Promise.all([
    ctx.db.membership.findMany({ include: { user: true, role: true }, orderBy: { createdAt: "asc" } }),
    ctx.db.role.findMany({ orderBy: { name: "asc" } }),
    ctx.db.customEntity.findMany({ where: { active: true }, select: { key: true, labelPlural: true } }),
  ]);
  const catalog = buildCatalog(ctx.modules, customs);
  const assignableRoles = roles.filter((r) => (r.key !== "OWNER" || ctx.role.key === "OWNER") && canGrantPermissions(ctx.permissions, r.permissions));
  const profiles = groupProfilesByPillar(assignableRoles);
  const canManage = (member: (typeof members)[number]) =>
    member.userId !== ctx.user.id
    && assignableRoles.some(({ id }) => id === member.roleId)
    && canGrantPermissions(ctx.permissions, membershipPermissions(member));
  const canCustomize = (member: (typeof members)[number]) =>
    canManage(member) && ctx.can("org.roles.manage") && !member.role.isSystem && member.role.key !== "OWNER";

  const { acceso } = await searchParams;
  if (typeof acceso === "string") {
    const member = members.find(({ id }) => id === acceso);
    if (!member || !canCustomize(member)) notFound();
    const granted = membershipPermissions(member);
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <PageHeader
          title={`Acceso de ${member.user.name}`}
          subtitle={`Perfil base: ${member.role.name}. Los permisos personales aplican solo a esta persona en esta empresa.`}
          actions={<Link href="/settings/users" className={btn.secondary}>Volver a usuarios</Link>}
        />
        <Card>
          <ActionForm action={saveMemberPermissions} className="space-y-5">
            <input type="hidden" name="id" value={member.id} />
            <input type="hidden" name="roleId" value={member.roleId} />
            <PermissionFields key={JSON.stringify(granted)} catalog={buildPersonalCatalog(ctx.modules, customs)} granted={granted} />
            <SubmitButton className={btn.primary}>Guardar acceso personal</SubmitButton>
          </ActionForm>
          {member.permissionsOverride !== null && (
            <ActionForm action={saveMemberPermissions} className="mt-4 border-t border-[var(--ork-rule)] pt-4">
              <input type="hidden" name="id" value={member.id} />
              <input type="hidden" name="roleId" value={member.roleId} />
              <input type="hidden" name="mode" value="inherit" />
              <SubmitButton className={btn.secondary}>Restaurar permisos de {member.role.name}</SubmitButton>
            </ActionForm>
          )}
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Equipo y accesos" subtitle="Administra quién puede entrar a tu empresa y qué puede hacer. Elige un perfil base o personaliza lo que cada persona puede ver y editar." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card padded={false} className="lg:col-span-2">
          <Table head={["Usuario", "Cargo", "Rol", "Estado", ""]}>
            {members.map((m) => (
              <tr key={m.id}>
                <td className={td}><p className="font-medium">{m.user.name}</p><p className="text-xs text-slate-400">{m.user.email}</p></td>
                <td className={td}>{m.title ?? "—"}</td>
                <td className={td}>
                  {!canManage(m) ? <Badge>{m.role.name}</Badge> : (
                    <ActionForm action={updateMembershipResult} className="flex flex-wrap gap-1">
                      <input type="hidden" name="id" value={m.id} />
                      <select name="roleId" aria-label={`Rol de ${m.user.name}`} defaultValue={m.roleId} className="rounded-md border border-slate-300 px-2 py-1 text-xs">{profiles.map((pillar) => (
                        <optgroup key={pillar.key} label={pillar.name}>
                          {pillar.profiles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                        </optgroup>
                      ))}</select>
                      <SubmitButton className={btn.small}>Cambiar perfil</SubmitButton>
                    </ActionForm>
                  )}
                  {m.permissionsOverride !== null && <p className="mt-1 text-xs text-slate-500">Acceso personalizado. Cambiar el perfil restablece sus permisos.</p>}
                </td>
                <td className={td}><Badge tone={m.status === "ACTIVE" ? "emerald" : "slate"}>{m.status === "ACTIVE" ? "Activo" : "Inactivo"}</Badge></td>
                <td className={td}>
                  {canManage(m) && (
                    <div className="flex flex-wrap items-center gap-1">
                      {canCustomize(m) && <Link href={`/settings/users?acceso=${m.id}`} className={btn.small}>Personalizar acceso<span className="sr-only"> de {m.user.name}</span></Link>}
                      <ActionForm action={updateMembershipResult}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value={m.status === "ACTIVE" ? "DISABLED" : "ACTIVE"} /><SubmitButton className={btn.ghost}>{m.status === "ACTIVE" ? "Desactivar" : "Activar"}</SubmitButton></ActionForm>
                      <ActionForm action={resetMemberPassword}><input type="hidden" name="id" value={m.id} /><SubmitButton className={btn.ghost} pendingText="Generando…">Generar contraseña</SubmitButton></ActionForm>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Dar acceso a una persona">
          <ActionForm action={inviteUser} className="space-y-3">
            <Field label="Email *"><input name="email" type="email" required className={input} /></Field>
            <Field label="Nombre"><input name="name" className={input} /></Field>
            <Field label="Cargo"><input name="title" className={input} /></Field>
            <RolePicker roles={assignableRoles.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, summary: summarize(r.permissions, catalog) }))} />
            <p className="text-xs text-slate-500">Si el correo ya tiene cuenta, se reutiliza. Para cuentas nuevas se genera una contraseña que debes entregar a la persona; no se envía correo automáticamente.</p>
            <SubmitButton className={btn.primary}>Dar acceso</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
