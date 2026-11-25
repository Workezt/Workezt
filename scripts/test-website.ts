import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "@/lib/core/prisma";
import { tenantDb } from "@/lib/core/db";
import type { ExecContext } from "@/lib/core/context";
import { convertLead, discardLead, publicForm, RATE, reopenLead, saveWebsiteConfig, submitLead, type SubmitMeta } from "@/lib/apps/website";
import { createVideoUpload, mediaConfigured, MediaError, registerMedia, signedMediaUrl } from "@/lib/core/media";

/** Sitio web: formulario público → CRM, antiabuso, modos automático/manual y aislamiento. Videos: validaciones sin red. */
async function cleanup(slugs: string[]) {
  const ids = (await prisma.organization.findMany({ where: { slug: { in: slugs } }, select: { id: true } })).map((o) => o.id);
  if (!ids.length) return;
  const w = { where: { organizationId: { in: ids } } };
  await prisma.webLead.deleteMany(w);
  await prisma.activity.deleteMany(w);
  await prisma.notification.deleteMany(w);
  await prisma.opportunity.deleteMany(w);
  await prisma.contact.deleteMany(w);
  await prisma.customer.deleteMany(w);
  await prisma.domainEvent.deleteMany(w);
  await prisma.fileObject.deleteMany(w);
  await prisma.membership.deleteMany(w);
  await prisma.organizationModule.deleteMany(w);
  await prisma.role.deleteMany(w);
  await prisma.organization.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@test-website.local" } } });
}

async function main() {
  await cleanup(["test-web", "test-web-b"]);
  const o = await prisma.organization.create({ data: { slug: "test-web", name: "Test Web", status: "ACTIVE" } });
  const ob = await prisma.organization.create({ data: { slug: "test-web-b", name: "Otra", status: "ACTIVE" } });
  const db = tenantDb(o.id);
  const ctx: ExecContext = { orgId: o.id, db, actorId: null };
  const role = await prisma.role.create({ data: { organizationId: o.id, key: "OWNER", name: "Propietario", permissions: ["*"] } });
  const seller = await prisma.user.create({ data: { email: "ventas@test-website.local", name: "Vendedora", passwordHash: "x" } });
  const outsider = await prisma.user.create({ data: { email: "fuera@test-website.local", name: "Ajeno", passwordHash: "x" } });
  await prisma.membership.create({ data: { organizationId: o.id, userId: seller.id, roleId: role.id, status: "ACTIVE" } });

  let t = 1_800_000_000_000;
  const meta = (o: Partial<SubmitMeta> = {}): SubmitMeta => ({ ip: "1.1.1.1", userAgent: "test", source: "https://cliente.com/contacto", utm: { utm_campaign: "nov" }, startedAt: t - 10_000, honeypot: "", now: t, ...o });
  const lead = (o: Record<string, unknown> = {}) => ({ name: "Ana Pérez", company: "Lácteos Sur", email: "ana@lacteos.co", phone: "3001234567", city: "Cali", interest: "Bolsas", message: "Necesito 5.000 bolsas", consent: true, ...o });

  // 1. Disponibilidad: sin la app o apagado no existe
  assert.equal(await publicForm("test-web"), null);
  await db.organizationModule.create({ data: { organizationId: o.id, moduleKey: "website" } });
  assert.equal(await publicForm("test-web"), null); // app activa pero formulario apagado
  await assert.rejects(() => submitLead("test-web", lead(), meta()), /no está disponible/);
  await assert.rejects(() => saveWebsiteConfig(ctx, { whatsapp: "123" }), /indicativo/);
  await assert.rejects(() => saveWebsiteConfig(ctx, { ownerId: outsider.id }), /usuario activo/);
  await assert.rejects(() => saveWebsiteConfig(ctx, { privacyUrl: "http://x.co" }), /https/);
  const cfg = await saveWebsiteConfig(ctx, { enabled: true, ownerId: seller.id, interests: ["Bolsas", " Bolsas ", "", "Maquinaria"], whatsapp: "+57 316 026 8619" });
  assert.deepEqual(cfg.interests, ["Bolsas", "Maquinaria"]);
  assert.equal(cfg.whatsapp, "573160268619");
  assert.equal((await publicForm("test-web"))!.name, "Test Web");
  console.log("1. disponibilidad (app y formulario apagados) y validación de la configuración: ok");

  // 2. Antiabuso: trampa y llenado instantáneo se aceptan sin guardar; consentimiento obligatorio
  assert.deepEqual(await submitLead("test-web", lead(), meta({ honeypot: "http://spam" })), { ok: true, leadId: null });
  assert.deepEqual(await submitLead("test-web", lead(), meta({ startedAt: t - 500 })), { ok: true, leadId: null });
  await assert.rejects(() => submitLead("test-web", lead({ consent: false }), meta()), /tratamiento de datos/);
  await assert.rejects(() => submitLead("test-web", lead({ email: "no-es-correo" }), meta()), /Correo inválido/);
  assert.equal(await db.webLead.count(), 0);
  console.log("2. campo trampa, tiempo mínimo, consentimiento y correo: ok");

  // Campo personalizado obligatorio del cliente (como "Tipo de industria" en la plantilla de manufactura)
  await db.customFieldDefinition.create({ data: { organizationId: o.id, entityType: "customer", key: "industry", label: "Tipo de industria", type: "text", required: true } });

  // 3. Automático: crea cliente (empresa) + contacto + oportunidad y avisa al responsable
  const r1 = await submitLead("test-web", lead(), meta());
  const l1 = await db.webLead.findUniqueOrThrow({ where: { id: r1.leadId! } });
  assert.equal(l1.status, "CONVERTED");
  assert.notEqual(l1.ipHash, "1.1.1.1"); // no se guarda la IP
  assert.deepEqual(l1.utm, { utm_campaign: "nov" });
  const c1 = await db.customer.findUniqueOrThrow({ where: { id: l1.customerId! } });
  assert.equal(c1.name, "Lácteos Sur");
  assert.equal(await db.contact.count({ where: { customerId: c1.id, email: "ana@lacteos.co" } }), 1);
  const opp = await db.opportunity.findUniqueOrThrow({ where: { id: l1.opportunityId! } });
  assert.equal(opp.ownerId, seller.id);
  assert.match(opp.title, /Bolsas/);
  assert.ok(await db.activity.findFirst({ where: { entityType: "opportunity", entityId: opp.id, content: { contains: "5.000 bolsas" } } }));
  assert.equal(await db.notification.count({ where: { userId: seller.id } }), 1);
  assert.ok(await db.activity.findFirst({ where: { entityType: "customer", entityId: c1.id, content: { contains: "Completa: Tipo de industria" } } }));
  console.log("3. modo automático: cliente (con campo obligatorio pendiente), contacto, oportunidad, dueño y aviso: ok");

  // 3b. Si el paso al CRM falla, el visitante recibe confirmación, la solicitud queda nueva y se avisa del motivo
  t += 60_000;
  const rf = await submitLead("test-web", lead({ company: "X", email: "falla@x.co" }), meta({ ip: "9.9.9.9" }));
  const lf = await db.webLead.findUniqueOrThrow({ where: { id: rf.leadId! } });
  assert.equal(lf.status, "NEW");
  assert.ok(await db.notification.findFirst({ where: { userId: seller.id, title: { contains: "sin pasar al CRM" } } }));
  await db.webLead.delete({ where: { id: lf.id } });

  // 4. Mismo correo (otra mayúscula) → mismo cliente, sin contacto duplicado; interés fuera de la lista se limpia
  t += 60_000;
  const r2 = await submitLead("test-web", lead({ email: "ANA@lacteos.co", company: "", interest: "Hackeo" }), meta());
  const l2 = await db.webLead.findUniqueOrThrow({ where: { id: r2.leadId! } });
  assert.equal(l2.customerId, c1.id);
  assert.equal(l2.interest, "");
  assert.equal(await db.customer.count(), 1);
  assert.equal(await db.contact.count(), 1);
  assert.equal(await db.opportunity.count(), 2);
  console.log("4. reutiliza el cliente por correo, sin duplicar contacto; interés inválido descartado: ok");

  // 5. Límite por huella de IP
  t += 60_000;
  await submitLead("test-web", lead({ email: "b@x.co" }), meta());
  await assert.rejects(() => submitLead("test-web", lead({ email: "c@x.co" }), meta()), /varias solicitudes/);
  await submitLead("test-web", lead({ email: "c@x.co" }), meta({ ip: "2.2.2.2" })); // otra IP sí pasa
  t += 11 * 60_000;
  await submitLead("test-web", lead({ email: "d@x.co" }), meta()); // pasada la ventana, vuelve a pasar
  assert.equal(RATE.perIp10min, 3);
  console.log("5. límite de envíos por IP (ventana de 10 min): ok");

  // 6. Modo manual: queda nueva; se descarta, reabre y convierte; no se convierte dos veces
  await saveWebsiteConfig(ctx, { autoConvert: false });
  t += 60_000;
  const r3 = await submitLead("test-web", lead({ email: "luis@nuevo.co", company: "", name: "Luis Gómez" }), meta({ ip: "3.3.3.3" }));
  let l3 = await db.webLead.findUniqueOrThrow({ where: { id: r3.leadId! } });
  assert.equal(l3.status, "NEW");
  assert.equal(l3.customerId, null);
  await discardLead(ctx, l3.id);
  await reopenLead(ctx, l3.id);
  const conv = await convertLead({ ...ctx, actorId: seller.id }, l3.id);
  assert.equal(conv.newCustomer, true);
  l3 = await db.webLead.findUniqueOrThrow({ where: { id: l3.id } });
  assert.equal(l3.status, "CONVERTED");
  assert.equal(l3.handledById, seller.id);
  assert.equal((await db.customer.findUniqueOrThrow({ where: { id: conv.customerId } })).email, "luis@nuevo.co"); // sin empresa: el cliente es la persona
  await assert.rejects(() => convertLead(ctx, l3.id), /ya se pasó/);
  await assert.rejects(() => discardLead(ctx, l3.id), /ya convertida/);
  console.log("6. modo manual: nueva → descartada → reabierta → al CRM, sin dobles conversiones: ok");

  // 7. Aislamiento: la otra empresa no tiene formulario ni ve solicitudes
  const dbB = tenantDb(ob.id);
  assert.equal(await publicForm("test-web-b"), null);
  assert.equal(await dbB.webLead.count(), 0);
  await assert.rejects(() => convertLead({ orgId: ob.id, db: dbB, actorId: null }, l1.id));
  console.log("7. aislamiento entre empresas: ok");

  // 8. Videos: validaciones locales (sin llamar al almacenamiento)
  if (!mediaConfigured()) {
    await assert.rejects(() => createVideoUpload(ctx, { name: "a.mp4", type: "video/mp4", size: 10, folder: "brand" }), /no está configurado/);
    assert.equal(await signedMediaUrl("sb:x/y.mp4"), null);
  } else {
    await assert.rejects(() => createVideoUpload(ctx, { name: "a.exe", type: "application/x-msdownload", size: 10, folder: "brand" }), /Formato/);
    await assert.rejects(() => createVideoUpload(ctx, { name: "a.mp4", type: "video/mp4", size: 60 * 1024 * 1024, folder: "brand" }), /supera/);
  }
  await assert.rejects(() => registerMedia(ctx, { path: `${ob.id}/brand/x.mp4`, name: "x.mp4", type: "video/mp4", size: 1, entityType: "org_brand_video" }), (e) => e instanceof MediaError && /inválida/.test(e.message));
  await assert.rejects(() => registerMedia(ctx, { path: `${o.id}/../${ob.id}/x.mp4`, name: "x.mp4", type: "video/mp4", size: 1, entityType: "org_brand_video" }), /inválida/);
  console.log(`8. videos: ${mediaConfigured() ? "formato y tamaño" : "sin configurar → mensaje claro"}, rutas de otra empresa rechazadas: ok`);

  await cleanup(["test-web", "test-web-b"]);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
