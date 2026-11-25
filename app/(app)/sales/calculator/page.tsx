import Link from "@/components/plink";
import { requireModule } from "@/lib/core/context";
import { PageHeader, btn } from "@/components/ui";
import { simulate } from "@/lib/ui/price-calc";
import { money } from "@/lib/ui/format";
import { CalculatorEditor, type SimData } from "./editor";
import { deleteSimulationAction, duplicateSimulationAction } from "./actions";

export const metadata = { title: "Calculadora de precio" };
const n = (v: unknown) => Number(v ?? 0);

/** Calculadora de precio de venta (traída de KLINIU): cada usuario guarda sus simulaciones. */
export default async function Calculator({ searchParams }: PageProps<"/sales/calculator">) {
  const ctx = await requireModule("sales", "sales.quotes.read");
  const { id } = await searchParams;
  const showCost = !ctx.restricted("deny:costs");
  const [sims, products] = await Promise.all([
    ctx.db.priceSimulation.findMany({ where: { userId: ctx.actorId ?? "" }, include: { items: { orderBy: { position: "asc" } } }, orderBy: { updatedAt: "desc" } }),
    ctx.db.product.findMany({ where: { active: true, canBeSold: true }, select: { id: true, sku: true, name: true, cost: true }, orderBy: { name: "asc" } }),
  ]);
  const current = typeof id === "string" ? sims.find((s) => s.id === id) : undefined;
  const toData = (s: (typeof sims)[number]): SimData => ({
    id: s.id, name: s.name, shipping: n(s.shipping), picking: n(s.picking), commissionPct: n(s.commissionPct), campaignPct: n(s.campaignPct), marginPct: n(s.marginPct),
    items: s.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitCost: n(i.unitCost) })),
  });
  const blank: SimData = { name: "Nueva simulación", shipping: 0, picking: 0, commissionPct: 2.5, campaignPct: 10, marginPct: 25, items: [] };
  const editing = current ? toData(current) : blank;

  return (
    <>
      <PageHeader title="Calculadora de precio" subtitle="Calcula el precio de venta de un producto o combo con su costo, envío, picking, comisión, campaña y margen."
        actions={<Link href="/sales/calculator" className={btn.secondary}>+ Nueva simulación</Link>} />
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Mis simulaciones" className="h-fit rounded-2xl border border-[var(--ork-rule)] bg-white p-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Mis simulaciones</p>
          {sims.length === 0 && <p className="px-2 py-3 text-sm text-stone-500">Aún no has guardado ninguna.</p>}
          {sims.map((s) => {
            const on = s.id === current?.id;
            return (
              <Link key={s.id} href={`/sales/calculator?id=${s.id}`} className={`block rounded-xl px-3 py-2 ${on ? "bg-[var(--ork-violet)]/10" : "hover:bg-black/5"}`}>
                <span className={`block truncate text-sm ${on ? "font-semibold text-[var(--ork-purple)]" : ""}`}>{s.name}</span>
                <span className="text-xs text-stone-500">{money(simulate({ ...toData(s) }).price)} · {s.items.length} producto(s)</span>
              </Link>
            );
          })}
          {current && (
            <div className="mt-2 flex gap-4 border-t border-stone-100 px-2 pt-2">
              <form action={duplicateSimulationAction}><input type="hidden" name="id" value={current.id} /><button className="text-xs text-stone-500 hover:text-[var(--ork-violet)]">Duplicar</button></form>
              <form action={deleteSimulationAction}><input type="hidden" name="id" value={current.id} /><button className="text-xs text-stone-500 hover:text-rose-600">Eliminar</button></form>
            </div>
          )}
        </nav>
        <CalculatorEditor key={current?.id ?? "new"} sim={editing} showCost={showCost}
          products={products.map((p) => ({ id: p.id, label: `[${p.sku}] ${p.name}`, cost: showCost ? n(p.cost) : 0 }))} />
      </div>
    </>
  );
}
