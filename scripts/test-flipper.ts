import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "@/lib/core/prisma";
import { tenantDb } from "@/lib/core/db";
import { hasPermission } from "@/lib/core/permissions";
import type { OrgContext } from "@/lib/core/context";
import { E, P } from "@/lib/apps/flipper/engine";
import { loadFlipper, syncFlipper } from "@/lib/apps/flipper/server";

/**
 * Flipper: cálculos del motor (iguales al OR-K Flipper original), guardado por bloques con sus permisos,
 * información interna que no sale para quien no la puede ver, consecutivo y aislamiento entre empresas.
 * Usa dos empresas temporales que borra al final.
 */
let ok = 0;
const check = (name: string) => { ok++; console.log(`✓ ${name}`); };

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakeCtx(orgId: string, userId: string, perms: string[]): OrgContext {
  return {
    orgId, db: tenantDb(orgId), actorId: userId,
    user: { id: userId, name: "Prueba", email: "prueba@flipper.test", isPlatformAdmin: false },
    org: { id: orgId, name: "Empresa prueba", branding: {} },
    can: (p: string) => hasPermission(perms, p),
  } as unknown as OrgContext;
}

function engine() {
  const st = E.defaultState();
  const c = E.demoClient(); st.clients.push(c);
  const b = c.brands.map((x: any) => x.id);
  const cap = (id: string) => st.catalog.find((x: any) => x.id === id);

  // Dos capacidades completas → combinación −8% sobre $8.800.000
  const q = E.newQuote(st, c);
  E.newLine(q, cap("cap_tech"), { mode: "shared", brandIds: b });
  E.newLine(q, cap("cap_design"), { mode: "shared", brandIds: b });
  let t = E.computeTotals(q);
  assert.equal(t.services, 8_800_000); assert.equal(t.combo.amount, 704_000); assert.equal(t.net, 8_096_000);
  assert.equal(t.iva, 1_538_240); assert.equal(t.totalServices, 9_634_240);
  check("2 capacidades: combinación −8% e IVA 19% exactos");

  // Las 4 capacidades → paquete completo −20%
  E.newLine(q, cap("cap_community"), { mode: "exclusive", brandIds: [b[0]] });
  E.newLine(q, cap("cap_marketing"), { mode: "exclusive", brandIds: [b[1]] });
  t = E.computeTotals(q);
  assert.equal(t.services, 17_600_000); assert.equal(t.combo.amount, 3_520_000); assert.equal(t.net, 14_080_000);
  check("4 capacidades: oferta paquete completo −20%");

  // Personalizar saca la línea de la combinación (−3 → 3 capacidades = −12%)
  q.lines[0].adjust = { hours: -8 };
  t = E.computeTotals(q);
  assert.ok(t.lines[0].adjustAmt < 0 && t.combo.amount < 3_520_000 && t.combo.currentPct === 12);
  check("Personalizar una capacidad la saca de la combinación (queda −12%)");
  q.lines[0].adjust = {};

  // 2.ª unidad de la misma capacidad → volumen 10% si es mayor que la combinación aplicable
  const v = E.newQuote(st, c);
  const l = E.newLine(v, cap("cap_tech"), { mode: "shared", brandIds: b }); l.qty = 2;
  t = E.computeTotals(v);
  assert.equal(t.volume.amount, 500_000); assert.equal(t.combo.amount, 0);
  check("Descuento por volumen: 2.ª unidad −10%");

  // Capacidad: no se puede asignar más de lo contratado
  const d = E.newQuote(st, c);
  const dl = E.newLine(d, cap("cap_design"), { mode: "shared", brandIds: b });
  dl.alloc = { [b[0]]: { pieces: 11 } };
  assert.ok(E.validateQuote(d).errors.some((e: any) => e.code === "over"));
  check("Asignar más piezas de las contratadas es un error de validación");

  // Distribución por consumo suma exacto el valor neto
  dl.alloc = { [b[0]]: { pieces: 5 }, [b[1]]: { pieces: 5, catalog: 1 } };
  const dist = E.computeDistribution(d);
  const sum = dist.byLine[0].perBrand.reduce((a: number, x: any) => a + x.value, 0) + dist.byLine[0].unassigned;
  assert.equal(sum, dist.byLine[0].net);
  check("Reparto por marca: pesos enteros que suman exactamente el neto");

  // La propuesta para el cliente no lleva costos ni notas privadas
  d.privateNotes = "NOTA-SECRETA-123";
  st.settings.team = E.defaultTeam();
  const html: string = P.render(d, st.settings);
  assert.ok(!html.includes("NOTA-SECRETA-123") && !html.includes("Desarrollador junior"));
  check("La propuesta exportada no contiene notas privadas ni equipo");
  return { st, q };
}

async function persistence(sample: { st: any; q: any }) {
  const stamp = Date.now().toString(36);
  const A = await prisma.organization.create({ data: { name: `Flipper A ${stamp}`, slug: `flip-a-${stamp}` } });
  const B = await prisma.organization.create({ data: { name: `Flipper B ${stamp}`, slug: `flip-b-${stamp}` } });
  const user = await prisma.user.findFirstOrThrow();
  try {
    const admin = fakeCtx(A.id, user.id, ["flipper.*"]);
    const seller = fakeCtx(A.id, user.id, ["flipper.read", "flipper.write"]);
    const viewer = fakeCtx(A.id, user.id, ["flipper.read"]);
    const other = fakeCtx(B.id, user.id, ["flipper.*"]);

    // Empresa nueva: catálogo inicial, sin datos
    const fresh = await loadFlipper(admin);
    assert.equal(fresh.fresh, true); assert.equal(fresh.state.catalog.length, 4); assert.equal(fresh.state.quotes.length, 0);
    check("Empresa nueva arranca con el catálogo inicial de 4 capacidades");

    // El administrador guarda configuración, costos internos y nota privada
    const q = { ...E.clone(sample.q), number: "ORK-2026-0001", privateNotes: "" };
    await syncFlipper(admin, {
      settings: { settings: { ...sample.st.settings, team: undefined }, catalog: sample.st.catalog, counters: { quote: 1 } },
      internal: { team: E.defaultTeam(), capProfiles: E.defaultCapProfiles(), costs: {}, notes: { [q.id]: "margen bajo" } },
      clients: { upsert: [sample.st.clients[0]], remove: [] },
      quotes: { upsert: [q], remove: [] },
    });
    const row = await prisma.flipperQuote.findUniqueOrThrow({ where: { id: q.id } });
    assert.equal(Number(row.net), 14_080_000); assert.equal((row.data as any).privateNotes, "");
    check("Cotización guardada con su neto ($14.080.000) y sin la nota privada en el documento");

    // Quien no tiene flipper.internal no recibe equipo, costos ni notas
    const sv = await loadFlipper(seller);
    assert.equal(sv.state.settings.team, undefined); assert.deepEqual(sv.state.costs, {}); assert.equal(sv.state.quotes[0].privateNotes, "");
    const ad = await loadFlipper(admin);
    assert.equal(ad.state.settings.team.length, 4); assert.equal(ad.state.quotes[0].privateNotes, "margen bajo");
    check("Costos, equipo y notas privadas solo llegan a quien tiene flipper.internal");

    await assert.rejects(() => syncFlipper(seller, { settings: { settings: {}, catalog: [], counters: {} } }), /administrador/);
    await assert.rejects(() => syncFlipper(seller, { internal: { team: [], capProfiles: {}, costs: {}, notes: {} } }), /interna/);
    await assert.rejects(() => syncFlipper(viewer, { quotes: { upsert: [q], remove: [] } }), /permiso/);
    await assert.rejects(() => syncFlipper(viewer, { clients: { upsert: [], remove: [sample.st.clients[0].id] } }), /permiso/);
    check("Comercial no cambia catálogo ni costos; solo lectura no guarda cotizaciones ni clientes");

    // El consecutivo solo avanza
    await syncFlipper(seller, { counters: { quote: 7 } });
    await syncFlipper(seller, { counters: { quote: 3 } });
    const s = await prisma.flipperSettings.findFirstOrThrow({ where: { organizationId: A.id } });
    assert.equal((s.data as any).counters.quote, 7); assert.equal((s.data as any).catalog.length, 4);
    check("El consecutivo de cotizaciones nunca retrocede y conserva el catálogo");

    // Borrador personal
    await syncFlipper(viewer, { draft: { ...q, privateNotes: "x" } });
    const dr = await loadFlipper(viewer);
    assert.equal(dr.state.draft.id, q.id); assert.equal(dr.state.draft.privateNotes, "");
    check("La cotización en curso se guarda por usuario (sin notas privadas)");

    // Aislamiento: B no ve ni sobrescribe ni borra lo de A
    const bv = await loadFlipper(other);
    assert.equal(bv.state.quotes.length, 0); assert.equal(bv.state.clients.length, 0);
    // Mismo id que una cotización de A: la base no la toca (el upsert queda limitado a la empresa B)
    await syncFlipper(other, { quotes: { upsert: [{ ...q, name: "HACKEADA" }], remove: [] } }).catch(() => undefined);
    await syncFlipper(other, { quotes: { upsert: [], remove: [q.id] }, clients: { upsert: [], remove: [sample.st.clients[0].id] } });
    const still = await prisma.flipperQuote.findUniqueOrThrow({ where: { id: q.id } });
    assert.equal(still.organizationId, A.id); assert.notEqual((still.data as any).name, "HACKEADA");
    assert.equal(await prisma.flipperClient.count({ where: { organizationId: A.id } }), 1);
    check("Otra empresa no ve, no sobrescribe y no borra cotizaciones ni clientes ajenos");

    await syncFlipper(seller, { quotes: { upsert: [], remove: [q.id] } });
    assert.equal(await prisma.flipperQuote.count({ where: { organizationId: A.id } }), 0);
    check("Eliminar una cotización propia");
  } finally {
    for (const o of [A, B]) {
      for (const m of ["flipperSettings", "flipperInternal", "flipperClient", "flipperQuote", "flipperDraft"] as const) await (prisma[m] as any).deleteMany({ where: { organizationId: o.id } });
      await prisma.organization.delete({ where: { id: o.id } });
    }
  }
}

async function main() {
  const sample = engine();
  await persistence(sample);
  console.log(`\nFlipper: ${ok} ✓`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
