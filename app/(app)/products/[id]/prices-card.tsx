import { ActionForm, SubmitButton } from "@/components/action-form";
import { btn } from "@/components/ui";
import { date, money, num } from "@/lib/ui/format";
import { addPackPriceAction, removePackPriceAction } from "../actions";

type Pack = { id: string; label: string; qty: number; totalPrice: unknown; unitPrice: number; savingsPct: number };
type Change = { id: string; createdAt: Date; oldPrice: unknown; newPrice: unknown; userName: string; changePct: number | null };

const field = "w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--ork-violet)]";

/** Precios por paquete e historial de cambios de precio del producto. */
export function PricesCard({ productId, unit, price, packs, history, canWrite }: {
  productId: string; unit: string; price: unknown; packs: Pack[]; history: Change[]; canWrite: boolean;
}) {
  return (
    <section className="grid gap-6 rounded-2xl border border-[var(--ork-rule)] bg-white p-6 lg:grid-cols-2">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-700">Precios por paquete</h2>
        <p className="mt-1 text-sm text-stone-500">Precio unitario: <b>{money(price)}</b> / {unit}. Un paquete solo conviene si su precio por unidad es menor.</p>
        {packs.length === 0 ? <p className="mt-4 text-sm text-stone-500">Sin paquetes todavía.</p> : (
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-left text-[13px] font-semibold"><th className="py-1.5">Paquete</th><th className="text-right">Unidades</th><th className="text-right">Precio</th><th className="text-right">Por unidad</th><th className="text-right">Ahorro</th>{canWrite && <th />}</tr></thead>
            <tbody>{packs.map((k) => (
              <tr key={k.id} className="border-t border-stone-100">
                <td className="py-1.5 font-medium">{k.label}</td>
                <td className="text-right tabular-nums">{num(k.qty)}</td>
                <td className="text-right tabular-nums">{money(k.totalPrice)}</td>
                <td className="text-right tabular-nums">{money(k.unitPrice)}</td>
                <td className={`text-right tabular-nums ${k.savingsPct > 0 ? "text-emerald-700" : "text-rose-600"}`}>{k.savingsPct > 0 ? `${k.savingsPct.toFixed(1)} %` : "No ahorra"}</td>
                {canWrite && <td className="pl-2 text-right"><form action={removePackPriceAction}><input type="hidden" name="id" value={k.id} /><button className="text-xs text-stone-500 hover:text-rose-600" aria-label={`Eliminar ${k.label}`}>Eliminar</button></form></td>}
              </tr>
            ))}</tbody>
          </table>
        )}
        {canWrite && (
          <ActionForm action={addPackPriceAction} className="mt-4 grid grid-cols-[1fr_90px_140px_auto] items-end gap-2">
            <input type="hidden" name="productId" value={productId} />
            <label className="text-xs text-stone-600">Nombre<input name="label" required placeholder="Caja x12" className={field} /></label>
            <label className="text-xs text-stone-600">Unidades<input name="qty" type="number" min="2" step="1" required className={`${field} text-right`} /></label>
            <label className="text-xs text-stone-600">Precio del paquete<input name="totalPrice" type="number" min="1" step="any" required className={`${field} text-right`} /></label>
            <SubmitButton className={btn.primary} pendingText="…">Agregar</SubmitButton>
          </ActionForm>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-700">Historial de precios</h2>
        <p className="mt-1 text-sm text-stone-500">Cada vez que cambia el precio de venta queda aquí.</p>
        {history.length === 0 ? <p className="mt-4 text-sm text-stone-500">El precio no ha cambiado desde que se activó el historial.</p> : (
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-left text-[13px] font-semibold"><th className="py-1.5">Fecha</th><th>Quién</th><th className="text-right">Antes</th><th className="text-right">Ahora</th><th className="text-right">Cambio</th></tr></thead>
            <tbody>{history.map((h) => (
              <tr key={h.id} className="border-t border-stone-100">
                <td className="py-1.5">{date(h.createdAt)}</td>
                <td>{h.userName}</td>
                <td className="text-right tabular-nums text-stone-500">{money(h.oldPrice)}</td>
                <td className="text-right tabular-nums font-medium">{money(h.newPrice)}</td>
                <td className={`text-right tabular-nums ${h.changePct === null ? "" : h.changePct > 0 ? "text-emerald-700" : "text-rose-600"}`}>{h.changePct === null ? "—" : `${h.changePct > 0 ? "+" : ""}${h.changePct.toFixed(1)} %`}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}
