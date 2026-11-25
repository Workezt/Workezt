import "dotenv/config";
import { prisma } from "@/lib/core/prisma";
import { tenantDb } from "@/lib/core/db";
import type { ExecContext } from "@/lib/core/context";
import { createProduct, updateProduct } from "@/lib/apps/inventory";
import { addPackPrice, bestPriceFor, deleteSimulation, duplicateSimulation, packPrices, priceHistory, removePackPrice, saveSimulation, simulate } from "@/lib/apps/pricing";

/** Prueba de precios por paquete, historial de precios y calculadora. Uso: npx tsx scripts/test-pricing.ts (base local de .env) */
let fails = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "✔" : "✘"} ${m}`); if (!c) fails++; };

async function main() {
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "demo" } });
  const admin = await prisma.membership.findFirstOrThrow({ where: { organizationId: org.id } });
  const ctx = { orgId: org.id, db: tenantDb(org.id), actorId: admin.userId } as ExecContext;
  const sku = `TEST-PRC-${Date.now()}`;
  const p = await createProduct(ctx, { sku, name: "Producto prueba precios", price: 10000, cost: 6000 });

  const caja = await addPackPrice(ctx, p.id, { label: "Caja x12", qty: 12, totalPrice: 96000 });
  await addPackPrice(ctx, p.id, { label: "Par", qty: 2, totalPrice: 19000 });
  const packs = await packPrices(ctx, p.id);
  ok(packs.length === 2 && packs[0].label === "Par", "paquetes ordenados por cantidad");
  ok(Math.abs(packs[1].unitPrice - 8000) < 0.01 && Math.abs(packs[1].savingsPct - 20) < 0.01, "caja x12: $8.000 c/u, ahorro 20 %");
  ok(bestPriceFor(15, 10000, packs) === 96000 + 19000 + 10000, "15 und = caja x12 + par + 1 suelta = $125.000");
  let bad = false; try { await addPackPrice(ctx, p.id, { label: "x", qty: 1, totalPrice: 5 }); } catch { bad = true; }
  ok(bad, "rechaza paquete de 1 unidad");

  await updateProduct(ctx, p.id, { sku, name: p.name, price: 11000, cost: 6000 });
  await updateProduct(ctx, p.id, { sku, name: p.name, price: 11000, cost: 6500 });
  const h = await priceHistory(ctx, p.id);
  ok(h.length === 1 && Number(h[0].oldPrice) === 10000 && Number(h[0].newPrice) === 11000 && Math.abs((h[0].changePct ?? 0) - 10) < 0.01, "historial: 10.000 → 11.000 (+10 %), cambiar costo no cuenta");

  // Misma fórmula de KLINIU: costo 40.000, margen 25 % → base 53.333; comisión 2,5 % y campaña 10 % sobre la base
  const r = simulate({ shipping: 8000, picking: 2000, commissionPct: 2.5, campaignPct: 10, marginPct: 25, items: [{ quantity: 2, unitCost: 20000 }] });
  const base = 40000 / 0.75;
  ok(Math.abs(r.basePrice - base) < 0.01 && Math.abs(r.total - (base + 10000 + base * 0.025)) < 0.01 && Math.abs(r.price - (r.total + base * 0.1)) < 0.01, `calculadora: precio final ${Math.round(r.price)}`);
  ok(Number.isFinite(simulate({ shipping: 0, picking: 0, commissionPct: 0, campaignPct: 0, marginPct: 100, items: [{ quantity: 1, unitCost: 1 }] }).price), "calculadora: margen 100 % se limita a 99,99 %");

  const simId = await saveSimulation(ctx, null, { name: "Sim prueba", shipping: 8000, picking: 2000, commissionPct: 2.5, campaignPct: 10, marginPct: 25, items: [{ productId: p.id, name: "x", quantity: 2, unitCost: 20000 }] });
  const dupId = await duplicateSimulation(ctx, simId);
  const dup = await ctx.db.priceSimulation.findUniqueOrThrow({ where: { id: dupId }, include: { items: true } });
  ok(dup.name === "Sim prueba (copia)" && dup.items.length === 1 && Number(dup.items[0].unitCost) === 20000, "guardar y duplicar simulación");
  const other = { ...ctx, actorId: "otro-usuario" } as ExecContext;
  let denied = false; try { await duplicateSimulation(other, simId); } catch { denied = true; }
  ok(denied, "otro usuario no puede abrir mi simulación");
  await deleteSimulation(ctx, simId); await deleteSimulation(ctx, dupId);
  ok((await ctx.db.priceSimulation.count({ where: { id: { in: [simId, dupId] } } })) === 0, "eliminar simulaciones");

  await removePackPrice(ctx, caja.id);
  ok((await packPrices(ctx, p.id)).length === 1, "eliminar paquete");

  await ctx.db.productPackPrice.deleteMany({ where: { productId: p.id } });
  await ctx.db.productPriceChange.deleteMany({ where: { productId: p.id } });
  await ctx.db.product.delete({ where: { id: p.id } });
  console.log(fails ? `\n${fails} prueba(s) fallaron` : "\nTodo bien");
  if (fails) process.exitCode = 1;
}
main().finally(() => prisma.$disconnect());
