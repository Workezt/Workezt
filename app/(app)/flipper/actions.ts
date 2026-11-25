"use server";

import { actionContext } from "@/lib/core/context";
import { safeAction } from "@/lib/ui/action";
import { syncFlipper, type FlipperSyncPayload } from "@/lib/apps/flipper/server";

/** Guarda en la base de datos los cambios de Flipper (cada bloque valida su propio permiso). */
export async function saveFlipper(payload: FlipperSyncPayload) {
  return safeAction(async () => {
    const ctx = await actionContext("flipper.read", "flipper");
    await syncFlipper(ctx, payload);
    return { ok: "Guardado" };
  });
}
