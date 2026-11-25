import { ActionForm, SubmitButton } from "@/components/action-form";
import { btn, input, Field } from "@/components/ui";
import { login } from "./actions";
import { WorkeztLogo } from "@/components/workezt-logo";

const DEV = process.env.NODE_ENV !== "production";

/** Marca de una empresa para su login propio (/login/<slug>). Sin marca = login general de Workezt. */
export type LoginBrand = { slug: string; name: string; logoUrl?: string; videoUrl?: string | null };

export function LoginScreen({ next, brand }: { next?: string; brand?: LoginBrand }) {
  return (
    <main className="grid min-h-screen bg-[var(--ork-paper-light)] lg:grid-cols-[1.25fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[var(--wz-night)] lg:block">
        {brand?.videoUrl ? (
          <>
            <video src={brand.videoUrl} autoPlay muted loop playsInline aria-hidden="true" className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/20" />
          </>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- imagen estática de marca */
          <img src="/brand/workezt-orca.jpg" alt="" className="absolute bottom-[7%] right-0 w-full max-w-none [mask-image:linear-gradient(90deg,transparent,#000_45%)]" />
        )}
        <div className="relative flex h-full flex-col justify-between p-12">
          {brand ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo configurado por la empresa */}
              {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.name} className="h-10 w-auto max-w-52 rounded-md bg-white/90 object-contain p-1.5" /> : <span className="font-display text-2xl font-bold text-white">{brand.name}</span>}
            </div>
          ) : <WorkeztLogo size={34} tone="light" byOrk />}
          {brand ? (
            <div className="max-w-md">
              <h1 className="font-display text-5xl font-bold leading-[1.04] tracking-tight text-white">{brand.name}</h1>
              <p className="mt-4 flex items-center gap-2 text-sm text-white/75">Opera con <WorkeztLogo size={18} tone="light" /></p>
            </div>
          ) : (
          <div className="max-w-md">
            <h1 className="font-display text-6xl font-bold leading-[1.02] tracking-tight text-white">
              Tu empresa,<br />en arm<span className="text-[#c4a6ff]">onía.</span>
            </h1>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/75">
              ERP, CRM, procesos, conocimiento, automatización e inteligencia en una sola plataforma.
              Cada empresa se configura; ninguna se reprograma.
            </p>
          </div>
          )}
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Understand · Transform · Scale</p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo configurado por la empresa */}
            {brand?.logoUrl ? <img src={brand.logoUrl} alt={brand.name} className="h-9 w-auto max-w-48 object-contain" /> : brand ? <span className="font-display text-2xl font-bold">{brand.name}</span> : <WorkeztLogo size={28} byOrk />}
          </div>
          <h2 className="font-display text-4xl font-bold leading-none">Ingresar</h2>
          <p className="mt-2 text-sm text-stone-500">
            Accede a tu espacio de trabajo{brand ? <> de <span className="font-semibold text-[var(--ork-ink)]">{brand.name}</span></> : null} en <span className="font-semibold text-[var(--ork-violet)]">Workezt</span>.
          </p>
          <ActionForm action={login} className="mt-8 space-y-4">
            <input type="hidden" name="next" value={next ?? ""} />
            {brand && <input type="hidden" name="org" value={brand.slug} />}
            <Field label="Email"><input name="email" type="email" required autoComplete="email" className={input} defaultValue={DEV ? "admin@presservac.co" : undefined} /></Field>
            <Field label="Contraseña"><input name="password" type="password" required autoComplete="current-password" className={input} defaultValue={DEV ? "orkest123" : undefined} /></Field>
            <SubmitButton className={`${btn.primary} w-full py-2.5`} pendingText="Ingresando…">Ingresar →</SubmitButton>
          </ActionForm>
          {DEV && !brand && (
            <div className="mt-8 rounded-2xl border border-[var(--ork-rule)] bg-white/70 p-4 text-xs text-stone-500">
              <p className="font-semibold uppercase tracking-[0.12em] text-stone-700">Demo · clave orkest123</p>
              <ul className="mt-2 space-y-0.5">
                <li>admin@presservac.co — Propietario</li>
                <li>gerencia@presservac.co — Gerencia (aprobaciones)</li>
                <li>comercial@presservac.co — Comercial (2 empresas)</li>
                <li>plataforma@or-k.co — Panel global OR-K</li>
              </ul>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
