"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { PublicFormState } from "./actions";

type Props = {
  action: (prev: PublicFormState, form: FormData) => Promise<PublicFormState>;
  startedAt: number;
  interests: string[];
  askCompany: boolean;
  askCity: boolean;
  successMessage: string;
  privacyUrl: string;
  orgName: string;
  whatsappHref: string | null;
};

const field = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 outline-none transition focus:border-[var(--lf-accent)] focus:ring-4 focus:ring-[var(--lf-accent)]/15";
const label = "mb-1 block text-[13px] font-medium text-slate-700";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-xl bg-[var(--lf-accent)] px-4 py-3 text-[15px] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60">
      {pending ? "Enviando…" : "Enviar solicitud"}
    </button>
  );
}

/** Formulario público. En modo incrustado avisa su alto a la página que lo contiene (postMessage). */
export function LeadForm(p: Props) {
  // Al enviar se agrega el origen: página que incrusta el formulario (referrer) o la propia URL, y los utm_* de la URL
  const [state, formAction] = useActionState((prev: PublicFormState, fd: FormData) => {
    const q = new URLSearchParams(window.location.search);
    fd.set("src", q.get("src") || document.referrer || window.location.href);
    for (const [k, v] of q.entries()) if (k.startsWith("utm_")) fd.set(k, v);
    return p.action(prev, fd);
  }, undefined);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.parent === window || !root.current) return;
    const send = () => window.parent.postMessage({ type: "workezt-form-height", height: document.documentElement.scrollHeight }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(root.current);
    send();
    return () => ro.disconnect();
  }, []);

  const err = (k: string) => state?.errors?.[k];

  if (state?.ok) {
    return (
      <div ref={root} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-2xl text-white">✓</div>
        <p className="text-[15px] font-medium text-emerald-900">{p.successMessage}</p>
        {p.whatsappHref && (
          <a href={p.whatsappHref} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white">
            ¿Prefieres escribirnos ya? WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <div ref={root}>
      <form action={formAction} className="space-y-4" noValidate={false}>
        {state?.error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{state.error}</div>}
        <input type="hidden" name="t" value={p.startedAt} />
        {/* Campo trampa: las personas no lo ven; los robots lo llenan */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Sitio web<input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={label}>Nombre completo *</span>
            <input name="name" required minLength={2} maxLength={120} autoComplete="name" className={field} aria-invalid={!!err("name")} />
            {err("name") && <span className="mt-1 block text-xs text-rose-600">{err("name")}</span>}
          </label>
          {p.askCompany && (
            <label className="block"><span className={label}>Empresa</span>
              <input name="company" maxLength={160} autoComplete="organization" className={field} />
            </label>
          )}
          <label className="block"><span className={label}>Correo electrónico *</span>
            <input name="email" type="email" required maxLength={160} autoComplete="email" className={field} aria-invalid={!!err("email")} />
            {err("email") && <span className="mt-1 block text-xs text-rose-600">{err("email")}</span>}
          </label>
          <label className="block"><span className={label}>Teléfono / celular</span>
            <input name="phone" type="tel" maxLength={40} autoComplete="tel" className={field} />
          </label>
          {p.askCity && (
            <label className="block"><span className={label}>Ciudad</span>
              <input name="city" maxLength={80} autoComplete="address-level2" className={field} />
            </label>
          )}
          {p.interests.length > 0 && (
            <label className="block"><span className={label}>¿Qué te interesa?</span>
              <select name="interest" defaultValue="" className={field}>
                <option value="">Selecciona…</option>
                {p.interests.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </label>
          )}
        </div>
        <label className="block"><span className={label}>Mensaje</span>
          <textarea name="message" rows={4} maxLength={3000} className={field} placeholder="Cuéntanos qué necesitas: producto, cantidades, fechas…" />
        </label>
        <label className="flex items-start gap-2.5 text-[13px] leading-snug text-slate-600">
          <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--lf-accent)]" />
          <span>
            Autorizo a {p.orgName} a tratar mis datos personales para atender esta solicitud, de acuerdo con la Ley 1581 de 2012
            {p.privacyUrl ? <> y su <a href={p.privacyUrl} target="_blank" rel="noopener noreferrer" className="underline">política de tratamiento de datos</a></> : null}. *
          </span>
        </label>
        {err("consent") && <span className="-mt-2 block text-xs text-rose-600">{err("consent")}</span>}
        <Submit />
      </form>
    </div>
  );
}
