"use client";

import { useMemo, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { btn } from "@/components/ui-base";
import { simulate } from "@/lib/ui/price-calc";
import { saveSimulationAction } from "./actions";

type Product = { id: string; label: string; cost: number };
type Item = { key: number; productId: string | null; name: string; quantity: number; unitCost: number };
export type SimData = { id?: string; name: string; shipping: number; picking: number; commissionPct: number; campaignPct: number; marginPct: number; items: Omit<Item, "key">[] };

const cop = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const box = "w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--ork-violet)]";
let seq = 1;

/** Editor de la calculadora: el resumen se recalcula en vivo con la misma fórmula del servidor. */
export function CalculatorEditor({ sim, products, showCost }: { sim: SimData; products: Product[]; showCost: boolean }) {
  const [name, setName] = useState(sim.name);
  const [cfg, setCfg] = useState({ shipping: sim.shipping, picking: sim.picking, commissionPct: sim.commissionPct, campaignPct: sim.campaignPct, marginPct: sim.marginPct });
  const [items, setItems] = useState<Item[]>(() => (sim.items.length ? sim.items : [{ productId: null, name: "", quantity: 1, unitCost: 0 }]).map((i) => ({ ...i, key: seq++ })));
  const byLabel = useMemo(() => new Map(products.map((p) => [p.label, p])), [products]);
  const r = simulate({ ...cfg, items });

  const setItem = (key: number, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const pickProduct = (key: number, label: string) => {
    const p = byLabel.get(label);
    setItem(key, p ? { productId: p.id, name: label, ...(showCost && p.cost ? { unitCost: p.cost } : {}) } : { productId: null, name: label });
  };
  const num = (k: keyof typeof cfg) => (
    <input type="number" step="any" min="0" value={Number.isFinite(cfg[k]) ? cfg[k] : 0} onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })} className={`${box} text-right`} />
  );
  const payload = JSON.stringify({ name, ...cfg, items: items.map(({ productId, name, quantity, unitCost }) => ({ productId, name, quantity, unitCost })) });

  return (
    <ActionForm action={saveSimulationAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      {sim.id && <input type="hidden" name="id" value={sim.id} />}
      <input type="hidden" name="payload" value={payload} />
      <div className="space-y-5 rounded-2xl border border-[var(--ork-rule)] bg-white p-6">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la simulación" aria-label="Nombre de la simulación"
          className="w-full border-b border-transparent bg-transparent text-2xl font-semibold outline-none hover:border-stone-200 focus:border-[var(--ork-violet)]" />

        <div>
          <p className="mb-2 text-sm font-semibold">Productos</p>
          <datalist id="calc-products">{products.map((p) => <option key={p.id} value={p.label} />)}</datalist>
          <div className="space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_80px_130px_120px_28px] gap-2 text-xs text-stone-500"><span>Producto o concepto</span><span className="text-right">Cantidad</span><span className="text-right">Costo unitario</span><span className="text-right">Subtotal</span><span /></div>
            {items.map((i) => (
              <div key={i.key} className="grid grid-cols-[minmax(0,1fr)_80px_130px_120px_28px] items-center gap-2">
                <input list="calc-products" value={i.name} onChange={(e) => pickProduct(i.key, e.target.value)} placeholder="Busca un producto o escribe un concepto" className={box} />
                <input type="number" min="1" step="1" value={i.quantity} onChange={(e) => setItem(i.key, { quantity: Number(e.target.value) })} className={`${box} text-right`} />
                <input type="number" min="0" step="any" value={i.unitCost} onChange={(e) => setItem(i.key, { unitCost: Number(e.target.value) })} className={`${box} text-right`} />
                <span className="text-right text-sm tabular-nums">{cop(i.quantity * i.unitCost)}</span>
                <button type="button" onClick={() => setItems((xs) => (xs.length > 1 ? xs.filter((x) => x.key !== i.key) : xs))} aria-label="Quitar" className="text-stone-400 hover:text-rose-600">✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setItems((xs) => [...xs, { key: seq++, productId: null, name: "", quantity: 1, unitCost: 0 }])} className="mt-3 text-sm font-medium text-[var(--ork-violet)] hover:underline">+ Agregar producto</button>
        </div>

        <div className="grid gap-3 sm:grid-cols-5">
          <label className="text-xs text-stone-600">Envío{num("shipping")}</label>
          <label className="text-xs text-stone-600">Picking{num("picking")}</label>
          <label className="text-xs text-stone-600">Margen %{num("marginPct")}</label>
          <label className="text-xs text-stone-600">Comisión %{num("commissionPct")}</label>
          <label className="text-xs text-stone-600">Campaña %{num("campaignPct")}</label>
        </div>
        <SubmitButton className={btn.primary} pendingText="Guardando…">Guardar simulación</SubmitButton>
      </div>

      <aside className="h-fit rounded-2xl border border-[var(--ork-rule)] bg-white p-6 xl:sticky xl:top-40">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Precio de venta sugerido</p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-[var(--ork-purple)]">{cop(r.price)}</p>
        <dl className="mt-5 space-y-2 text-sm">
          {[
            ["Costo de productos", r.productsCost],
            [`Margen (${cfg.marginPct || 0} %)`, r.margin],
            ["Precio base", r.basePrice],
            ["Envío", r.shipping],
            ["Picking", r.picking],
            [`Comisión (${cfg.commissionPct || 0} %)`, r.commission],
            ["Total sin campaña", r.total],
            [`Campaña (${cfg.campaignPct || 0} %)`, r.campaign],
          ].map(([label, v], i) => (
            <div key={i} className={`flex justify-between gap-3 ${label === "Precio base" || label === "Total sin campaña" ? "border-t border-stone-100 pt-2 font-medium" : "text-stone-600"}`}>
              <dt>{label}</dt><dd className="tabular-nums">{cop(v as number)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-stone-500">Precio base = costo ÷ (1 − margen). Comisión y campaña se calculan sobre el precio base.</p>
      </aside>
    </ActionForm>
  );
}
