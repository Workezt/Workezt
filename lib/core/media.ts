import type { ExecContext } from "./context";

/**
 * Multimedia (videos) en Supabase Storage.
 *
 * Los adjuntos normales viven en la base de datos (lib/core/files.ts, máx. 8 MB). Los videos pesan más y,
 * además, Vercel no deja pasar más de 4,5 MB por una función: por eso el navegador los sube DIRECTO a
 * Supabase con una URL firmada de un solo uso, y aquí solo se registra el FileObject con
 * storageKey "sb:<ruta>" (sin contenido en la base de datos).
 *
 * Bucket privado: para ver un video se firma una URL temporal (ruta /files/<id> o signedMediaUrl).
 * Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (solo en el servidor; nunca llegan al navegador).
 */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // límite por archivo del plan gratis de Supabase
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "orkest-media";

export class MediaError extends Error {}

export const mediaConfigured = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

function api(path: string, init: RequestInit = {}) {
  const base = process.env.SUPABASE_URL!.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return fetch(`${base}/storage/v1${path}`, {
    ...init,
    headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
}
const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

let bucketReady: Promise<void> | null = null;
/** Crea el bucket privado la primera vez (idempotente). */
function ensureBucket() {
  bucketReady ??= (async () => {
    const res = await api("/bucket", {
      method: "POST",
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_VIDEO_BYTES, allowed_mime_types: [...VIDEO_TYPES] }),
    });
    if (!res.ok) {
      const t = await res.text();
      if (!/already exists|Duplicate|409/i.test(t + res.status)) {
        bucketReady = null;
        throw new MediaError(`No se pudo preparar el almacenamiento de videos (${res.status})`);
      }
    }
  })();
  return bucketReady;
}

/** Ruta del objeto: siempre bajo la carpeta de la organización. */
export const mediaPrefix = (orgId: string) => `${orgId}/`;

/**
 * Pide una URL de subida firmada para un video. Devuelve la URL completa (el navegador hace PUT del archivo)
 * y la ruta, que luego se confirma con registerMedia.
 */
export async function createVideoUpload(ctx: ExecContext, f: { name: string; type: string; size: number; folder: string }) {
  if (!mediaConfigured()) throw new MediaError("El almacenamiento de videos aún no está configurado");
  if (!(VIDEO_TYPES as readonly string[]).includes(f.type)) throw new MediaError("Formato no permitido: usa MP4, WebM o MOV");
  if (!(f.size > 0)) throw new MediaError("El archivo está vacío");
  if (f.size > MAX_VIDEO_BYTES) throw new MediaError(`El video supera ${MAX_VIDEO_BYTES / 1024 / 1024} MB; comprímelo antes de subirlo`);
  await ensureBucket();
  const safe = f.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-").slice(-80) || "video";
  const rand = crypto.randomUUID().slice(0, 12);
  const path = `${mediaPrefix(ctx.orgId)}${f.folder.replace(/[^\w-]/g, "")}/${rand}-${safe}`;
  const res = await api(`/object/upload/sign/${BUCKET}/${enc(path)}`, { method: "POST", body: "{}" });
  if (!res.ok) throw new MediaError(`No se pudo autorizar la subida (${res.status})`);
  const { url } = (await res.json()) as { url: string };
  return { path, uploadUrl: `${process.env.SUPABASE_URL!.replace(/\/+$/, "")}/storage/v1${url}` };
}

/** Registra un video ya subido como FileObject (storageKey "sb:<ruta>"). */
export async function registerMedia(ctx: ExecContext, f: { path: string; name: string; type: string; size: number; entityType: string; entityId?: string | null }) {
  // La ruta la emitió createVideoUpload para ESTA organización; una ruta ajena no se acepta
  if (!f.path.startsWith(mediaPrefix(ctx.orgId)) || f.path.includes("..")) throw new MediaError("Ruta de archivo inválida");
  if (!(VIDEO_TYPES as readonly string[]).includes(f.type)) throw new MediaError("Formato no permitido");
  const info = await api(`/object/info/${BUCKET}/${enc(f.path)}`);
  if (!info.ok) throw new MediaError("No se encontró el video subido; vuelve a intentarlo");
  const file = await ctx.db.fileObject.create({
    data: {
      organizationId: ctx.orgId, name: f.name.slice(0, 200) || "video", mimeType: f.type, size: Math.min(f.size, MAX_VIDEO_BYTES),
      storageKey: `sb:${f.path}`, entityType: f.entityType, entityId: f.entityId ?? null, uploadedById: ctx.actorId,
    },
    select: { id: true },
  });
  return file.id;
}

/** URL temporal para reproducir un objeto del bucket. */
export async function signedMediaUrl(storageKey: string, expiresIn = 60 * 60 * 6) {
  if (!storageKey.startsWith("sb:") || !mediaConfigured()) return null;
  const res = await api(`/object/sign/${BUCKET}/${enc(storageKey.slice(3))}`, { method: "POST", body: JSON.stringify({ expiresIn }) });
  if (!res.ok) return null;
  const { signedURL } = (await res.json()) as { signedURL: string };
  return `${process.env.SUPABASE_URL!.replace(/\/+$/, "")}/storage/v1${signedURL}`;
}

/** Borra el objeto del bucket y su FileObject. */
export async function deleteMedia(ctx: ExecContext, fileId: string) {
  const f = await ctx.db.fileObject.findUnique({ where: { id: fileId } });
  if (!f) return;
  if (f.storageKey.startsWith("sb:") && mediaConfigured()) {
    await api(`/object/${BUCKET}`, { method: "DELETE", body: JSON.stringify({ prefixes: [f.storageKey.slice(3)] }) }).catch(() => undefined);
  }
  await ctx.db.fileObject.delete({ where: { id: fileId } });
}
