"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/core/context";
import { deleteSimulation, duplicateSimulation, saveSimulation } from "@/lib/apps/pricing";
import { safeAction } from "@/lib/ui/action";
import type { ActionResult } from "@/components/action-form";

export async function saveSimulationAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const ctx = await actionContext("sales.quotes.read", "sales");
    const d = JSON.parse(String(form.get("payload") ?? "{}"));
    const id = await saveSimulation(ctx, String(form.get("id") ?? "") || null, {
      name: String(d.name ?? ""), shipping: Number(d.shipping) || 0, picking: Number(d.picking) || 0,
      commissionPct: Number(d.commissionPct) || 0, campaignPct: Number(d.campaignPct) || 0, marginPct: Number(d.marginPct) || 0,
      items: (Array.isArray(d.items) ? d.items : []).map((i: Record<string, unknown>) => ({ productId: (i.productId as string) || null, name: String(i.name ?? ""), quantity: Number(i.quantity) || 0, unitCost: Number(i.unitCost) || 0 })),
    });
    revalidatePath("/sales/calculator");
    if (!form.get("id")) redirect(`/sales/calculator?id=${id}`);
    return { ok: "Simulación guardada" };
  });
}

export async function deleteSimulationAction(form: FormData) {
  const ctx = await actionContext("sales.quotes.read", "sales");
  await deleteSimulation(ctx, String(form.get("id") ?? ""));
  revalidatePath("/sales/calculator");
  redirect("/sales/calculator");
}

export async function duplicateSimulationAction(form: FormData) {
  const ctx = await actionContext("sales.quotes.read", "sales");
  const id = await duplicateSimulation(ctx, String(form.get("id") ?? ""));
  revalidatePath("/sales/calculator");
  redirect(`/sales/calculator?id=${id}`);
}
