import Link from "@/components/plink";
import { requireModule } from "@/lib/core/context";
import { PageHeader, btn } from "@/components/ui";
import { listCombos } from "@/lib/apps/combos";
import { money, num } from "@/lib/ui/format";

export const metadata = { title: "Combos" };

/** Combos (traído de KLINIU): paquetes de productos con precio propio, ahorro y unidades armables. */
export default async function Combos() {
  const ctx = await requireModule("products", "products.read");
  const combos = await listCombos(ctx);
  const active = combos.filter((c) => c.combo.active);
  const showCost = !ctx.restricted("deny:costs");

  return (
    <>
      <PageHeader title="Combos" subtitle="Paquetes de productos con precio propio. Al venderlos salen sus productos del inventario."
        actions={ctx.can("products.write") ? <Link href="/products/new?kind=COMBO" className={btn.primary}>+ Nuevo combo</Link> : undefined} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Combos", num(combos.length)],
          ["Activos", num(active.length)],
          ["Se pueden armar hoy", `${num(active.reduce((a, c) => a + c.buildable, 0))} combos`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[var(--ork-rule)] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--ork-purple)]">{value}</p>
          </div>
        ))}
      </div>
      {combos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="font-semibold">Aún no hay combos</p>
          <p className="mt-1 text-sm text-stone-500">Crea uno, ponle precio y agrégale los productos que lleva.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--ork-rule)] bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-stone-200 text-left text-[13px] font-semibold">
              <th className="px-4 py-3">Combo</th><th className="px-3 py-3">Productos</th><th className="px-3 py-3 text-right">Precio normal</th><th className="px-3 py-3 text-right">Precio combo</th><th className="px-3 py-3 text-right">Ahorro</th>{showCost && <th className="px-3 py-3 text-right">Margen</th>}<th className="px-3 py-3 text-right">Armables</th>
            </tr></thead>
            <tbody>{combos.map((c) => (
              <tr key={c.combo.id} className={`border-b border-stone-100 ${c.combo.active ? "" : "opacity-50"}`}>
                <td className="px-4 py-2.5"><Link href={`/products/${c.combo.id}`} className="font-medium hover:underline">{c.combo.name}</Link><p className="font-mono text-xs text-stone-500">{c.combo.sku}</p></td>
                <td className="px-3 py-2.5 text-stone-600">{c.items.length ? c.items.map((i) => `${num(i.quantity)}× ${i.name}`).join(", ") : <span className="text-amber-600">Sin productos</span>}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(c.normalPrice)}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(c.comboPrice)}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${c.savings < 0 ? "text-rose-600" : "text-emerald-700"}`}>{c.normalPrice > 0 ? `${c.savingsPct.toFixed(1)} %` : "—"}</td>
                {showCost && <td className="px-3 py-2.5 text-right tabular-nums">{c.comboPrice > 0 ? `${c.marginPct.toFixed(1)} %` : "—"}</td>}
                <td className="px-3 py-2.5 text-right tabular-nums">{num(c.buildable)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
