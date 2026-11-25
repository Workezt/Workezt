import { requirePermission } from "@/lib/core/context";
import { PageHeader } from "@/components/ui";
import { normalizeTheme } from "@/lib/ui/theme";
import { AppearanceEditor } from "./editor";
import { headers } from "next/headers";
import { Card } from "@/components/ui";
import { RemoveVideoButton, VideoUploader } from "@/components/video-uploader";
import { fileUrl } from "@/lib/core/files";
import { mediaConfigured } from "@/lib/core/media";

export const metadata = { title: "Apariencia" };

export default async function Appearance() {
  const ctx = await requirePermission("org.settings.manage");
  const b = ctx.org.branding;
  return (
    <>
      <PageHeader title="Apariencia" subtitle="Colores de la interfaz, fondo, tarjetas y el paquete de íconos de las apps. Elige un tema listo o ajusta cada detalle; la vista previa cambia al instante." />
      <AppearanceEditor initial={normalizeTheme(b.theme, b.primaryColor)} initialName={b.displayName ?? ""} initialLogo={b.logoUrl ?? ""} orgName={ctx.org.name} />
      <BrandVideos heroId={b.heroVideoId} loginId={b.loginVideoId} slug={ctx.org.slug} />
    </>
  );
}

/** Videos de marca: banner de bienvenida del inicio y fondo del login propio de la empresa. */
async function BrandVideos({ heroId, loginId, slug }: { heroId?: string; loginId?: string; slug: string }) {
  const ready = mediaConfigured();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const loginUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}/login/${slug}`;
  const slot = (title: string, hint: string, id: string | undefined, s: "hero" | "login", extra?: React.ReactNode) => (
    <div className="rounded-2xl border border-[var(--ork-rule)] p-4">
      <p className="font-medium text-[var(--ork-ink)]">{title}</p>
      <p className="mb-3 text-xs text-stone-500">{hint}</p>
      {id ? (
        <video src={fileUrl(id)} muted loop playsInline autoPlay preload="metadata" className="mb-3 aspect-video w-full rounded-xl bg-black object-cover" />
      ) : (
        <div className="mb-3 grid aspect-video w-full place-items-center rounded-xl border border-dashed border-stone-300 text-xs text-stone-400">Sin video</div>
      )}
      <div className="flex flex-wrap items-start gap-2">
        <VideoUploader target={{ kind: "brand", slot: s }} replace={!!id} disabled={!ready} />
        {id && <RemoveVideoButton target={{ kind: "brand", slot: s }} />}
      </div>
      {extra}
    </div>
  );
  return (
    <Card title="Videos de marca" className="mt-6">
      {!ready && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          El almacenamiento de videos aún no está configurado (faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor). Los botones se activan cuando esté listo.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {slot("Banner de inicio", "Se reproduce en silencio y en bucle en la bienvenida de Inicio, en lugar de la imagen.", heroId, "hero")}
        {slot("Login de la empresa", "Fondo de tu página de ingreso propia, con tu logo y nombre.", loginId, "login",
          <p className="mt-3 text-xs text-stone-500">Tu enlace de ingreso: <a href={loginUrl} target="_blank" rel="noreferrer" className="font-medium text-[var(--ork-violet)] hover:underline">{loginUrl}</a></p>)}
      </div>
    </Card>
  );
}
