import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { Client } from "pg";
import { prisma } from "@/lib/core/prisma";
import { tenantDb } from "@/lib/core/db";
import type { ExecContext } from "@/lib/core/context";
import { nextNumber } from "@/lib/core/db";
import { defaultWarehouse, operationType, virtualLocation } from "@/lib/apps/stock";

/**
 * Trae el inventario de una unidad de GEU (Cauchos, Import, Plastic, Energy) desde la base de la página (solo lectura)
 * a la empresa GEU de Workezt.
 * - Productos sin medidas → un producto.
 * - Productos con medidas (variantes) → un producto por medida; el padre no se crea
 *   (su existencia es la suma de las medidas, así no se cuenta doble).
 * Carga en lote (como el importador de Odoo), porque producto por producto contra la base en la nube
 * tardaría horas:
 * 1) Crea los productos que falten.
 * 2) Registra las existencias como UNA transferencia validada "Inventario inicial" (ajuste) con sus
 *    líneas, movimientos y cantidades por ubicación; solo por la diferencia con lo que ya haya,
 *    así se puede volver a correr sin duplicar.
 * Uso: npx tsx --env-file=.env.workezt scripts/import-geu-inventory.ts [Cauchos|Import|Plastic|Energy]
 */
const DIVISION = process.argv[2] ?? "Cauchos";
const UNIT_NAME: Record<string, string> = { Cauchos: "Universal de Cauchos", Import: "GEU Import", Plastic: "GEU Plastic", Energy: "GEU Energy" };
if (!UNIT_NAME[DIVISION]) throw new Error(`Unidad desconocida: ${DIVISION}`);

type Src = { id: string; sku: string | null; slug: string; name: string; category: string; price: number; stock: number; minimumStock: number; active: boolean };
type Var = { productId: string; label: string; sku: string; price: number | null; stock: number };

function geuEnv() {
  const out: Record<string, string> = {};
  for (const l of readFileSync(`${homedir()}/Documents/GEU/.env.local`, "utf8").split("\n")) {
    const m = l.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const src = new Client({ connectionString: geuEnv().DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await src.connect();
  await src.query("set default_transaction_read_only = on");
  const products = (await src.query<Src>(`select id, sku, slug, name, category, price, stock, "minimumStock", active from "Product" where division = $1 order by name`, [DIVISION])).rows;
  const variants = (await src.query<Var>(`select v."productId", v.label, v.sku, v.price, v.stock from "ProductVariant" v join "Product" p on p.id = v."productId" where p.division = $1 order by v.sku`, [DIVISION])).rows;
  await src.end();

  const byParent = new Map<string, Var[]>();
  for (const v of variants) byParent.set(v.productId, [...(byParent.get(v.productId) ?? []), v]);

  const rows: { sku: string; name: string; category: string; price: number; stock: number; minStock: number }[] = [];
  for (const p of products) {
    const vs = byParent.get(p.id);
    if (!vs) {
      rows.push({ sku: p.sku || p.slug, name: p.name, category: p.category, price: p.price, stock: p.stock, minStock: p.minimumStock });
    } else {
      for (const v of vs) rows.push({ sku: v.sku, name: `${p.name} · ${v.label}`, category: p.category, price: v.price ?? p.price, stock: v.stock, minStock: p.minimumStock });
    }
  }

  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "geu" } });
  const ctx = { orgId: org.id, db: tenantDb(org.id), actorId: null } as ExecContext;
  const existing = new Set((await ctx.db.product.findMany({ select: { sku: true } })).map((p) => p.sku));

  // 1) Productos que faltan
  const todo = rows.filter((r) => !existing.has(r.sku));
  for (let i = 0; i < todo.length; i += 1000) {
    await ctx.db.product.createMany({
      data: todo.slice(i, i + 1000).map((r) => ({
        organizationId: org.id, sku: r.sku, name: r.name, category: r.category, unit: "UND", price: r.price, cost: 0,
        stock: 0, minStock: r.minStock, kind: "GOODS", customFields: {},
      })),
    });
  }
  console.log(`✔ productos: ${todo.length} creados · ${rows.length - todo.length} ya existían`);

  // 2) Existencias: una transferencia de ajuste "Inventario inicial" por la diferencia
  const wh = await defaultWarehouse(ctx);
  const stockLoc = wh.stockLocationId!;
  const target = new Map(rows.map((r) => [r.sku, r.stock]));
  const mine = new Set(rows.map((r) => r.sku));
  const prods = (await ctx.db.product.findMany({ select: { id: true, sku: true } })).filter((p) => mine.has(p.sku));
  // Comparar contra la existencia TOTAL del producto (puede estar ya en la bodega de su unidad)
  const totals = new Map((await ctx.db.product.findMany({ select: { id: true, stock: true } })).map((p) => [p.id, Number(p.stock)]));
  const quants = new Map((await ctx.db.stockQuant.findMany({ where: { locationId: stockLoc } })).map((q) => [q.productId, Number(q.quantity)]));
  const lines = prods
    .map((p) => ({ productId: p.id, quantity: (target.get(p.sku) ?? 0) - (totals.get(p.id) ?? 0) }))
    .filter((l) => l.quantity > 0);
  if (lines.length) {
    const adj = await virtualLocation(ctx, "ADJUSTMENT");
    const op = await operationType(ctx, wh.id, "INTERNAL");
    const origin = `Inventario inicial · ${UNIT_NAME[DIVISION]}`;
    const now = new Date();
    const t = await ctx.db.transfer.create({
      data: {
        organizationId: org.id, number: await nextNumber(ctx.db, org.id, op.prefix), operationTypeId: op.id,
        srcLocationId: adj.id, destLocationId: stockLoc, status: "done", doneAt: now, origin, sourceType: "adjustment",
      },
    });
    for (let i = 0; i < lines.length; i += 1000) {
      const chunk = lines.slice(i, i + 1000);
      await ctx.db.transferLine.createMany({ data: chunk.map((l) => ({ transferId: t.id, productId: l.productId, quantity: l.quantity, doneQty: l.quantity })) });
      await ctx.db.stockMovement.createMany({
        data: chunk.map((l) => ({ organizationId: org.id, productId: l.productId, type: "ADJUST", quantity: l.quantity, fromLocationId: adj.id, toLocationId: stockLoc, transferId: t.id, reference: origin, createdAt: now })),
      });
      const fresh = chunk.filter((l) => !quants.has(l.productId));
      if (fresh.length) await ctx.db.stockQuant.createMany({ data: fresh.map((l) => ({ organizationId: org.id, productId: l.productId, locationId: stockLoc, quantity: l.quantity })) });
      for (const l of chunk.filter((x) => quants.has(x.productId))) {
        await ctx.db.stockQuant.update({ where: { productId_locationId: { productId: l.productId, locationId: stockLoc } }, data: { quantity: { increment: l.quantity } } });
      }
    }
    console.log(`✔ ajuste ${t.number}: ${lines.length} líneas`);
  }
  // Caché de existencia del producto = suma en ubicaciones internas
  await prisma.$executeRaw`
    update "Product" p set stock = coalesce(q.total, 0)
    from (select p2.id, sum(sq.quantity) total from "Product" p2
          left join "StockQuant" sq on sq."productId" = p2.id
          left join "Location" l on l.id = sq."locationId" and l.kind = 'INTERNAL'
          where p2."organizationId" = ${org.id} group by p2.id) q
    where p.id = q.id`;
  const total = await ctx.db.product.aggregate({ _sum: { stock: true }, _count: true });
  console.log(`✔ total en GEU: ${total._count} productos · ${Number(total._sum.stock)} unidades`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
