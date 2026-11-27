import Link from "@/components/plink";
import { requireModule } from "@/lib/core/context";
import { rangeFrom } from "@/lib/apps/ops-shared";
import { OpsBadge, RangeFilter } from "@/components/ops";
import { btn, Card, PageHeader, Table, td } from "@/components/ui";
import { date } from "@/lib/ui/format";
import { resolveIncident } from "../actions";

export const metadata = { title: "Novedades de transporte" };

export default async function Incidents({ searchParams }: PageProps<"/logistics/incidents">) {
  const ctx = await requireModule("logistics", "logistics.read");
  const { from, to, where } = rangeFrom(await searchParams);
  const [incidents, vehicles, drivers] = await Promise.all([
    ctx.db.transportIncident.findMany({ where: { OR: [{ status: "OPEN" }, { date: where }] }, orderBy: [{ status: "asc" }, { date: "desc" }] }),
    ctx.db.vehicle.findMany({ orderBy: { plate: "asc" } }),
    ctx.db.driver.findMany({ orderBy: { fullName: "asc" } }),
  ]);
  const plate = new Map(vehicles.map((v) => [v.id, v.plate]));
  const driver = new Map(drivers.map((d) => [d.id, d.fullName]));
  const canWrite = ctx.can("logistics.write");
  return (
    <>
      <PageHeader title="Novedades" subtitle={`${incidents.filter((i) => i.status === "OPEN").length} abiertas`}
        actions={canWrite && <Link href="/logistics/incidents/new" className={btn.primary}>Registrar novedad</Link>} />
      <RangeFilter from={from} to={to} />
      <Card padded={false}>
        <Table head={["Fecha", "Tipo", "Vehículo / conductor", "Descripción", "Acción correctiva", "Estado"]} empty={incidents.length === 0}>
          {incidents.map((i) => (
            <tr key={i.id}>
              <td className={td}>{date(i.date)}</td>
              <td className={td}>{i.type}</td>
              <td className={td}>{i.vehicleId ? <span className="font-mono">{plate.get(i.vehicleId)}</span> : "—"}<p className="text-xs text-slate-400">{i.driverId ? driver.get(i.driverId) : ""}</p></td>
              <td className={td}>{i.description}</td>
              <td className={td}>
                {i.status === "OPEN" && canWrite ? (
                  <form action={resolveIncident} className="flex gap-1">
                    <input type="hidden" name="id" value={i.id} />
                    <input name="correctiveAction" defaultValue={i.correctiveAction ?? ""} placeholder="Acción tomada" className="w-40 rounded-full border border-slate-300 px-2 py-1 text-xs" />
                    <button className={btn.small}>Resolver</button>
                  </form>
                ) : i.correctiveAction ?? "—"}
              </td>
              <td className={td}><OpsBadge kind="incidentStatus" value={i.status} /></td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
