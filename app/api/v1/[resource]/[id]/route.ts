import { NextResponse } from "next/server";
import { apiContext, apiError } from "@/lib/core/api-auth";
import { resourceFor, shape, canReadResourceRow } from "@/lib/core/api-v1";

/** GET /api/v1/{recurso}/{id} — un registro de la organización. */
export async function GET(req: Request, { params }: RouteContext<"/api/v1/[resource]/[id]">) {
  const ctx = await apiContext(req);
  if (!ctx) return apiError(401, "No autenticado");
  const { resource, id } = await params;
  const r = resourceFor(ctx, resource, "read");
  if ("error" in r) return r.error;
  try {
    const row = await r.def.load(ctx.db, id);
    if (!row || !canReadResourceRow(ctx, r.res, row)) return apiError(404, "Registro no encontrado");
    return NextResponse.json({ data: shape(ctx, r.res, row) });
  } catch (error) {
    console.error("[api/v1] detail", resource, error);
    return apiError(500, "No se pudo consultar el recurso");
  }
}
