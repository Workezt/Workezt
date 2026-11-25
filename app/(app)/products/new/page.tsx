import { requireModule } from "@/lib/core/context";
import { getFieldDefs } from "@/lib/core/custom-fields";
import { RecordTopBar } from "@/components/record/top-bar";
import { ProductForm } from "../product-form";

export default async function NewProduct({ searchParams }: PageProps<"/products/new">) {
  const ctx = await requireModule("products", "products.write");
  const combo = (await searchParams).kind === "COMBO";
  const [defs, cats, suppliers] = await Promise.all([
    getFieldDefs(ctx.db, "product"),
    ctx.db.product.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true } }),
    ctx.hasModule("purchasing") ? ctx.db.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  return (
    <>
      <RecordTopBar listLabel={combo ? "Combos" : "Productos"} listHref={combo ? "/products/combos" : "/products"} title={combo ? "Nuevo combo" : "Nuevo"} />
      <ProductForm canWrite hideCost={ctx.restricted("deny:costs")} defs={defs} suppliers={suppliers} categories={cats.map((c) => c.category!)}
        product={{ sku: "", name: "", category: null, unit: "UND", price: 0, cost: 0, minStock: 0, taxRate: 19, kind: combo ? "COMBO" : "GOODS", invoicePolicy: "ORDER", defaultSupplierId: null, canBeSold: true, canBePurchased: !combo, customFields: {} }} />
    </>
  );
}
