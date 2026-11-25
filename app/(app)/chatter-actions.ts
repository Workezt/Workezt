"use server";

import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/core/context";
import { getEntity } from "@/lib/core/entities";
import { addActivity } from "@/lib/core/notify";
import { safeAction } from "@/lib/ui/action";
import type { ActionResult } from "@/components/action-form";
import { canSeeOwned } from "@/lib/core/scope";
import type { OrgContext } from "@/lib/core/context";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function requireActivityRecord(ctx: OrgContext, def: ReturnType<typeof getEntity>, id: string) {
  const row = await def.load(ctx.db, id);
  if (!row || (["quote", "sales_order"].includes(def.type) && !canSeeOwned(ctx, "sales", typeof row.ownerId === "string" ? row.ownerId : null))) {
    throw new Error("Registro no encontrado o sin acceso");
  }
}

/** Programa una actividad (tarea con vencimiento y responsable) ligada al registro. */
export async function scheduleActivity(_: ActionResult, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const def = getEntity(s(form, "entityType"));
    const ctx = await actionContext(def.readPermission, def.module);
    if (!s(form, "title")) return { error: "Escribe el resumen de la actividad" };
    const id = s(form, "entityId");
    await requireActivityRecord(ctx, def, id);
    const assigneeId = s(form, "assigneeId") || ctx.user.id;
    if (!(await ctx.db.membership.findFirst({ where: { userId: assigneeId, status: "ACTIVE" }, select: { id: true } }))) return { error: "Selecciona una persona activa de tu empresa" };
    const dueDate = s(form, "dueDate") ? new Date(s(form, "dueDate")) : new Date(Date.now() + 86400000);
    if (Number.isNaN(dueDate.getTime())) return { error: "Fecha de actividad inválida" };
    await ctx.db.task.create({ data: {
      organizationId: ctx.orgId, title: s(form, "title"), description: s(form, "kind") || null, assigneeId,
      dueDate, sourceType: def.type, sourceId: id,
    } });
    await addActivity(ctx, def.type, id, `Actividad programada: ${s(form, "title")}`, "SYSTEM");
    revalidatePath(def.path(id));
    return { ok: "Actividad programada" };
  });
}

export async function completeActivity(form: FormData) {
  const def = getEntity(s(form, "entityType"));
  const ctx = await actionContext(def.readPermission, def.module);
  const id = s(form, "entityId");
  await requireActivityRecord(ctx, def, id);
  const t = await ctx.db.task.update({ where: { id: s(form, "taskId"), sourceType: def.type, sourceId: id }, data: { status: "DONE" } });
  await addActivity(ctx, def.type, s(form, "entityId"), `Actividad completada: ${t.title}`, "SYSTEM");
  revalidatePath(def.path(s(form, "entityId")));
}
