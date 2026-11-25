import { requireModule } from "@/lib/core/context";
import { PageHeader } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { campaignScope } from "@/lib/apps/campaigns";
import { marketingMetrics } from "@/lib/apps/marketing-metrics";
import { money, num } from "@/lib/ui/format";

export const metadata = { title: "Métricas de marketing" };

const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(0)} %`);
const tone = (v: number | null) => (v === null ? "text-stone-500" : v > 0 ? "text-emerald-600" : v < 0 ? "text-rose-600" : "text-stone-500");
const MEDAL = ["#F59E0B", "#94A3B8", "#CD7F32"];

/** Métricas de marketing (Panel Comercial de KLINIU): ventas, pedidos, ticket, clientes, tendencia y ranking con ROAS. */
export default async function MarketingMetrics() {
  const ctx = await requireModule("campaigns", "campaigns.read");
  const scope = await campaignScope(ctx);
  const m = await marketingMetrics(ctx, scope);
  const cur = scope.currency;

  return (
    <>
      <PageHeader title="Métricas de marketing" subtitle={scope.own ? "Tus ventas y campañas." : "Ventas de pedidos (sin cancelados) y rendimiento de las campañas de cada vendedor."} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Ventas del mes", value: money(m.month.total, cur), extra: <span className={tone(m.month.growthPct)}>{pct(m.month.growthPct)} vs. mes anterior</span> },
          { label: "Pedidos del mes", value: num(m.month.orders) },
          { label: "Ticket promedio", value: money(m.month.avgTicket, cur) },
          { label: "Clientes únicos", value: num(m.month.customers) },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-[var(--ork-rule)] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{k.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--ork-purple)]">{k.value}</p>
            {k.extra && <p className="mt-1 text-xs">{k.extra}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--ork-rule)] bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-stone-700">Ventas últimos 6 meses</h2>
          <BarChart labels={m.monthly.map((x) => x.label)} series={[{ name: "Ventas", color: "var(--ork-violet)", values: m.monthly.map((x) => x.total) }]} format="money" height={260} />
          <div className="mt-3 grid grid-cols-6 gap-1 text-center text-xs">
            {m.monthly.map((x) => (
              <div key={x.key}><p className="capitalize text-stone-500">{x.label}</p><p className={`font-semibold ${tone(x.growthPct)}`}>{pct(x.growthPct)}</p></div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--ork-rule)] bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-stone-700">Ranking de vendedores · 6 meses</h2>
          {m.ranking.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-500">Aún no hay pedidos con vendedor ni campañas. Asigna el vendedor en el pedido o en la campaña.</p>
          ) : (
            <ol className="space-y-2">
              {m.ranking.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 rounded-xl border border-stone-100 p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: MEDAL[i] ?? "#CBD5E1" }}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <p className="text-xs text-stone-500">{num(s.orders)} pedidos · {num(s.campaigns)} campañas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-emerald-600">{money(s.sales, cur)}</p>
                    <p className="text-xs text-stone-500" title="Ventas de campañas ÷ inversión en pauta (en pesos con la TRM)">{s.investment > 0 ? `ROAS ×${s.roas.toFixed(1)}` : "Sin pauta"}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
