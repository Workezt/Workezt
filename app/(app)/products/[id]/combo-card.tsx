import Link from "@/components/plink";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { btn } from "@/components/ui";
import { money, num } from "@/lib/ui/format";
import type { comboDetail } from "@/lib/apps/combos";
import { addComboItemAction, removeComboItemAction } from "../actions";

type Detail = Awaited<ReturnType<typeof comboDetail>>;
const field = "w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--ork-violet)]";

/** Productos del combo: qué lleva, precio normal vs. precio combo, ahorro, margen y cuántos se pueden armar. */
export function ComboCard({ d, options, canWrite, showCost }: { d: Detail; options: string[]; canWrite: boolean; showCost: boolean }) {
  return (
    <section className="rounded-2xl border border-[var(--ork-rule)] bg-white p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-700">Productos del combo</h2>
      <p className="mt-1 text-sm text-stone-500">Al despachar una venta del combo salen estos productos del inventario.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Precio normal", money(d.normalPrice), "Suma de los productos a su precio"],
          ["Precio del combo", money(d.comboPrice), "El precio de venta de este producto"],
          ["Ahorro para el cliente", d.normalPrice > 0 ? `${money(d.savings)} · ${d.savingsPct.toFixed(1)} %` : "—", ""],
          ...(showCost ? [["Margen", d.comboPrice > 0 ? `${d.marginPct.toFixed(1)} %` : "—", `Costo ${money(d.cost)}`]] : []),
          ["Se pueden armar", `${num(d.buildable)} combos`, "Con la existencia actual"],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-xl bg-[var(--ork-violet)]/[0.06] p-3">
            <p className="text-xs text-stone-500">{label}</p>
            <p className={`text-lg font-semibold tabular-nums ${label === "Ahorro para el cliente" && d.savings < 0 ? "text-rose-600" : ""}`}>{value}</p>
            {hint && <p className="text-[11px] text-stone-500">{hint}</p>}
          </div>
        ))}
      </div>

      {d.items.length === 0 ? <p className="mt-4 text-sm text-stone-500">Este combo aún no tiene productos.</p> : (
        <table className="mt-4 w-full text-sm">
          <thead><tr className="text-left text-[13px] font-semibold"><th className="py-1.5">Producto</th><th className="text-right">Cantidad</th><th className="text-right">Precio</th><th className="text-right">Subtotal</th><th className="text-right">Existencia</th>{canWrite && <th />}</tr></thead>
          <tbody>{d.items.map((i) => (
            <tr key={i.lineId} className="border-t border-stone-100">
              <td className="py-1.5"><Link href={`/products/${i.productId}`} className="font-medium hover:underline">{i.name}</Link> <span className="font-mono text-xs text-stone-500">{i.sku}</span></td>
              <td className="text-right tabular-nums">{num(i.quantity)} {i.unit}</td>
              <td className="text-right tabular-nums">{money(i.price)}</td>
              <td className="text-right tabular-nums">{money(i.price * i.quantity)}</td>
              <td className={`text-right tabular-nums ${i.stock < i.quantity ? "text-rose-600" : ""}`}>{num(i.stock)}</td>
              {canWrite && <td className="pl-2 text-right"><form action={removeComboItemAction}><input type="hidden" name="comboId" value={d.combo.id} /><input type="hidden" name="lineId" value={i.lineId} /><button className="text-xs text-stone-500 hover:text-rose-600">Quitar</button></form></td>}
            </tr>
          ))}</tbody>
        </table>
      )}

      {canWrite && (
        <ActionForm action={addComboItemAction} className="mt-4 grid grid-cols-[minmax(0,1fr)_100px_auto] items-end gap-2">
          <input type="hidden" name="comboId" value={d.combo.id} />
          <datalist id="combo-products">{options.map((o) => <option key={o} value={o} />)}</datalist>
          <label className="text-xs text-stone-600">Producto<input name="component" list="combo-products" required placeholder="Busca por nombre o SKU" className={field} /></label>
          <label className="text-xs text-stone-600">Cantidad<input name="quantity" type="number" min="1" step="any" defaultValue={1} className={`${field} text-right`} /></label>
          <SubmitButton className={btn.primary} pendingText="…">Agregar</SubmitButton>
        </ActionForm>
      )}
    </section>
  );
}
