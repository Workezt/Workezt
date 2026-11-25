import type { ExecContext } from "@/lib/core/context";
import { ValidationError } from "./crm";
import { addActivity } from "@/lib/core/notify";

/**
 * Combos (traído de KLINIU), sobre el modelo de Workezt: un combo es un producto tipo "Kit / combo"
 * cuyos componentes viven en su lista de materiales tipo KIT. Al despachar la venta salen los
 * componentes del inventario (sales-orders ya explota los kits). Aquí se arma desde la ficha del
 * producto, sin pasar por Manufactura, y se calculan precio normal, ahorro y unidades armables.
 */
const n = (v: unknown) => Number(v ?? 0);

async function kitBom(ctx: ExecContext, comboId: string, create = false) {
  const found = await ctx.db.bom.findFirst({ where: { productId: comboId, type: "KIT", active: true }, include: { lines: true } });
  if (found || !create) return found;
  return ctx.db.bom.create({ data: { organizationId: ctx.orgId, productId: comboId, type: "KIT", quantity: 1, code: "COMBO" }, include: { lines: true } });
}

/** Componentes con precio, costo y existencia; precio normal, ahorro y cuántos combos se pueden armar. */
export async function comboDetail(ctx: ExecContext, comboId: string) {
  const combo = await ctx.db.product.findUniqueOrThrow({ where: { id: comboId } });
  const bom = await kitBom(ctx, comboId);
  const per = n(bom?.quantity) || 1;
  const parts = bom?.lines.length ? await ctx.db.product.findMany({ where: { id: { in: bom.lines.map((l) => l.componentId) } } }) : [];
  const byId = new Map(parts.map((p) => [p.id, p]));
  const items = (bom?.lines ?? []).map((l) => {
    const p = byId.get(l.componentId);
    const qty = n(l.quantity) / per;
    return { lineId: l.id, productId: l.componentId, sku: p?.sku ?? "", name: p?.name ?? "Producto eliminado", unit: p?.unit ?? "UND", quantity: qty, price: n(p?.price), cost: n(p?.cost), stock: n(p?.stock) };
  });
  const normalPrice = items.reduce((a, i) => a + i.price * i.quantity, 0);
  const cost = items.reduce((a, i) => a + i.cost * i.quantity, 0);
  const comboPrice = n(combo.price);
  const buildable = items.length ? Math.max(0, Math.min(...items.map((i) => (i.quantity > 0 ? Math.floor(i.stock / i.quantity) : Infinity)))) : 0;
  return {
    combo, items, normalPrice, cost, comboPrice,
    savings: normalPrice - comboPrice, savingsPct: normalPrice > 0 ? ((normalPrice - comboPrice) / normalPrice) * 100 : 0,
    marginPct: comboPrice > 0 ? ((comboPrice - cost) / comboPrice) * 100 : 0,
    buildable: Number.isFinite(buildable) ? buildable : 0,
  };
}

export async function addComboItem(ctx: ExecContext, comboId: string, componentId: string, quantity: number) {
  if (!(quantity > 0)) throw new ValidationError({ quantity: "La cantidad debe ser mayor que cero" });
  if (componentId === comboId) throw new ValidationError({ componentId: "Un combo no puede incluirse a sí mismo" });
  const [combo, part] = await Promise.all([
    ctx.db.product.findUniqueOrThrow({ where: { id: comboId } }),
    ctx.db.product.findUnique({ where: { id: componentId } }),
  ]);
  if (combo.kind !== "COMBO") throw new ValidationError({ kind: "Cambia el tipo del producto a «Kit / combo» y guarda antes de agregar productos" });
  if (!part) throw new ValidationError({ componentId: "Elige un producto de la lista" });
  if (part.kind !== "GOODS") throw new ValidationError({ componentId: "Solo se incluyen productos con inventario" });
  const bom = (await kitBom(ctx, comboId, true))!;
  const per = n(bom.quantity) || 1;
  const existing = bom.lines.find((l) => l.componentId === componentId);
  if (existing) await ctx.db.bomLine.update({ where: { id: existing.id }, data: { quantity: n(existing.quantity) + quantity * per } });
  else await ctx.db.bomLine.create({ data: { bomId: bom.id, componentId, quantity: quantity * per } });
  await addActivity(ctx, "product", comboId, `Combo: ${quantity} × ${part.name}`, "TRACKING");
}

export async function removeComboItem(ctx: ExecContext, comboId: string, lineId: string) {
  const bom = await kitBom(ctx, comboId);
  const line = bom?.lines.find((l) => l.id === lineId);
  if (!line) throw new ValidationError({ lineId: "Ese producto ya no está en el combo" });
  await ctx.db.bomLine.delete({ where: { id: line.id } });
  const part = await ctx.db.product.findUnique({ where: { id: line.componentId }, select: { name: true } });
  await addActivity(ctx, "product", comboId, `Combo: se quitó ${part?.name ?? "un producto"}`, "TRACKING");
}

/** Todos los combos con sus números, para la vista de Combos en Productos. */
export async function listCombos(ctx: ExecContext) {
  const combos = await ctx.db.product.findMany({ where: { kind: "COMBO" }, orderBy: { name: "asc" }, select: { id: true } });
  return Promise.all(combos.map((c) => comboDetail(ctx, c.id)));
}
