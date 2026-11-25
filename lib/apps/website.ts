/**
 * Sitio web: formulario público de contacto/cotización conectado al CRM.
 *
 *  - Cada empresa tiene su formulario en /f/<slug> (también incrustable con ?embed=1 en su propio sitio).
 *  - Un envío crea una solicitud (WebLead). Si "convertir automáticamente" está activo, además crea o
 *    reutiliza el cliente (por email), agrega el contacto, abre una oportunidad y avisa al responsable.
 *  - Antiabuso sin servicios externos: campo trampa, tiempo mínimo de llenado y límite por huella de IP.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/core/prisma";
import { tenantDb, json } from "@/lib/core/db";
import type { ExecContext } from "@/lib/core/context";
import { emitEvent } from "@/lib/core/events";
import { addActivity, notify, usersWithRole } from "@/lib/core/notify";
import { getFieldDefs } from "@/lib/core/custom-fields";
import { createOpportunity, CustomerInput, ValidationError } from "./crm";

/* ─────────────────────────────── Configuración ─────────────────────────────── */

export type WebsiteConfig = {
  enabled: boolean;
  title: string;
  intro: string;
  successMessage: string;
  /** Opciones de "¿Qué te interesa?"; vacío = no se pregunta */
  interests: string[];
  /** Número de WhatsApp con indicativo (solo dígitos), p. ej. 573160268619 */
  whatsapp: string;
  /** Teléfono, correo y dirección que se muestran junto al formulario (opcionales) */
  phone: string;
  email: string;
  address: string;
  /** Responsable de las solicitudes (recibe aviso y queda como dueño de la oportunidad) */
  ownerId: string | null;
  /** Crear cliente + contacto + oportunidad al recibir cada solicitud */
  autoConvert: boolean;
  askCompany: boolean;
  askCity: boolean;
  privacyUrl: string;
};

export const DEFAULT_CONFIG: WebsiteConfig = {
  enabled: false,
  title: "Contáctanos",
  intro: "Déjanos tus datos y un asesor te contactará en horario hábil.",
  successMessage: "¡Gracias! Recibimos tu solicitud y te contactaremos pronto.",
  interests: [],
  whatsapp: "",
  phone: "",
  email: "",
  address: "",
  ownerId: null,
  autoConvert: true,
  askCompany: true,
  askCity: true,
  privacyUrl: "",
};

export function websiteConfig(settings: unknown): WebsiteConfig {
  const raw = ((settings ?? {}) as { website?: Partial<WebsiteConfig> }).website ?? {};
  return { ...DEFAULT_CONFIG, ...raw, interests: Array.isArray(raw.interests) ? raw.interests.filter((x) => typeof x === "string") : [] };
}

const digits = (v: string) => v.replace(/\D/g, "");

export async function saveWebsiteConfig(ctx: ExecContext, input: Partial<WebsiteConfig>) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.orgId }, select: { settings: true } });
  const current = websiteConfig(org.settings);
  const next: WebsiteConfig = { ...current, ...input };
  next.title = next.title.trim().slice(0, 120) || DEFAULT_CONFIG.title;
  next.intro = next.intro.trim().slice(0, 600);
  next.successMessage = next.successMessage.trim().slice(0, 300) || DEFAULT_CONFIG.successMessage;
  next.interests = [...new Set(next.interests.map((s) => s.trim()).filter(Boolean))].slice(0, 20).map((s) => s.slice(0, 80));
  next.whatsapp = digits(next.whatsapp).slice(0, 15);
  if (next.whatsapp && next.whatsapp.length < 10) throw new ValidationError({ whatsapp: "WhatsApp con indicativo de país, p. ej. 573160268619" });
  next.phone = next.phone.trim().slice(0, 60);
  next.email = next.email.trim().slice(0, 120);
  if (next.email && !z.email().safeParse(next.email).success) throw new ValidationError({ email: "Correo inválido" });
  next.address = next.address.trim().slice(0, 200);
  next.privacyUrl = next.privacyUrl.trim();
  if (next.privacyUrl && !/^https:\/\/\S+$/i.test(next.privacyUrl)) throw new ValidationError({ privacyUrl: "La política de datos debe ser una URL https://" });
  if (next.ownerId) {
    const m = await ctx.db.membership.findFirst({ where: { userId: next.ownerId, status: "ACTIVE" } });
    if (!m) throw new ValidationError({ ownerId: "El responsable debe ser un usuario activo de la empresa" });
  }
  const settings = { ...((org.settings ?? {}) as object), website: next };
  await prisma.organization.update({ where: { id: ctx.orgId }, data: { settings: json(settings) } });
  return next;
}

/* ─────────────────────────────── Envío público ─────────────────────────────── */

const LeadInput = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(120),
  company: z.string().trim().max(160).default(""),
  email: z.email("Correo inválido").trim().max(160),
  phone: z.string().trim().max(40).default(""),
  city: z.string().trim().max(80).default(""),
  interest: z.string().trim().max(80).default(""),
  message: z.string().trim().max(3000).default(""),
  consent: z.literal(true, { error: "Debes aceptar el tratamiento de datos" }),
});

/** Organización pública por slug, solo si está activa y con el formulario y la app encendidos. */
export async function publicForm(slug: string) {
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, status: true, branding: true, settings: true, modules: { where: { moduleKey: "website" }, select: { id: true } } },
  });
  if (!org || org.status !== "ACTIVE" || org.modules.length === 0) return null;
  const config = websiteConfig(org.settings);
  if (!config.enabled) return null;
  const b = (org.branding ?? {}) as { displayName?: string; logoUrl?: string; primaryColor?: string };
  return { orgId: org.id, slug: org.slug, name: b.displayName || org.name, logoUrl: b.logoUrl, color: b.primaryColor, config };
}

export const ipHashOf = (ip: string, orgId: string) => createHash("sha256").update(`${orgId}:${ip}:${process.env.AUTH_SECRET ?? ""}`).digest("hex").slice(0, 32);

export const RATE = { perIp10min: 3, perOrgHour: 60, minSeconds: 3 };

export type SubmitMeta = { ip: string; userAgent: string; source: string; utm: Record<string, string>; startedAt: number; honeypot: string; now?: number };

/**
 * Recibe un envío del formulario público. Devuelve { ok } o lanza ValidationError con mensajes para el visitante.
 * Los envíos de robots (campo trampa o llenado instantáneo) se aceptan en silencio sin guardar nada.
 */
export async function submitLead(slug: string, raw: unknown, meta: SubmitMeta): Promise<{ ok: true; leadId: string | null }> {
  const form = await publicForm(slug);
  if (!form) throw new ValidationError({ form: "Este formulario no está disponible" });
  const now = meta.now ?? Date.now();
  // Robots: no se les dice nada para no enseñarles la regla
  if (meta.honeypot || !meta.startedAt || now - meta.startedAt < RATE.minSeconds * 1000) return { ok: true, leadId: null };

  const parsed = LeadInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join(".") || "form", i.message])));
  const d = parsed.data;
  if (form.config.interests.length && d.interest && !form.config.interests.includes(d.interest)) d.interest = "";

  const db = tenantDb(form.orgId);
  const ipHash = ipHashOf(meta.ip, form.orgId);
  const [byIp, byOrg] = await Promise.all([
    db.webLead.count({ where: { ipHash, createdAt: { gte: new Date(now - 10 * 60_000) } } }),
    db.webLead.count({ where: { createdAt: { gte: new Date(now - 60 * 60_000) } } }),
  ]);
  if (byIp >= RATE.perIp10min || byOrg >= RATE.perOrgHour) {
    throw new ValidationError({ form: "Recibimos varias solicitudes seguidas. Intenta de nuevo en unos minutos o escríbenos por WhatsApp." });
  }

  const lead = await db.webLead.create({
    data: {
      organizationId: form.orgId, ...d, consent: true, ipHash, userAgent: meta.userAgent.slice(0, 300), createdAt: new Date(now),
      source: meta.source.slice(0, 500), utm: json(meta.utm),
    },
  });
  const ctx: ExecContext = { orgId: form.orgId, db, actorId: null };
  await emitEvent(ctx, "WebLeadReceived", "web_lead", lead.id, { name: lead.name, email: lead.email, interest: lead.interest });

  if (form.config.autoConvert) {
    // Si el paso al CRM falla, la solicitud queda guardada como nueva y el visitante igual recibe su confirmación:
    // el problema es interno y se le avisa al responsable.
    try {
      await convertLead(ctx, lead.id, form.config.ownerId);
    } catch (e) {
      console.error("[ORKEST] No se pudo pasar la solicitud web al CRM:", e);
      await notify(ctx, await recipients(ctx, form.config.ownerId), {
        title: `Solicitud web sin pasar al CRM: ${lead.company || lead.name}`,
        body: `Revísala en la bandeja. Motivo: ${e instanceof Error ? e.message : "error interno"}`.slice(0, 280), link: "/website",
      });
    }
  } else {
    await notify(ctx, await recipients(ctx, form.config.ownerId), {
      title: `Nueva solicitud web: ${lead.company || lead.name}`, body: lead.interest || lead.message.slice(0, 140), link: "/website",
    });
  }
  return { ok: true, leadId: lead.id };
}

async function recipients(ctx: ExecContext, ownerId: string | null) {
  return ownerId ? [ownerId] : usersWithRole(ctx, "OWNER");
}

/* ─────────────────────────────── Convertir y descartar ─────────────────────────────── */

/**
 * Pasa una solicitud al CRM: reutiliza el cliente si el email ya existe (en el cliente o en uno de sus
 * contactos); si no, lo crea. Agrega el contacto y abre una oportunidad con el mensaje como actividad.
 */
export async function convertLead(ctx: ExecContext, leadId: string, ownerId?: string | null) {
  const lead = await ctx.db.webLead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.status === "CONVERTED") throw new Error("Esta solicitud ya se pasó al CRM");
  const email = lead.email.toLowerCase();
  const owner = ownerId ?? websiteConfig((await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { settings: true } }))?.settings).ownerId;

  let customer =
    (await ctx.db.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })) ??
    (await ctx.db.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" }, customerId: { not: null } }, include: { customer: true } }))?.customer ??
    null;
  const isNew = !customer;
  let missingFields: string[] = [];
  if (!customer) {
    const created = await createCustomerFromWeb(ctx, {
      name: lead.company || lead.name, email: lead.company ? "" : email, phone: lead.phone, city: lead.city, ownerId: owner ?? "",
    });
    customer = created.customer;
    missingFields = created.missing;
  }
  const hasContact = await ctx.db.contact.findFirst({ where: { customerId: customer.id, email: { equals: email, mode: "insensitive" } } });
  if (!hasContact) {
    await ctx.db.contact.create({ data: { organizationId: ctx.orgId, customerId: customer.id, name: lead.name, email, phone: lead.phone || null } });
  }
  const opp = await createOpportunity({ ...ctx, actorId: ctx.actorId ?? owner ?? null }, {
    title: `Web · ${lead.interest || "Solicitud de contacto"} · ${lead.company || lead.name}`.slice(0, 160),
    customerId: customer.id, ownerId: owner ?? "",
  });
  const detail = [
    `Solicitud desde el sitio web${lead.source ? ` (${lead.source})` : ""}.`,
    `${lead.name} · ${lead.email}${lead.phone ? ` · ${lead.phone}` : ""}${lead.city ? ` · ${lead.city}` : ""}`,
    lead.interest && `Interés: ${lead.interest}`,
    lead.message && `Mensaje: ${lead.message}`,
  ].filter(Boolean).join("\n");
  await addActivity(ctx, "opportunity", opp.id, detail, "NOTE");
  if (isNew) {
    await addActivity(ctx, "customer", customer.id, missingFields.length
      ? `Cliente creado desde el formulario del sitio web. Completa: ${missingFields.join(", ")}.`
      : "Cliente creado desde el formulario del sitio web.");
  }

  await ctx.db.webLead.update({
    where: { id: lead.id },
    data: { status: "CONVERTED", customerId: customer.id, opportunityId: opp.id, handledById: ctx.actorId, handledAt: new Date() },
  });
  await notify(ctx, await recipients(ctx, owner ?? null), {
    title: `Nueva oportunidad desde la web: ${customer.name}`, body: lead.interest || lead.message.slice(0, 140) || lead.email, link: `/crm/customers/${customer.id}`,
  });
  return { customerId: customer.id, opportunityId: opp.id, newCustomer: isNew };
}

/**
 * Cliente creado por un visitante: valida los datos básicos igual que el CRM, pero los campos personalizados
 * obligatorios quedan vacíos (el visitante no los conoce) y se listan para que el comercial los complete.
 */
async function createCustomerFromWeb(ctx: ExecContext, raw: Record<string, string>) {
  const parsed = CustomerInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join(".") || "form", i.message])));
  const defs = await getFieldDefs(ctx.db, "customer");
  const missing = defs.filter((d) => d.required).map((d) => d.label);
  const customer = await ctx.db.customer.create({ data: { ...parsed.data, customFields: {}, organizationId: ctx.orgId } });
  await emitEvent(ctx, "CustomerCreated", "customer", customer.id, { name: customer.name, source: "website" });
  return { customer, missing };
}

export async function discardLead(ctx: ExecContext, leadId: string) {
  const lead = await ctx.db.webLead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.status === "CONVERTED") throw new Error("Una solicitud ya convertida no se descarta; gestiona la oportunidad en el CRM");
  await ctx.db.webLead.update({ where: { id: leadId }, data: { status: "DISCARDED", handledById: ctx.actorId, handledAt: new Date() } });
}

export async function reopenLead(ctx: ExecContext, leadId: string) {
  await ctx.db.webLead.update({ where: { id: leadId }, data: { status: "NEW", handledById: null, handledAt: null } });
}

/** Enlace de WhatsApp con mensaje inicial. */
export const whatsappLink = (number: string, text: string) => `https://wa.me/${digits(number)}?text=${encodeURIComponent(text)}`;
