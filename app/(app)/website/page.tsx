import Link from "@/components/plink";
import { requireModule } from "@/lib/core/context";
import { Badge, Card, PageHeader, Stat, Table, td } from "@/components/ui";
import { RowAction } from "@/components/row-action";
import { dateTime } from "@/lib/ui/format";
import { websiteConfig } from "@/lib/apps/website";
import { convertLeadAction, discardLeadAction, reopenLeadAction } from "./actions";

export const metadata = { title: "Solicitudes web" };

const STATUS: Record<string, { label: string; tone: string }> = {
  NEW: { label: "Nueva", tone: "amber" },
  CONVERTED: { label: "En el CRM", tone: "emerald" },
  DISCARDED: { label: "Descartada", tone: "slate" },
};
const FILTERS = [["", "Todas"], ["NEW", "Nuevas"], ["CONVERTED", "En el CRM"], ["DISCARDED", "Descartadas"]] as const;

export default async function WebLeads({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireModule("website", "website.read");
  const { status } = await searchParams;
  const filter = status && status in STATUS ? status : undefined;
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [leads, counts, month] = await Promise.all([
    ctx.db.webLead.findMany({ where: filter ? { status: filter } : {}, orderBy: { createdAt: "desc" }, take: 200 }),
    ctx.db.webLead.groupBy({ by: ["status"], _count: true }),
    ctx.db.webLead.count({ where: { createdAt: { gte: since } } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const cfg = websiteConfig(ctx.org.settings);
  const canWrite = ctx.can("website.write");
  const total = counts.reduce((a, c) => a + c._count, 0);

  return (
    <>
      <PageHeader
        title="Solicitudes web"
        subtitle="Lo que llega por el formulario de contacto de tu sitio. Cada solicitud puede pasar al CRM como cliente y oportunidad."
        actions={<Link href="/website/settings" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:border-[var(--ork-violet)]">Configurar formulario</Link>}
      />

      {!cfg.enabled && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          El formulario está <b>apagado</b>: nadie puede enviarlo todavía. <Link href="/website/settings" className="font-medium underline">Actívalo y copia el código para tu sitio →</Link>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nuevas por atender" value={count("NEW")} href="/website?status=NEW" />
        <Stat label="Pasadas al CRM" value={count("CONVERTED")} hint={total ? `${Math.round((count("CONVERTED") / total) * 100)} % del total` : undefined} href="/website?status=CONVERTED" />
        <Stat label="Últimos 30 días" value={month} />
        <Stat label="Modo" value={<span className="text-base">{cfg.autoConvert ? "Automático" : "Revisión manual"}</span>} hint={cfg.autoConvert ? "Cada envío crea cliente y oportunidad" : "Tú decides cuáles pasan al CRM"} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={k ? `/website?status=${k}` : "/website"}
            className={`rounded-full border px-3 py-1 text-xs ${(filter ?? "") === k ? "border-[var(--ork-ink)] bg-[var(--ork-ink)] text-white" : "border-slate-300 bg-white hover:border-[var(--ork-violet)]"}`}>{l}</Link>
        ))}
      </div>

      <Card padded={false}>
        <Table head={["Recibida", "Contacto", "Interés y mensaje", "Origen", "Estado", ""]} empty={leads.length === 0}>
          {leads.map((l) => (
            <tr key={l.id}>
              <td className={`${td} whitespace-nowrap text-xs text-slate-500`}>{dateTime(l.createdAt)}</td>
              <td className={td}>
                <p className="font-medium">{l.name}</p>
                {l.company && <p className="text-xs text-slate-600">{l.company}</p>}
                <p className="text-xs text-slate-400">
                  <a href={`mailto:${l.email}`} className="hover:underline">{l.email}</a>
                  {l.phone && <> · <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">{l.phone}</a></>}
                  {l.city && <> · {l.city}</>}
                </p>
              </td>
              <td className={`${td} max-w-md`}>
                {l.interest && <Badge tone="violet">{l.interest}</Badge>}
                {l.message && <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-slate-600">{l.message}</p>}
              </td>
              <td className={`${td} max-w-[12rem] truncate text-xs text-slate-400`} title={l.source}>
                {(() => { try { return l.source ? new URL(l.source).hostname : "—"; } catch { return l.source || "—"; } })()}
                {(l.utm as Record<string, string>)?.utm_campaign && <p>Campaña: {(l.utm as Record<string, string>).utm_campaign}</p>}
              </td>
              <td className={td}>
                <Badge tone={STATUS[l.status]?.tone}>{STATUS[l.status]?.label ?? l.status}</Badge>
                {l.customerId && <p className="mt-1"><Link href={`/crm/customers/${l.customerId}`} className="text-xs text-[var(--ork-violet)] hover:underline">Ver cliente →</Link></p>}
              </td>
              <td className={`${td} whitespace-nowrap text-right`}>
                {canWrite && l.status === "NEW" && (
                  <span className="inline-flex gap-1">
                    <RowAction action={convertLeadAction} fields={{ id: l.id }} label="Pasar al CRM" />
                    <RowAction action={discardLeadAction} fields={{ id: l.id }} label="Descartar" tone="danger" />
                  </span>
                )}
                {canWrite && l.status === "DISCARDED" && <RowAction action={reopenLeadAction} fields={{ id: l.id }} label="Reabrir" />}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
