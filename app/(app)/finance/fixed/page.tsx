import Link from "@/components/plink";
import { requireModule } from "@/lib/core/context";
import { Badge, btn, Card, PageHeader, Table, td } from "@/components/ui";
import { money } from "@/lib/ui/format";
import { addMonths, CATEGORY_LABEL, dueInMonth, localDay, monthStart, ymOf, FREQ_LABEL, monthlyEquivalent, type Frequency } from "@/lib/apps/finance";
import { deleteRecurring, toggleRecurring } from "../actions";
import { RowAction } from "../shared";

export const metadata = { title: "Gastos fijos · Finanzas" };

export default async function FixedCosts() {
  const ctx = await requireModule("finance", "finance.read");
  const recurring = (await ctx.db.finRecurringCost.findMany({ orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }] })).map((r) => ({ ...r, amount: Number(r.amount) }));
  const cur = ctx.org.currency;
  const canWrite = ctx.can("finance.write");
  const today = localDay();
  const thisYm = today.slice(0, 7);
  // Cuotas ya pagadas de este mes y el siguiente (gasto enlazado al gasto fijo)
  const paid = new Set(
    (await ctx.db.finExpense.findMany({ where: { recurringId: { not: null }, spentOn: { gte: monthStart(thisYm), lt: monthStart(addMonths(thisYm, 2)) } }, select: { recurringId: true, spentOn: true } }))
      .map((e) => `${e.recurringId}:${ymOf(e.spentOn)}`),
  );
  /** Próxima cuota sin pagar desde hoy (busca hasta 13 meses). */
  const nextDue = (r: (typeof recurring)[number]) => {
    for (let i = 0; i < 14; i++) {
      const m = addMonths(thisYm, i);
      const d = dueInMonth(r, m);
      if (d && d >= today && !paid.has(`${r.id}:${m}`)) return d;
    }
    return null;
  };
  const active = recurring.filter((r) => r.active);
  const monthly = active.reduce((a, r) => a + monthlyEquivalent(r), 0);

  return (
    <>
      <PageHeader title="Gastos fijos" subtitle={`Arriendo, servicios, software y demás costos que se repiten. Pesan ${money(monthly, cur)} al mes (${money(monthly * 12, cur)} al año).`}
        actions={canWrite && <Link href="/finance/fixed/new" className={btn.primary}>Nuevo gasto fijo</Link>} />
      <Card padded={false}>
        <Table head={["Gasto", "Frecuencia", "Valor", "Al mes", "Próximo pago", ""]} empty={recurring.length === 0}>
          {recurring.map((r) => {
            const next = r.active ? nextDue(r) : null;
            return (
              <tr key={r.id} className={r.active ? "" : "opacity-50"}>
                <td className={td}>
                  <span className="font-medium whitespace-nowrap">{r.name}</span>
                  <p className="text-xs text-slate-400">{CATEGORY_LABEL[r.category] ?? r.category}{r.vendor && ` · ${r.vendor}`}</p>
                </td>
                <td className={td}>{FREQ_LABEL[r.frequency as Frequency] ?? r.frequency}<p className="text-xs text-slate-400">Día {r.dueDay}</p></td>
                <td className={`${td} text-right font-mono tabular-nums`}>{money(r.amount, cur)}</td>
                <td className={`${td} text-right font-mono tabular-nums text-slate-500`}>{money(Math.round(monthlyEquivalent(r)), cur)}</td>
                <td className={`${td} whitespace-nowrap`}>
                  {!r.active ? <Badge>Pausado</Badge> : next ? new Date(`${next}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : <Badge>Terminado</Badge>}
                </td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  {canWrite && (
                    <span className="inline-flex gap-1">
                      <RowAction action={toggleRecurring} fields={{ id: r.id }} label={r.active ? "Pausar" : "Reactivar"} />
                      <RowAction action={deleteRecurring} fields={{ id: r.id }} label="Eliminar" tone="danger" />
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
