import Link from "@/components/plink";
import { requireModule } from "@/lib/core/context";
import { orgPeople, orgUsers } from "@/lib/core/members";
import { goodPieces, qualityPct, runEfficiency } from "@/lib/apps/plant";
import { hhmm, rangeFrom } from "@/lib/apps/ops-shared";
import { Badge, btn, Card, PageHeader, Stat, Table, td } from "@/components/ui";
import { date, num } from "@/lib/ui/format";

export const metadata = { title: "Corridas de inyección" };

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 10) / 10} %`);

/** Planilla diaria de inyección: una corrida por máquina, operario y orden. */
export default async function InjectionRuns({ searchParams }: PageProps<"/manufacturing/runs">) {
  const ctx = await requireModule("manufacturing", "manufacturing.read");
  const sp = await searchParams;
  const { from, to, where } = rangeFrom(sp, 7);
  const machineId = typeof sp.machine === "string" ? sp.machine : "";
  const operatorId = typeof sp.operator === "string" ? sp.operator : "";
  const canWrite = ctx.can("manufacturing.write");
  const [runs, machines, products, users, people] = await Promise.all([
    ctx.db.productionRun.findMany({ where: { productionDate: where, ...(machineId ? { workCenterId: machineId } : {}), ...(operatorId ? { operatorId } : {}) }, orderBy: [{ productionDate: "desc" }, { startTime: "desc" }], take: 500 }),
    ctx.db.workCenter.findMany({ where: { kind: "MACHINE" }, orderBy: { code: "asc" } }),
    ctx.db.product.findMany({ where: { active: true, kind: "GOODS" }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true } }),
    orgUsers(ctx),
    orgPeople(ctx),
  ]);
  const machine = new Map(machines.map((m) => [m.id, m]));
  const product = new Map(products.map((p) => [p.id, p.name]));
  const who = new Map(people.map((p) => [p.id, p.name]));
  const produced = runs.reduce((s, r) => s + r.produced, 0);
  const good = runs.reduce((s, r) => s + goodPieces(r), 0);
  const effs = runs.map((r) => runEfficiency(r).efficiency).filter((e): e is number => e !== null);
  const qs = new URLSearchParams({ from, to, ...(machineId ? { machine: machineId } : {}), ...(operatorId ? { operator: operatorId } : {}) }).toString();

  return (
    <>
      <PageHeader title="Corridas de inyección" subtitle="Registro diario por máquina: material, parámetros, piezas producidas, calidad y eficiencia teórica."
        actions={<>
          <Link href={`/print/production-runs?${qs}`} className={btn.secondary}>Imprimir planilla</Link>
          {canWrite && <Link href="/manufacturing/runs/new" className={btn.primary}>Registrar corrida</Link>}
        </>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Corridas" value={runs.length} />
        <Stat label="Piezas producidas" value={num(produced)} />
        <Stat label="Piezas buenas" value={num(good)} />
        <Stat label="Calidad" value={pct(produced ? (good / produced) * 100 : null)} />
        <Stat label="Eficiencia promedio" value={pct(effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : null)} hint="vs. ciclo y cavidades" />
      </div>
      <form className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <label className="text-xs text-slate-500">Desde<input type="date" name="from" defaultValue={from} className="ml-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm" /></label>
        <label className="text-xs text-slate-500">Hasta<input type="date" name="to" defaultValue={to} className="ml-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm" /></label>
        <select name="machine" defaultValue={machineId} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm"><option value="">Todas las máquinas</option>{machines.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select>
        <select name="operator" defaultValue={operatorId} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm"><option value="">Todos los operarios</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <button className={btn.small}>Aplicar</button>
      </form>
      <Card padded={false}>
        <Table head={["Fecha", "Máquina", "OP", "Producto", "Operario", "Horario", "Producidas", "Dañadas / NC", "Calidad", "Eficiencia"]} empty={runs.length === 0}>
          {runs.map((r) => {
            const e = runEfficiency(r);
            return (
              <tr key={r.id}>
                <td className={td}>{date(r.productionDate)}</td>
                <td className={td}>{machine.get(r.workCenterId)?.code ?? "—"}</td>
                <td className={`${td} font-mono text-xs`}>{r.productionId ? <Link href={`/manufacturing/orders/${r.productionId}`} className="underline">{r.orderNumber}</Link> : r.orderNumber}</td>
                <td className={td}>{r.productId ? product.get(r.productId) ?? "—" : r.manualProductName}<p className="text-xs text-slate-400">{r.material}{r.pigmentColor ? ` · ${r.pigmentColor}` : ""}</p></td>
                <td className={td}>{who.get(r.operatorId) ?? "—"}</td>
                <td className={`${td} whitespace-nowrap tabular-nums`}>{hhmm(r.startTime)}–{hhmm(r.endTime)}{r.downtimeMinutes > 0 && <p className="text-xs text-[var(--ork-pink)]">{r.downtimeMinutes} min detenida</p>}</td>
                <td className={`${td} tabular-nums`}>{num(r.produced)}</td>
                <td className={`${td} tabular-nums`}>{r.damaged} / {r.nonConforming}</td>
                <td className={td}><Badge tone={qualityPct(r) >= 98 ? "emerald" : qualityPct(r) >= 95 ? "amber" : "rose"}>{pct(qualityPct(r))}</Badge></td>
                <td className={td}>{e.efficiency === null ? "—" : <Badge tone={e.efficiency >= 90 ? "emerald" : e.efficiency >= 75 ? "amber" : "rose"}>{pct(e.efficiency)}</Badge>}<p className="text-xs text-slate-400">esperadas {num(e.expected)}</p></td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
