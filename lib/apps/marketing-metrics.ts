import type { ExecContext } from "@/lib/core/context";
import { prisma } from "@/lib/core/prisma";
import { calcROAS } from "./campaign-calc";
import { listCampaigns, type CampaignScope } from "./campaigns";

/**
 * Métricas de marketing (traídas del "Panel Comercial" de KLINIU): ventas del mes, pedidos,
 * ticket promedio, clientes únicos, ventas de los últimos 6 meses con su crecimiento y
 * ranking de vendedores con el ROAS de sus campañas.
 * Ventas = pedidos de venta no cancelados. Si el rol solo ve lo suyo, todo se limita al vendedor.
 */
const n = (v: unknown) => Number(v ?? 0);
const MONTHS = 6;

/** "2026-11" en la zona horaria de la organización. */
const monthKey = (d: Date, tz: string) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`;
};
const shiftKey = (key: string, delta: number) => {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};
const label = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" }).replace(".", "");
};

export async function marketingMetrics(ctx: ExecContext, s: CampaignScope, now = new Date()) {
  const thisKey = monthKey(now, s.tz);
  const keys = Array.from({ length: MONTHS }, (_, i) => shiftKey(thisKey, i - (MONTHS - 1)));
  // Margen de un día para cubrir la diferencia de zona horaria; luego se agrupa por mes local
  const [fy, fm] = keys[0].split("-").map(Number);
  const from = new Date(Date.UTC(fy, fm - 1, 1) - 86400000);

  const [orders, campaigns] = await Promise.all([
    ctx.db.salesOrder.findMany({
      where: { status: { not: "canceled" }, createdAt: { gte: from }, ...(s.own ? { ownerId: s.userId } : {}) },
      select: { total: true, customerId: true, ownerId: true, createdAt: true },
    }),
    listCampaigns(ctx, s),
  ]);

  const byMonth = new Map(keys.map((k) => [k, { total: 0, count: 0 }]));
  const customersThisMonth = new Set<string>();
  const sellerSales = new Map<string, { sales: number; orders: number }>();
  for (const o of orders) {
    const k = monthKey(o.createdAt, s.tz);
    const m = byMonth.get(k);
    if (!m) continue;
    m.total += n(o.total);
    m.count++;
    if (k === thisKey) customersThisMonth.add(o.customerId);
    if (o.ownerId) {
      const a = sellerSales.get(o.ownerId) ?? { sales: 0, orders: 0 };
      a.sales += n(o.total); a.orders++;
      sellerSales.set(o.ownerId, a);
    }
  }
  const monthly = keys.map((k, i) => {
    const m = byMonth.get(k)!;
    const prev = i > 0 ? byMonth.get(keys[i - 1])!.total : 0;
    return { key: k, label: label(k), total: m.total, count: m.count, growthPct: i > 0 && prev > 0 ? ((m.total - prev) / prev) * 100 : null };
  });
  const cur = byMonth.get(thisKey)!, prev = byMonth.get(keys[MONTHS - 2])!;

  // Inversión y ventas de campañas por vendedor (la misma regla de la app Campañas)
  const sellerCampaign = new Map<string, { campaignSales: number; investment: number; campaigns: number }>();
  for (const c of campaigns) {
    const sales = c.daily.days > 0 ? c.daily.sales : c.sales;
    const invUsd = c.daily.days > 0 ? c.daily.investmentUsd : c.investment;
    const a = sellerCampaign.get(c.seller.id) ?? { campaignSales: 0, investment: 0, campaigns: 0 };
    a.campaignSales += sales; a.investment += invUsd * (c.trm || 0); a.campaigns++;
    sellerCampaign.set(c.seller.id, a);
  }
  const ids = [...new Set([...sellerSales.keys(), ...sellerCampaign.keys()])];
  const users = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]));
  const ranking = ids
    .map((id) => {
      const o = sellerSales.get(id) ?? { sales: 0, orders: 0 };
      const c = sellerCampaign.get(id) ?? { campaignSales: 0, investment: 0, campaigns: 0 };
      return { id, name: users.get(id)?.name ?? "—", email: users.get(id)?.email ?? "", sales: o.sales, orders: o.orders, ...c, roas: calcROAS(c.campaignSales, c.investment) };
    })
    .sort((a, b) => b.sales - a.sales || b.campaignSales - a.campaignSales);

  return {
    month: { total: cur.total, orders: cur.count, avgTicket: cur.count ? cur.total / cur.count : 0, customers: customersThisMonth.size, growthPct: prev.total > 0 ? ((cur.total - prev.total) / prev.total) * 100 : null },
    monthly,
    ranking,
  };
}
