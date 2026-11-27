import Link from "@/components/plink";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { btn, Card, Field, input, PageHeader } from "@/components/ui";
import { requireModule } from "@/lib/core/context";
import { todayKey } from "@/lib/apps/ops-shared";
import { saveIncident } from "../../actions";

export const metadata = { title: "Registrar novedad" };

export default async function NewEntry() {
  const ctx = await requireModule("logistics", "logistics.write");
  const [vehicles, drivers] = await Promise.all([
    ctx.db.vehicle.findMany({ orderBy: { plate: "asc" }, select: { id: true, plate: true } }),
    ctx.db.driver.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Registrar novedad" actions={<Link href="/logistics/incidents" className={btn.secondary}>Volver a novedades</Link>} />
      <Card>
        <ActionForm action={saveIncident} className="space-y-5">
          <Field label="Fecha"><input type="date" name="date" defaultValue={todayKey()} required className={input} /></Field>
          <Field label="Tipo *" hint="Ej.: accidente, daño mecánico, retraso, comparendo"><input name="type" required className={input} /></Field>
          <Field label="Vehículo"><select name="vehicleId" className={input}><option value="">Sin seleccionar</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}</select></Field>
          <Field label="Conductor"><select name="driverId" className={input}><option value="">Sin seleccionar</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</select></Field>
          <Field label="Descripción *"><textarea name="description" rows={3} required className={input} /></Field>
          <Field label="Acción correctiva"><input name="correctiveAction" className={input} /></Field>
          <SubmitButton className={btn.primary}>Guardar novedad</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
