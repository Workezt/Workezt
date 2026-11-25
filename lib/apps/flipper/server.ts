import type { OrgContext } from "@/lib/core/context";
import { json } from "@/lib/core/db";
import { E } from "./engine";

/**
 * Persistencia de Flipper. Replica el modelo de la versión en la nube de OR-K Flipper:
 *  · settings  → parámetros comerciales + catálogo + consecutivo (lo edita quien tiene flipper.internal)
 *  · internal  → equipo, costos y notas privadas (solo flipper.internal; nunca se envía a los demás)
 *  · clients / quotes → un documento JSON por registro (flipper.write)
 *  · draft     → la cotización en curso de cada usuario
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Doc = Record<string, any>;

export type FlipperPerms = { write: boolean; internal: boolean };

export function flipperPerms(ctx: OrgContext): FlipperPerms {
  return { write: ctx.can("flipper.write"), internal: ctx.can("flipper.internal") };
}

/** Estado inicial para el cliente (sin información interna si el usuario no la puede ver). */
export async function loadFlipper(ctx: OrgContext) {
  const perms = flipperPerms(ctx);
  const [settingsRow, internalRow, clients, quotes, draft] = await Promise.all([
    ctx.db.flipperSettings.findFirst(),
    perms.internal ? ctx.db.flipperInternal.findFirst() : null,
    ctx.db.flipperClient.findMany({ orderBy: { updatedAt: "asc" } }),
    ctx.db.flipperQuote.findMany({ orderBy: { updatedAt: "desc" } }),
    ctx.db.flipperDraft.findFirst({ where: { userId: ctx.user.id } }),
  ]);
  const sd = (settingsRow?.data ?? {}) as Doc;
  const internal = (internalRow?.data ?? null) as Doc | null;
  const notes: Record<string, string> = (internal?.notes as Record<string, string>) ?? {};
  const quoteDocs = quotes.map((q) => {
    const d = q.data as Doc;
    return perms.internal && notes[q.id] ? { ...d, privateNotes: notes[q.id] } : d;
  });
  const draftDoc = (draft?.data ?? null) as Doc | null;
  if (draftDoc && perms.internal && notes[`__draft_${ctx.user.id}`]) draftDoc.privateNotes = notes[`__draft_${ctx.user.id}`];

  return {
    perms,
    userId: ctx.user.id,
    /** true cuando la organización aún no tiene configuración guardada (se usa el catálogo inicial). */
    fresh: !sd.catalog,
    state: {
      schema: E.SCHEMA_VERSION,
      app: "OR-K Flipper",
      settings: {
        ...(sd.settings ?? {}),
        companyName: sd.settings?.companyName ?? ctx.org.branding.displayName ?? ctx.org.name,
        ...(perms.internal && internal ? { team: internal.team, capProfiles: internal.capProfiles } : {}),
      },
      catalog: sd.catalog ?? E.defaultCatalog(),
      counters: sd.counters ?? { quote: 0 },
      costs: perms.internal ? (internal?.costs ?? {}) : {},
      clients: clients.map((c) => c.data as Doc),
      quotes: quoteDocs,
      draft: draftDoc,
      hasInternal: !!internal,
    } as Doc,
  };
}

export type FlipperSyncPayload = {
  settings?: { settings: Doc; catalog: Doc[]; counters: Doc };
  counters?: Doc;
  internal?: { team: Doc[]; capProfiles: Doc; costs: Doc; notes: Record<string, string> };
  clients?: { upsert: Doc[]; remove: string[] };
  quotes?: { upsert: Doc[]; remove: string[] };
  draft?: Doc | null;
};

const isObj = (v: unknown): v is Doc => !!v && typeof v === "object" && !Array.isArray(v);
const idOk = (v: unknown): v is string => typeof v === "string" && /^[\w-]{3,80}$/.test(v);

/** Guarda los cambios que envía el navegador. Cada bloque exige su permiso. */
export async function syncFlipper(ctx: OrgContext, p: FlipperSyncPayload) {
  const perms = flipperPerms(ctx);
  const actor = ctx.user.id;
  const ops: Promise<unknown>[] = [];

  if (p.settings) {
    if (!perms.internal) throw new Error("Solo un administrador de Flipper puede cambiar la configuración y el catálogo");
    if (!isObj(p.settings.settings) || !Array.isArray(p.settings.catalog)) throw new Error("Configuración inválida");
    const data = json({ settings: { ...p.settings.settings, team: undefined, capProfiles: undefined }, catalog: p.settings.catalog, counters: p.settings.counters ?? { quote: 0 } });
    ops.push(ctx.db.flipperSettings.upsert({ where: { organizationId: ctx.orgId }, create: { organizationId: ctx.orgId, data, updatedById: actor }, update: { data, updatedById: actor } }));
  } else if (p.counters && perms.write) {
    // Consecutivo de cotizaciones: lo avanza quien guarda una cotización (nunca retrocede)
    const row = await ctx.db.flipperSettings.findFirst();
    const cur = (row?.data ?? {}) as Doc;
    const quote = Math.max(Number(cur.counters?.quote) || 0, Number(p.counters.quote) || 0);
    const data = json({ ...cur, catalog: cur.catalog ?? E.defaultCatalog(), settings: cur.settings ?? {}, counters: { ...(cur.counters ?? {}), quote } });
    ops.push(ctx.db.flipperSettings.upsert({ where: { organizationId: ctx.orgId }, create: { organizationId: ctx.orgId, data, updatedById: actor }, update: { data, updatedById: actor } }));
  }

  if (p.internal) {
    if (!perms.internal) throw new Error("Sin permiso para la información interna de Flipper");
    const data = json(p.internal);
    ops.push(ctx.db.flipperInternal.upsert({ where: { organizationId: ctx.orgId }, create: { organizationId: ctx.orgId, data, updatedById: actor }, update: { data, updatedById: actor } }));
  }

  if (p.clients) {
    if (!perms.write) throw new Error("Sin permiso para editar clientes de Flipper");
    for (const c of p.clients.upsert) {
      if (!isObj(c) || !idOk(c.id)) continue;
      const data = json(c);
      const name = String(c.name ?? "").slice(0, 200);
      ops.push(ctx.db.flipperClient.upsert({ where: { id: c.id }, create: { id: c.id, organizationId: ctx.orgId, name, data, updatedById: actor }, update: { name, data, updatedById: actor } }));
    }
    const rm = p.clients.remove.filter(idOk);
    if (rm.length) ops.push(ctx.db.flipperClient.deleteMany({ where: { id: { in: rm } } }));
  }

  if (p.quotes) {
    if (!perms.write) throw new Error("Sin permiso para editar cotizaciones de Flipper");
    for (const q of p.quotes.upsert) {
      if (!isObj(q) || !idOk(q.id) || !Array.isArray(q.lines)) continue;
      const doc = { ...q, privateNotes: "" };
      let net = 0;
      try { net = E.computeTotals(doc).net; } catch { net = 0; }
      const row = { number: q.number ? String(q.number) : null, clientName: String(q.client?.name ?? ""), status: String(q.status ?? "Borrador"), net, data: json(doc), updatedById: actor };
      ops.push(ctx.db.flipperQuote.upsert({ where: { id: q.id }, create: { id: q.id, organizationId: ctx.orgId, ...row }, update: row }));
    }
    const rm = p.quotes.remove.filter(idOk);
    if (rm.length) ops.push(ctx.db.flipperQuote.deleteMany({ where: { id: { in: rm } } }));
  }

  if (p.draft !== undefined) {
    const data = p.draft ? json({ ...p.draft, privateNotes: "" }) : undefined;
    ops.push(ctx.db.flipperDraft.upsert({
      where: { organizationId_userId: { organizationId: ctx.orgId, userId: ctx.user.id } },
      create: { organizationId: ctx.orgId, userId: ctx.user.id, data },
      update: { data: data ?? json(null) },
    }));
  }

  await Promise.all(ops);
}
