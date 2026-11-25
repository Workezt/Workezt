import "dotenv/config";
import { prisma } from "@/lib/core/prisma";
import { tenantDb } from "@/lib/core/db";
import type { ExecContext } from "@/lib/core/context";
import { createProduct } from "@/lib/apps/inventory";
import { addComboItem, comboDetail, listCombos, removeComboItem } from "@/lib/apps/combos";
import { findBom } from "@/lib/apps/manufacturing";

/** Prueba de combos (kit con precio propio). Uso: npx tsx scripts/test-combos.ts (base local de .env) */
let fails = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "✔" : "✘"} ${m}`); if (!c) fails++; };

async function main() {
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "demo" } });
  const admin = await prisma.membership.findFirstOrThrow({ where: { organizationId: org.id } });
  const ctx = { orgId: org.id, db: tenantDb(org.id), actorId: admin.userId } as ExecContext;
  const t = Date.now();
  const a = await createProduct(ctx, { sku: `TC-A-${t}`, name: "Dispensador", price: 30000, cost: 18000, stock: 10 });
  const b = await createProduct(ctx, { sku: `TC-B-${t}`, name: "Repuesto", price: 5000, cost: 2000, stock: 7 });
  const svc = await createProduct(ctx, { sku: `TC-S-${t}`, name: "Instalación", price: 10000, kind: "SERVICE" });
  const combo = await createProduct(ctx, { sku: `TC-C-${t}`, name: "Combo prueba", price: 36000, kind: "COMBO" });

  await addComboItem(ctx, combo.id, a.id, 1);
  await addComboItem(ctx, combo.id, b.id, 2);
  await addComboItem(ctx, combo.id, b.id, 1); // suma a la línea existente
  let d = await comboDetail(ctx, combo.id);
  ok(d.items.length === 2 && d.items.find((i) => i.productId === b.id)?.quantity === 3, "agregar dos veces el mismo producto suma la cantidad");
  ok(d.normalPrice === 45000 && d.savings === 9000 && Math.abs(d.savingsPct - 20) < 0.01, "precio normal 45.000, combo 36.000, ahorro 20 %");
  ok(d.cost === 24000 && Math.abs(d.marginPct - 33.33) < 0.01, "costo 24.000 y margen 33,3 %");
  ok(d.buildable === 2, "se pueden armar 2 (repuesto: 7 ÷ 3)");
  ok((await findBom(ctx, combo.id, "KIT"))?.type === "KIT", "queda como lista de materiales tipo KIT (se explota al despachar)");

  const reject = async (f: () => Promise<unknown>) => { try { await f(); return false; } catch { return true; } };
  ok(await reject(() => addComboItem(ctx, combo.id, combo.id, 1)), "rechaza incluirse a sí mismo");
  ok(await reject(() => addComboItem(ctx, combo.id, svc.id, 1)), "rechaza servicios");
  ok(await reject(() => addComboItem(ctx, a.id, b.id, 1)), "rechaza agregar a un producto que no es combo");
  ok((await listCombos(ctx)).some((c) => c.combo.id === combo.id), "aparece en la lista de combos");

  await removeComboItem(ctx, combo.id, d.items.find((i) => i.productId === b.id)!.lineId);
  d = await comboDetail(ctx, combo.id);
  ok(d.items.length === 1 && d.buildable === 10, "quitar producto: queda 1 y se pueden armar 10");

  const bom = await findBom(ctx, combo.id, "KIT");
  if (bom) await ctx.db.bom.delete({ where: { id: bom.id } });
  await ctx.db.stockMovement.deleteMany({ where: { productId: { in: [a.id, b.id] } } });
  await ctx.db.stockQuant.deleteMany({ where: { productId: { in: [a.id, b.id] } } });
  await ctx.db.product.deleteMany({ where: { id: { in: [a.id, b.id, svc.id, combo.id] } } });
  console.log(fails ? `\n${fails} prueba(s) fallaron` : "\nTodo bien");
  if (fails) process.exitCode = 1;
}
main().finally(() => prisma.$disconnect());
