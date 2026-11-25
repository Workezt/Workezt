import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publicForm, whatsappLink } from "@/lib/apps/website";
import { sendLead } from "./actions";
import { LeadForm } from "./lead-form";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ embed?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = await publicForm((await params).slug);
  return { title: f ? `${f.config.title} · ${f.name}` : "Formulario", robots: { index: false } };
}

const isColor = (c?: string) => !!c && /^#[0-9a-f]{3,8}$/i.test(c);

/** Formulario público de contacto de una empresa. ?embed=1 lo muestra sin marco para incrustarlo en su sitio. */
export default async function PublicLeadForm({ params, searchParams }: Props) {
  const [{ slug }, { embed }] = await Promise.all([params, searchParams]);
  const f = await publicForm(slug);
  if (!f) notFound();
  const c = f.config;
  const accent = isColor(f.color) ? f.color! : "#5b21b6";
  const wa = c.whatsapp ? whatsappLink(c.whatsapp, `Hola ${f.name}, quiero información.`) : null;
  // eslint-disable-next-line react-hooks/purity -- marca de tiempo del render para el control antirrobots
  const startedAt = Date.now();

  const form = (
    <LeadForm
      action={sendLead.bind(null, f.slug)}
      startedAt={startedAt}
      interests={c.interests}
      askCompany={c.askCompany}
      askCity={c.askCity}
      successMessage={c.successMessage}
      privacyUrl={c.privacyUrl}
      orgName={f.name}
      whatsappHref={wa}
    />
  );
  const style = { ["--lf-accent" as string]: accent };

  if (embed === "1") {
    return <main style={style} className="bg-transparent p-1">{form}</main>;
  }

  return (
    <main style={style} className="min-h-screen bg-[#f5f6f8] px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo configurado por la empresa */}
          {f.logoUrl ? <img src={f.logoUrl} alt={f.name} className="h-10 w-auto max-w-44 object-contain" /> : <span className="text-xl font-bold text-slate-900">{f.name}</span>}
        </header>
        <div className="grid gap-8 md:grid-cols-[1fr_15rem]">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{c.title}</h1>
            {c.intro && <p className="mt-2 text-[15px] text-slate-600">{c.intro}</p>}
            <div className="mt-6">{form}</div>
          </section>
          {(wa || c.phone || c.email || c.address) && (
            <aside className="space-y-4 text-sm text-slate-600">
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 font-semibold text-white shadow-sm transition hover:brightness-105">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" /></svg>
                  Escríbenos por WhatsApp
                </a>
              )}
              <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                {c.phone && <p><span className="block text-xs text-slate-400">Teléfono</span><a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="font-medium text-slate-800">{c.phone}</a></p>}
                {c.email && <p><span className="block text-xs text-slate-400">Correo</span><a href={`mailto:${c.email}`} className="break-all font-medium text-slate-800">{c.email}</a></p>}
                {c.address && <p><span className="block text-xs text-slate-400">Dirección</span><span className="font-medium text-slate-800">{c.address}</span></p>}
              </div>
            </aside>
          )}
        </div>
        <p className="mt-10 text-center text-[11px] text-slate-400">Formulario seguro · Workezt by OR-K</p>
      </div>
    </main>
  );
}
