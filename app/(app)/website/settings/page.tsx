import { headers } from "next/headers";
import Link from "@/components/plink";
import { requireModule } from "@/lib/core/context";
import { orgUsers } from "@/lib/core/members";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { btn, Card, Field, input, PageHeader } from "@/components/ui";
import { websiteConfig } from "@/lib/apps/website";
import { saveWebsite } from "../actions";

export const metadata = { title: "Formulario web" };

export default async function WebsiteSettings() {
  const ctx = await requireModule("website", "website.read");
  const c = websiteConfig(ctx.org.settings);
  const users = await orgUsers(ctx);
  const canWrite = ctx.can("website.write");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;
  const url = `${base}/f/${ctx.org.slug}`;
  const embed = `<iframe id="workezt-form" src="${url}?embed=1" title="Formulario de contacto" style="width:100%;border:0;min-height:640px" loading="lazy"></iframe>
<script>addEventListener("message",function(e){if(e.origin==="${base}"&&e.data&&e.data.type==="workezt-form-height"){document.getElementById("workezt-form").style.height=e.data.height+"px"}})</script>`;
  const check = "h-4 w-4 accent-[var(--ork-violet)]";

  return (
    <>
      <PageHeader title="Formulario web" crumbs={[{ label: "Solicitudes web", href: "/website" }, { label: "Formulario" }]}
        subtitle="Lo que ve el visitante, a quién le llega y cómo ponerlo en tu sitio web." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Configuración" className="lg:col-span-3">
          <ActionForm action={saveWebsite} className="space-y-4">
            <fieldset disabled={!canWrite} className="space-y-4">
              <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium">
                <input type="checkbox" name="enabled" defaultChecked={c.enabled} className={check} /> Formulario activo (recibe solicitudes)
              </label>
              <Field label="Título"><input name="title" defaultValue={c.title} maxLength={120} className={input} /></Field>
              <Field label="Texto de introducción"><textarea name="intro" defaultValue={c.intro} rows={2} maxLength={600} className={input} /></Field>
              <Field label="Opciones de “¿Qué te interesa?”" hint="Una por línea (productos, líneas o servicios). Vacío = no se pregunta.">
                <textarea name="interests" defaultValue={c.interests.join("\n")} rows={4} className={input} placeholder={"Empaques al vacío\nBolsas termoencogibles\nMaquinaria"} />
              </Field>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="askCompany" defaultChecked={c.askCompany} className={check} /> Preguntar empresa</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="askCity" defaultChecked={c.askCity} className={check} /> Preguntar ciudad</label>
              </div>
              <Field label="Mensaje al enviar"><input name="successMessage" defaultValue={c.successMessage} maxLength={300} className={input} /></Field>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Qué pasa con cada solicitud</p>
                <Field label="Responsable" hint="Recibe el aviso y queda como dueño de la oportunidad. Vacío = los propietarios de la cuenta.">
                  <select name="ownerId" defaultValue={c.ownerId ?? ""} className={input}>
                    <option value="">Propietarios de la cuenta</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
                <label className="mt-3 flex items-start gap-2.5 text-sm">
                  <input type="checkbox" name="autoConvert" defaultChecked={c.autoConvert} className={`${check} mt-0.5`} />
                  <span>Pasar automáticamente al CRM<span className="block text-xs text-slate-500">Crea el cliente (o usa el existente con ese correo), agrega el contacto y abre una oportunidad. Si lo apagas, revisas cada solicitud en la bandeja.</span></span>
                </label>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Datos de contacto junto al formulario</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="WhatsApp" hint="Con indicativo, p. ej. 573160268619"><input name="whatsapp" defaultValue={c.whatsapp} inputMode="tel" className={input} /></Field>
                  <Field label="Teléfono"><input name="phone" defaultValue={c.phone} className={input} /></Field>
                  <Field label="Correo"><input name="email" type="email" defaultValue={c.email} className={input} /></Field>
                  <Field label="Dirección"><input name="address" defaultValue={c.address} className={input} /></Field>
                </div>
                <Field label="Política de tratamiento de datos (URL)" className="mt-3" hint="Se enlaza en la autorización de datos (Ley 1581)."><input name="privacyUrl" defaultValue={c.privacyUrl} placeholder="https://…" className={input} /></Field>
              </div>
            </fieldset>
            {canWrite && <SubmitButton className={btn.primary}>Guardar formulario</SubmitButton>}
          </ActionForm>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Enlace directo">
            <p className="mb-2 text-sm text-slate-600">Compártelo en redes, correos o códigos QR.</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs">{url}</code>
              <CopyButton text={url} />
            </div>
            {c.enabled ? <Link href={`/f/${ctx.org.slug}`} target="_blank" className="mt-3 inline-block text-sm text-[var(--ork-violet)] hover:underline">Abrir formulario ↗</Link>
              : <p className="mt-3 text-xs text-amber-700">Actívalo para que el enlace funcione.</p>}
          </Card>
          <Card title="Incrustar en tu sitio web">
            <p className="mb-2 text-sm text-slate-600">Pega este código en la página de contacto (por ejemplo, en un bloque HTML de tu sitio). El alto se ajusta solo.</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{embed}</pre>
            <div className="mt-2"><CopyButton text={embed} label="Copiar código" /></div>
          </Card>
        </div>
      </div>
    </>
  );
}
