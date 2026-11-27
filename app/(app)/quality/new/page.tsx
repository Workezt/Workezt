import Link from "@/components/plink";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { btn, Card, Field, input, PageHeader } from "@/components/ui";
import { requireModule } from "@/lib/core/context";
import { SEVERITY_LABEL } from "@/components/ui";
import { saveNonconformity } from "../../ops-actions";

export const metadata = { title: "Registrar no conformidad" };

export default async function NewEntry() {
  const ctx = await requireModule("quality", "quality.write");
  const [suppliers, products] = await Promise.all([
    ctx.db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ctx.db.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Registrar no conformidad" actions={<Link href="/quality" className={btn.secondary}>Volver a no conformidades</Link>} />
      <Card>
        <ActionForm action={saveNonconformity} className="space-y-5">
          <Field label="Título *"><input name="title" required className={input} /></Field>
          <Field label="Descripción"><textarea name="description" rows={3} className={input} /></Field>
          <Field label="Proveedor"><select name="supplierId" className={input}><option value="">Sin seleccionar</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Producto"><select name="productId" className={input}><option value="">Sin seleccionar</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Severidad"><select name="severity" defaultValue="MEDIUM" className={input}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}</select></Field>
          <SubmitButton className={btn.primary}>Guardar no conformidad</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
