import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/lib/core/context";
import { canReadHrFile } from "@/lib/apps/hr";
import { signedMediaUrl } from "@/lib/core/media";

/**
 * Descarga de un archivo (FileObject) de la organización activa.
 * Los adjuntos de talento humano (entityType "hr_*") aplican además su propia regla de acceso.
 */
export async function GET(req: NextRequest, { params }: RouteContext<"/files/[id]">) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const f = await ctx.db.fileObject.findFirst({ where: { id } });
  if (!f) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  if (f.entityType?.startsWith("hr_") && !(await canReadHrFile(ctx, f))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  // Multimedia en Supabase Storage: redirige a una URL firmada de corta duración (soporta rangos para <video>)
  if (f.storageKey.startsWith("sb:")) {
    const url = await signedMediaUrl(f.storageKey, 60 * 30);
    if (!url) return NextResponse.json({ error: "Almacenamiento de videos no disponible" }, { status: 503 });
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  }
  if (!f.data) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  const download = req.nextUrl.searchParams.has("download");
  return new NextResponse(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mimeType,
      "Content-Length": String(f.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
