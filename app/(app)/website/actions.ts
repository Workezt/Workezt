"use server";

import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/core/context";
import { safeAction } from "@/lib/ui/action";
import type { ActionResult } from "@/components/action-form";
import { convertLead, discardLead, reopenLead, saveWebsiteConfig } from "@/lib/apps/website";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function saveWebsite(_: ActionResult, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const ctx = await actionContext("website.write", "website");
    await saveWebsiteConfig(ctx, {
      enabled: form.get("enabled") === "on",
      autoConvert: form.get("autoConvert") === "on",
      askCompany: form.get("askCompany") === "on",
      askCity: form.get("askCity") === "on",
      title: s(form, "title"), intro: s(form, "intro"), successMessage: s(form, "successMessage"),
      interests: s(form, "interests").split("\n"),
      whatsapp: s(form, "whatsapp"), phone: s(form, "phone"), email: s(form, "email"), address: s(form, "address"),
      ownerId: s(form, "ownerId") || null, privacyUrl: s(form, "privacyUrl"),
    });
    revalidatePath("/website", "layout");
    return { ok: "Formulario guardado" };
  });
}

export async function convertLeadAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const ctx = await actionContext("website.write", "website");
    if (!ctx.hasModule("crm")) throw new Error("Activa la app CRM para pasar solicitudes a oportunidades");
    await convertLead(ctx, s(form, "id"));
    revalidatePath("/website");
    return { ok: "Pasada al CRM" };
  });
}

export async function discardLeadAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const ctx = await actionContext("website.write", "website");
    await discardLead(ctx, s(form, "id"));
    revalidatePath("/website");
    return { ok: "Descartada" };
  });
}

export async function reopenLeadAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const ctx = await actionContext("website.write", "website");
    await reopenLead(ctx, s(form, "id"));
    revalidatePath("/website");
    return { ok: "Reabierta" };
  });
}
