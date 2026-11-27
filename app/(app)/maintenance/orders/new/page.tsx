import Link from "@/components/plink";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { btn, Card, Field, input, PageHeader } from "@/components/ui";
import { requireModule } from "@/lib/core/context";
import { opsOptions } from "@/components/ops";
import { orgUsers } from "@/lib/core/members";
import { saveOrder } from "../../actions";

export const metadata = { title: "Nueva orden de mantenimiento" };

export default async function NewEntry() {
  const ctx = await requireModule("maintenance", "maintenance.write");
  const [equipment, users] = await Promise.all([
    ctx.db.equipment.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
    orgUsers(ctx),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nueva orden de mantenimiento" actions={<Link href="/maintenance" className={btn.secondary}>Volver a órdenes</Link>} />
      <Card>
        {equipment.length === 0 ? <p className="text-sm text-slate-500">Primero registra un <Link href="/maintenance/equipment" className="underline">equipo</Link>.</p> : (
          <ActionForm action={saveOrder} className="space-y-5">
            <Field label="Equipo *"><select name="equipmentId" required className={input}>{equipment.map((e) => <option key={e.id} value={e.id}>{e.code} · {e.name}</option>)}</select></Field>
            <Field label="Tipo"><select name="type" defaultValue="CORRECTIVE" className={input}>{opsOptions("maintenanceType")}</select></Field>
            <Field label="Prioridad"><select name="priority" defaultValue="MEDIUM" className={input}>{opsOptions("priority")}</select></Field>
            <Field label="Descripción de la falla o del trabajo *"><textarea name="description" rows={3} required className={input} /></Field>
            <Field label="Asignar a"><select name="assignedToId" className={input}><option value="">Sin seleccionar</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            <SubmitButton className={btn.primary}>Crear orden</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
