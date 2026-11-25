import type { ExecContext } from "@/lib/core/context";
import { ValidationError } from "./crm";
import { addActivity } from "@/lib/core/notify";

/**
 * Precios (traído de KLINIU): precios por paquete, historial de cambios de precio
 * y calculadora de precio de venta.
 */

const n = (v: unknown) => Number(v ?? 0);

// ───────── Precios por paquete ─────────

export async function addPackPrice(ctx: ExecContext, productId: string, d: { label: string; qty: number; totalPrice: number }) {
  const label = d.label.trim();
  if (!label) throw new ValidationError({ label: "Escribe el nombre del paquete, p. ej. Caja x12" });
  if (!Number.isInteger(d.qty) || d.qty < 2) throw new ValidationError({ qty: "El paquete debe tener 2 unidades o más" });
  if (!(d.totalPrice > 0)) throw new ValidationError({ totalPrice: "El precio del paquete debe ser mayor que cero" });
  await ctx.db.product.findUniqueOrThrow({ where: { id: productId } });
  const position = await ctx.db.productPackPrice.count({ where: { productId } });
  const pack = await ctx.db.productPackPrice.create({ data: { organizationId: ctx.orgId, productId, label, qty: d.qty, totalPrice: d.totalPrice, position } });
  await addActivity(ctx, "product", productId, `Precio por paquete agregado: ${label} (${d.qty} und)`, "TRACKING");
  return pack;
}

export async function removePackPrice(ctx: ExecContext, id: string) {
  const pack = await ctx.db.productPackPrice.findUniqueOrThrow({ where: { id } });
  await ctx.db.productPackPrice.delete({ where: { id } });
  await addActivity(ctx, "product", pack.productId, `Precio por paquete eliminado: ${pack.label}`, "TRACKING");
  return pack;
}

/** Paquetes con precio unitario y ahorro frente al precio de venta unitario. */
export async function packPrices(ctx: ExecContext, productId: string) {
  const [p, packs] = await Promise.all([
    ctx.db.product.findUniqueOrThrow({ where: { id: productId }, select: { price: true } }),
    ctx.db.productPackPrice.findMany({ where: { productId }, orderBy: [{ qty: "asc" }, { position: "asc" }] }),
  ]);
  return packs.map((k) => {
    const unit = n(k.totalPrice) / k.qty;
    const full = n(p.price) * k.qty;
    return { ...k, unitPrice: unit, savingsPct: full > 0 ? ((full - n(k.totalPrice)) / full) * 100 : 0 };
  });
}

/** Mejor precio para una cantidad: combina paquetes (de mayor a menor) y el resto a precio unitario. */
export function bestPriceFor(qty: number, unitPrice: number, packs: { qty: number; totalPrice: unknown }[]) {
  let left = Math.floor(qty), total = 0;
  for (const k of [...packs].sort((a, b) => b.qty - a.qty)) {
    if (n(k.totalPrice) / k.qty >= unitPrice) continue; // solo paquetes que salen más baratos
    const times = Math.floor(left / k.qty);
    total += times * n(k.totalPrice);
    left -= times * k.qty;
  }
  return total + left * unitPrice + (qty - Math.floor(qty)) * unitPrice;
}

// ───────── Historial de precios ─────────

export async function recordPriceChange(ctx: ExecContext, productId: string, oldPrice: unknown, newPrice: unknown, note?: string) {
  if (n(oldPrice) === n(newPrice)) return null;
  return ctx.db.productPriceChange.create({
    data: { organizationId: ctx.orgId, productId, oldPrice: n(oldPrice), newPrice: n(newPrice), userId: ctx.actorId ?? null, note: note || null },
  });
}

export async function priceHistory(ctx: ExecContext, productId: string, take = 30) {
  const rows = await ctx.db.productPriceChange.findMany({ where: { productId }, orderBy: { createdAt: "desc" }, take });
  const users = new Map((await ctx.db.user.findMany({ where: { id: { in: rows.map((r) => r.userId ?? "") } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return rows.map((r) => ({ ...r, userName: r.userId ? users.get(r.userId) ?? "—" : "Sistema", changePct: n(r.oldPrice) > 0 ? ((n(r.newPrice) - n(r.oldPrice)) / n(r.oldPrice)) * 100 : null }));
}

// ───────── Calculadora de precio de venta ─────────

export { simulate, MAX_PCT, type SimInput } from "@/lib/ui/price-calc";
import { MAX_PCT } from "@/lib/ui/price-calc";

type SimSave = { name: string; shipping: number; picking: number; commissionPct: number; campaignPct: number; marginPct: number; items: { productId?: string | null; name: string; quantity: number; unitCost: number }[] };

export async function saveSimulation(ctx: ExecContext, id: string | null, d: SimSave) {
  const name = d.name.trim() || "Nueva simulación";
  if ([d.commissionPct, d.campaignPct, d.marginPct].some((v) => !Number.isFinite(v) || v < 0 || v > MAX_PCT)) throw new ValidationError({ pct: "Los porcentajes van de 0 a 99,99" });
  const items = d.items
    .filter((i) => i.name.trim() && i.quantity > 0)
    .map((i, position) => ({ productId: i.productId || null, name: i.name.trim(), quantity: Math.round(i.quantity), unitCost: Math.max(0, i.unitCost), position }));
  const data = { name, shipping: Math.max(0, d.shipping), picking: Math.max(0, d.picking), commissionPct: d.commissionPct, campaignPct: d.campaignPct, marginPct: d.marginPct };
  if (id) {
    const own = await ctx.db.priceSimulation.findFirst({ where: { id, userId: ctx.actorId ?? "" } });
    if (!own) throw new ValidationError({ id: "Simulación no encontrada" });
    await ctx.db.priceSimulation.update({ where: { id }, data: { ...data, items: { deleteMany: {}, create: items } } });
    return id;
  }
  const sim = await ctx.db.priceSimulation.create({ data: { organizationId: ctx.orgId, userId: ctx.actorId!, ...data, items: { create: items } } });
  return sim.id;
}

export async function deleteSimulation(ctx: ExecContext, id: string) {
  await ctx.db.priceSimulation.deleteMany({ where: { id, userId: ctx.actorId ?? "" } });
}

export async function duplicateSimulation(ctx: ExecContext, id: string) {
  const s = await ctx.db.priceSimulation.findFirst({ where: { id, userId: ctx.actorId ?? "" }, include: { items: true } });
  if (!s) throw new ValidationError({ id: "Simulación no encontrada" });
  const copy = await ctx.db.priceSimulation.create({
    data: {
      organizationId: ctx.orgId, userId: s.userId, name: `${s.name} (copia)`, shipping: s.shipping, picking: s.picking,
      commissionPct: s.commissionPct, campaignPct: s.campaignPct, marginPct: s.marginPct,
      items: { create: s.items.map(({ productId, name, quantity, unitCost, position }) => ({ productId, name, quantity, unitCost, position })) },
    },
  });
  return copy.id;
}
