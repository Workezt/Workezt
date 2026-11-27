import Link from "@/components/plink";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { btn, Card, Field, input, PageHeader } from "@/components/ui";
import { requireModule } from "@/lib/core/context";
import { addMonths, FREQ_LABEL, FREQ_MONTHS, localDay, monthLabel, type Frequency } from "@/lib/apps/finance";
import { addRecurring } from "../../actions";
import { CategorySelect } from "../../shared";

export const metadata = { title: "Nuevo gasto fijo" };

export default async function NewEntry() {
  await requireModule("finance", "finance.write");
  const thisYm = localDay().slice(0, 7);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nuevo gasto fijo" actions={<Link href="/finance/fixed" className={btn.secondary}>Volver a gastos fijos</Link>} />
      <Card>
        <ActionForm action={addRecurring} className="space-y-5">
          <Field label="Nombre *"><input name="name" required className={input} placeholder="Ej. Arriendo bodega" /></Field>
          <Field label="Categoría *"><CategorySelect /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor *"><input type="number" name="amount" min="0" step="any" required className={input} /></Field>
            <Field label="Frecuencia">
              <select name="frequency" defaultValue="monthly" className={input}>
                {(Object.keys(FREQ_MONTHS) as Frequency[]).map((k) => <option key={k} value={k}>{FREQ_LABEL[k]}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Día de pago"><input type="number" name="dueDay" min="1" max="31" defaultValue="5" className={input} /></Field>
            <Field label="Desde *" hint="Ancla los cobros trimestrales o anuales"><input type="month" name="startOn" required defaultValue={thisYm} className={input} /></Field>
          </div>
          <Field label="Hasta" hint={`Vacío = sin fecha final. Ej. ${monthLabel(addMonths(thisYm, 12))}`}><input type="month" name="endOn" className={input} /></Field>
          <Field label="Proveedor"><input name="vendor" className={input} /></Field>
          <Field label="Notas"><textarea name="notes" rows={2} className={input} /></Field>
          <SubmitButton className={btn.primary}>Guardar</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
