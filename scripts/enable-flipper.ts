import "dotenv/config";
import { prisma } from "@/lib/core/prisma";

/**
 * Activa la app Flipper en todas las organizaciones existentes y agrega sus permisos a los roles base
 * (Administrador: todo; Gerencia: ver; Comercial: ver y cotizar). Idempotente: se puede correr varias veces.
 *   npx tsx scripts/enable-flipper.ts
 */
const ROLE_PERMS: Record<string, string[]> = {
  ADMIN: ["flipper.*"],
  MANAGEMENT: ["flipper.read"],
  SALES: ["flipper.read", "flipper.write"],
};

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  for (const o of orgs) {
    const mod = await prisma.organizationModule.findFirst({ where: { organizationId: o.id, moduleKey: "flipper" } });
    if (!mod) await prisma.organizationModule.create({ data: { organizationId: o.id, moduleKey: "flipper" } });
    else if (!mod.enabled) await prisma.organizationModule.update({ where: { id: mod.id }, data: { enabled: true } });
    const roles = await prisma.role.findMany({ where: { organizationId: o.id, key: { in: Object.keys(ROLE_PERMS) } } });
    for (const r of roles) {
      const add = ROLE_PERMS[r.key].filter((p) => !r.permissions.includes(p));
      if (add.length) await prisma.role.update({ where: { id: r.id }, data: { permissions: [...r.permissions, ...add] } });
    }
    console.log(`✓ ${o.name}: Flipper activo${roles.length ? ` · ${roles.map((r) => r.key).join(", ")} actualizados` : ""}`);
  }
}

main().finally(() => prisma.$disconnect());
