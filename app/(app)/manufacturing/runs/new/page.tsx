import Link from "@/components/plink";
import { btn, Card, PageHeader } from "@/components/ui";
import { todayKey } from "@/lib/apps/ops-shared";
import { requireModule } from "@/lib/core/context";
import { orgUsers } from "@/lib/core/members";
import { InjectionRunForm } from "./injection-run-form";

export const metadata = { title: "Registrar corrida de inyección" };

export default async function NewInjectionRun() {
  const ctx = await requireModule("manufacturing", "manufacturing.write");
  const [machines, orders, products, users, molds] = await Promise.all([
    ctx.db.workCenter.findMany({ where: { kind: "MACHINE", active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    ctx.db.productionOrder.findMany({ where: { status: { in: ["confirmed", "in_progress"] } }, orderBy: { scheduledAt: "asc" }, select: { id: true, number: true, productId: true } }),
    ctx.db.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, active: true, kind: true } }),
    orgUsers(ctx),
    ctx.db.mold.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  const productNames = new Map(products.map(({ id, name }) => [id, name]));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Registrar corrida de inyección"
        crumbs={[{ label: "Corridas de inyección", href: "/manufacturing/runs" }, { label: "Registrar corrida" }]}
      />
      {machines.length > 0 ? (
        <InjectionRunForm
          machines={machines.map(({ id, code, name }) => ({ id, label: `${code} · ${name}` }))}
          operators={users.map(({ id, name }) => ({ id, label: name }))}
          defaultOperator={ctx.user.id}
          products={products.filter(({ active, kind }) => active && kind === "GOODS").map(({ id, sku, name }) => ({ id, label: `${sku} · ${name}` }))}
          orders={orders.map(({ id, number, productId }) => ({ id, number, product: productNames.get(productId) }))}
          molds={molds.map(({ id, code, name }) => ({ id, label: `${code} · ${name}` }))}
          today={todayKey()}
        />
      ) : (
        <Card title="Hace falta una máquina activa">
          <Link href="/manufacturing/workcenters" className={btn.secondary}>Ir a centros de trabajo</Link>
        </Card>
      )}
    </div>
  );
}
