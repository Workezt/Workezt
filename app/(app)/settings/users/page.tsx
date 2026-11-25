import { requirePermission } from "@/lib/core/context";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, btn, Card, Field, input, PageHeader, Table, td } from "@/components/ui";
import { inviteUser, resetMemberPassword, updateMembershipResult } from "../actions";
import { canGrantPermissions } from "@/lib/core/permissions";
import { buildCatalog, summarize } from "@/lib/core/permission-catalog";
import { RolePicker } from "@/components/role-picker";

export const metadata = { title: "Usuarios" };

export default async function Users() {
  const ctx = await requirePermission("org.users.manage");
  const [members, roles, customs] = await Promise.all([
    ctx.db.membership.findMany({ include: { user: true, role: true }, orderBy: { createdAt: "asc" } }),
    ctx.db.role.findMany({ orderBy: { name: "asc" } }),
    ctx.db.customEntity.findMany({ where: { active: true }, select: { key: true, labelPlural: true } }),
  ]);
  const catalog = buildCatalog(ctx.modules, customs);
  const assignableRoles = roles.filter((r) => (r.key !== "OWNER" || ctx.role.key === "OWNER") && canGrantPermissions(ctx.permissions, r.permissions));
  return (
    <>
      <PageHeader title="Equipo y accesos" subtitle="Administra quién puede entrar a tu empresa y qué puede hacer. Puedes cambiar el perfil de una persona sin crear otra cuenta." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card padded={false} className="lg:col-span-2">
          <Table head={["Usuario", "Cargo", "Rol", "Estado", ""]}>
            {members.map((m) => (
              <tr key={m.id}>
                <td className={td}><p className="font-medium">{m.user.name}</p><p className="text-xs text-slate-400">{m.user.email}</p></td>
                <td className={td}>{m.title ?? "—"}</td>
                <td className={td}>
                  {m.userId === ctx.user.id || !assignableRoles.some((r) => r.id === m.roleId) ? <Badge>{m.role.name}</Badge> : (
                    <ActionForm action={updateMembershipResult} className="flex flex-wrap gap-1">
                      <input type="hidden" name="id" value={m.id} />
                      <select name="roleId" aria-label={`Rol de ${m.user.name}`} defaultValue={m.roleId} className="rounded-md border border-slate-300 px-2 py-1 text-xs">{roles.filter((r) => r.id === m.roleId || assignableRoles.some((a) => a.id === r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
                      <SubmitButton className={btn.small}>Cambiar</SubmitButton>
                    </ActionForm>
                  )}
                </td>
                <td className={td}><Badge tone={m.status === "ACTIVE" ? "emerald" : "slate"}>{m.status === "ACTIVE" ? "Activo" : "Inactivo"}</Badge></td>
                <td className={td}>
                  {m.userId !== ctx.user.id && assignableRoles.some((r) => r.id === m.roleId) && (
                    <div className="flex flex-wrap items-center gap-1">
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
            <RolePicker roles={assignableRoles.map((r) => ({ id: r.id, name: r.name, description: r.description, summary: summarize(r.permissions, catalog) }))} />
            <p className="text-xs text-slate-500">Si el correo ya tiene cuenta, se reutiliza. Para cuentas nuevas se genera una contraseña que debes entregar a la persona; no se envía correo automáticamente.</p>
            <SubmitButton className={btn.primary}>Dar acceso</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
