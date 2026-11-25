import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/core/prisma";
import { tenantDb } from "@/lib/core/db";
import type { ExecContext } from "@/lib/core/context";
import { hashPassword } from "@/lib/core/auth";
import { applyTemplate, ensureBaseRoles } from "@/lib/templates/apply";
import { createWarehouse } from "@/lib/apps/stock";

/**
 * Cliente GEU (Grupo Empresarial Universal): empresa con plantilla de manufactura,
 * sus 5 unidades de negocio como áreas y un usuario propietario.
 * Idempotente: si la empresa ya existe, no hace nada.
 * Uso: npx tsx --env-file=.env.workezt scripts/create-geu.ts
 */
const SLUG = "geu";
const EMAIL = "admin@geu-universal.com";

const UNITS = [
  { code: "CAU", name: "Universal de Cauchos", description: "Láminas, mangueras, sellos y desarrollo a medida en caucho." },
  { code: "PLA", name: "GEU Plastic", description: "Plásticos técnicos: perfiles, piezas y materia prima." },
  { code: "STR", name: "GEU Structure", description: "Estructuras de acero galvanizado para plantas solares: ingeniería, fabricación y montaje." },
  { code: "ENE", name: "GEU Energy", description: "Proyectos de energía solar y eficiencia." },
  { code: "IMP", name: "GEU Import", description: "Importación, abastecimiento, proveedores y logística." },
];

async function main() {
  if (await prisma.organization.findUnique({ where: { slug: SLUG } })) {
    console.log("GEU ya existe; no se cambió nada.");
    return;
  }
  const o = await prisma.organization.create({
    data: {
      slug: SLUG, name: "GEU", legalName: "Grupo Empresarial Universal", status: "ACTIVE", onboardingStep: 11, industry: "Manufactura",
      branding: { displayName: "GEU · Grupo Empresarial Universal" },
    },
  });
  const ctx = { orgId: o.id, db: tenantDb(o.id), actorId: null } as ExecContext;
  await prisma.subscription.create({ data: { organizationId: o.id, planKey: "enterprise", status: "TRIAL" } });
  await ensureBaseRoles(ctx);
  await createWarehouse(ctx, { code: "PRI", name: "Bodega principal" });
  await applyTemplate(ctx, "manufacturing");
  for (const u of UNITS) await ctx.db.orgUnit.create({ data: { organizationId: o.id, kind: "DEPARTMENT", ...u } });

  const password = `Geu-${randomBytes(6).toString("base64url")}`;
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: { email: EMAIL, name: "Administrador GEU", passwordHash: await hashPassword(password) },
  });
  const owner = await ctx.db.role.findFirstOrThrow({ where: { key: "OWNER" } });
  await ctx.db.membership.create({ data: { organizationId: o.id, userId: user.id, roleId: owner.id, title: "Propietario" } });
  console.log(`✔ GEU creada · usuario ${EMAIL} · clave inicial: ${password}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
