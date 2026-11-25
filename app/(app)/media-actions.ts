"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/core/prisma";
import { actionContext, type OrgContext } from "@/lib/core/context";
import { json } from "@/lib/core/db";
import { audit } from "@/lib/core/notify";
import { createVideoUpload, deleteMedia, MediaError, registerMedia } from "@/lib/core/media";

/** Dónde se usa un video: marca de la empresa (banner de inicio / login) o un artículo de Conocimiento. */
export type VideoTarget = { kind: "brand"; slot: "hero" | "login" } | { kind: "knowledge"; itemId: string };
type FileMeta = { name: string; type: string; size: number };
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const BRAND_FIELD = { hero: "heroVideoId", login: "loginVideoId" } as const;

/** Verifica permiso y existencia del destino. */
async function contextFor(target: VideoTarget): Promise<OrgContext> {
  if (target.kind === "brand") {
    if (!(target.slot in BRAND_FIELD)) throw new MediaError("Destino inválido");
    return actionContext("org.settings.manage");
  }
  const ctx = await actionContext("knowledge.write", "knowledge");
  const item = await ctx.db.knowledgeItem.findUnique({ where: { id: target.itemId }, select: { id: true } });
  if (!item) throw new MediaError("Artículo no encontrado");
  return ctx;
}

const fail = (e: unknown): { ok: false; error: string } => {
  if (e instanceof MediaError) return { ok: false, error: e.message };
  console.error("[ORKEST] Error de video:", e);
  return { ok: false, error: e instanceof Error && e.message.startsWith("Permiso") ? e.message : "No se pudo completar la operación con el video" };
};

/** Paso 1: URL firmada para que el navegador suba el archivo directo al almacenamiento. */
export async function requestVideoUpload(target: VideoTarget, file: FileMeta): Promise<Result<{ uploadUrl: string; path: string }>> {
  try {
    const ctx = await contextFor(target);
    const folder = target.kind === "brand" ? "brand" : "knowledge";
    const up = await createVideoUpload(ctx, { ...file, folder });
    return { ok: true, ...up };
  } catch (e) {
    return fail(e);
  }
}

/** Paso 2: registra el video subido y lo asigna a su destino (reemplaza el anterior en los de marca). */
export async function completeVideoUpload(target: VideoTarget, upload: FileMeta & { path: string }): Promise<Result> {
  try {
    const ctx = await contextFor(target);
    if (target.kind === "brand") {
      const fileId = await registerMedia(ctx, { ...upload, entityType: "org_brand_video", entityId: ctx.orgId });
      const field = BRAND_FIELD[target.slot];
      const prev = (ctx.org.branding as Record<string, unknown>)[field];
      await prisma.organization.update({ where: { id: ctx.orgId }, data: { branding: json({ ...(ctx.org.branding as object), [field]: fileId }) } });
      if (typeof prev === "string" && prev !== fileId) await deleteMedia(ctx, prev);
      await audit(ctx, "BrandVideoUpdated", "organization", ctx.orgId, { slot: target.slot });
      revalidatePath("/", "layout");
    } else {
      await registerMedia(ctx, { ...upload, entityType: "knowledge_video", entityId: target.itemId });
      revalidatePath(`/knowledge/${target.itemId}`);
    }
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Quita un video de la marca o de un artículo y lo borra del almacenamiento. */
export async function removeVideo(target: VideoTarget, fileId?: string): Promise<Result> {
  try {
    const ctx = await contextFor(target);
    if (target.kind === "brand") {
      const field = BRAND_FIELD[target.slot];
      const current = (ctx.org.branding as Record<string, unknown>)[field];
      const branding = { ...(ctx.org.branding as Record<string, unknown>) };
      delete branding[field];
      await prisma.organization.update({ where: { id: ctx.orgId }, data: { branding: json(branding) } });
      if (typeof current === "string") await deleteMedia(ctx, current);
      revalidatePath("/", "layout");
    } else {
      const f = fileId ? await ctx.db.fileObject.findFirst({ where: { id: fileId, entityType: "knowledge_video", entityId: target.itemId } }) : null;
      if (!f) throw new MediaError("Video no encontrado");
      await deleteMedia(ctx, f.id);
      revalidatePath(`/knowledge/${target.itemId}`);
    }
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
