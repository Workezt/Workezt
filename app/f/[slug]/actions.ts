"use server";

import { headers } from "next/headers";
import { submitLead } from "@/lib/apps/website";
import { ValidationError } from "@/lib/apps/crm";

export type PublicFormState = { ok?: string; error?: string; errors?: Record<string, string> } | undefined;

/** Envío del formulario público (sin sesión). */
export async function sendLead(slug: string, _: PublicFormState, form: FormData): Promise<PublicFormState> {
  const h = await headers();
  const s = (k: string) => String(form.get(k) ?? "");
  const utm = Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map((k) => [k, s(k).slice(0, 120)]).filter(([, v]) => v));
  try {
    await submitLead(
      slug,
      {
        name: s("name"), company: s("company"), email: s("email"), phone: s("phone"), city: s("city"),
        interest: s("interest"), message: s("message"), consent: form.get("consent") === "on",
      },
      {
        ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local",
        userAgent: h.get("user-agent") ?? "",
        source: s("src") || h.get("referer") || "",
        utm,
        startedAt: Number(s("t")) || 0,
        honeypot: s("website"),
      },
    );
    return { ok: "sent" };
  } catch (e) {
    if (e instanceof ValidationError) {
      const values = Object.values(e.errors);
      return { error: values.length === 1 ? values[0] : "Revisa los datos marcados", errors: e.errors };
    }
    console.error("[ORKEST] Error en formulario público:", e);
    return { error: "No pudimos enviar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp." };
  }
}
