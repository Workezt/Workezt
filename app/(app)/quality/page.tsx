import Link from "@/components/plink";
import { requireModule } from "@/lib/core/context";
import { Badge, btn, Card, PageHeader, SEVERITY_LABEL, SEVERITY_TONE, Table, td } from "@/components/ui";
import { date } from "@/lib/ui/format";

export const metadata = { title: "Calidad" };

export default async function Quality() {
  const ctx = await requireModule("quality", "quality.read");
  const ncs = await ctx.db.nonconformity.findMany({ include: { supplier: true }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="No conformidades" subtitle={`${ncs.filter((n) => n.status === "open").length} abiertas`}
        actions={ctx.can("quality.write") && <Link href="/quality/new" className={btn.primary}>Registrar no conformidad</Link>} />
      <Card padded={false}>
        <Table head={["Código", "Descripción", "Proveedor", "Severidad", "Fecha"]} empty={ncs.length === 0}>
          {ncs.map((n) => (
            <tr key={n.id}>
              <td className={`${td} font-mono text-xs`}>{n.code}</td>
              <td className={td}>{n.title}</td>
              <td className={td}>{n.supplier?.name ?? "—"}</td>
              <td className={td}><Badge tone={SEVERITY_TONE[n.severity]}>{SEVERITY_LABEL[n.severity]}</Badge></td>
              <td className={td}>{date(n.createdAt)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
