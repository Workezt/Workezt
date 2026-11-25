import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { Client } from "pg";
import { prisma } from "@/lib/core/prisma";
import { tenantDb, nextNumber } from "@/lib/core/db";
import type { ExecContext } from "@/lib/core/context";
import { createWarehouse, defaultWarehouse, operationType } from "@/lib/apps/stock";

/**
 * GEU: una bodega por unidad de negocio. Crea las bodegas (si faltan) y traslada a cada una
 * las existencias de sus productos desde la bodega principal, en una transferencia validada por unidad
 * (líneas, movimientos y cantidades por ubicación, en lote).
 * La unidad de cada producto se toma de la página de GEU (solo lectura).
 * Reanudable: solo traslada lo que siga en la bodega principal.
 * Uso: npx tsx --env-file=.env.workezt scripts/geu-split-warehouses.ts
 */
const UNITS = [
  { division: "Cauchos", code: "CAU", name: "Universal de Cauchos" },
  { division: "Import", code: "IMP", name: "GEU Import" },
  { division: "Plastic", code: "PLA", name: "GEU Plastic" },
  { division: "Energy", code: "ENE", name: "GEU Energy" },
];

function geuEnv() {
  const out: Record<string, string> = {};
  for (const l of readFileSync(`${homedir()}/Documents/GEU/.env.local`, "utf8").split("\n")) {
    const m = l.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  // Referencia → unidad, con la misma regla de la importación (medidas = productos propios)
  const src = new Client({ connectionString: geuEnv().DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await src.connect();
  await src.query("set default_transaction_read_only = on");
  const rows = (await src.query<{ sku: string; division: string }>(`
    select coalesce(nullif(p.sku, ''), p.slug) sku, p.division from "Product" p
    where not exists (select 1 from "ProductVariant" v where v."productId" = p.id)
    union all
    select v.sku, p.division from "ProductVariant" v join "Product" p on p.id = v."productId"`)).rows;
  await src.end();
  const unitOf = new Map(rows.map((r) => [r.sku, r.division]));

  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "geu" } });
  const ctx = { orgId: org.id, db: tenantDb(org.id), actorId: null } as ExecContext;
  const main = await defaultWarehouse(ctx);
  const fromLoc = main.stockLocationId!;

  const quants = await ctx.db.stockQuant.findMany({ where: { locationId: fromLoc, quantity: { gt: 0 } }, include: { product: { select: { sku: true } } } });

  for (const u of UNITS) {
    const wh = (await ctx.db.warehouse.findFirst({ where: { code: u.code } })) ?? (await createWarehouse(ctx, { code: u.code, name: u.name }));
    const toLoc = wh.stockLocationId!;
    const lines = quants.filter((q) => unitOf.get(q.product.sku) === u.division).map((q) => ({ productId: q.productId, quantity: Number(q.quantity) }));
    if (!lines.length) { console.log(`${u.code}: nada que trasladar`); continue; }

    const op = await operationType(ctx, wh.id, "INTERNAL");
    const origin = `Traslado a bodega de ${u.name}`;
    const now = new Date();
    await ctx.db.$transaction(async (tx) => {
      const t = await tx.transfer.create({
        data: {
          organizationId: org.id, number: await nextNumber(ctx.db, org.id, op.prefix), operationTypeId: op.id,
          srcLocationId: fromLoc, destLocationId: toLoc, status: "done", doneAt: now, origin, sourceType: "adjustment",
        },
      });
      for (let i = 0; i < lines.length; i += 1000) {
        const chunk = lines.slice(i, i + 1000);
        await tx.transferLine.createMany({ data: chunk.map((l) => ({ transferId: t.id, productId: l.productId, quantity: l.quantity, doneQty: l.quantity })) });
        await tx.stockMovement.createMany({
          data: chunk.map((l) => ({ organizationId: org.id, productId: l.productId, type: "INTERNAL", quantity: l.quantity, fromLocationId: fromLoc, toLocationId: toLoc, transferId: t.id, reference: origin, createdAt: now })),
        });
        await tx.stockQuant.createMany({ data: chunk.map((l) => ({ organizationId: org.id, productId: l.productId, locationId: toLoc, quantity: l.quantity })) });
      }
      // Sale de la principal (todo el saldo de esos productos)
      await tx.stockQuant.deleteMany({ where: { locationId: fromLoc, productId: { in: lines.map((l) => l.productId) } } });
      console.log(`✔ ${u.code} · ${u.name}: ${t.number} · ${lines.length} productos · ${lines.reduce((a, l) => a + l.quantity, 0)} unidades`);
    }, { timeout: 120_000 });
  }

  const left = await ctx.db.stockQuant.aggregate({ where: { locationId: fromLoc }, _sum: { quantity: true }, _count: true });
  console.log(`Bodega principal: quedan ${left._count} registros · ${Number(left._sum.quantity ?? 0)} unidades`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
