"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/core/context";
import { getFieldDefs, customFieldsFromForm } from "@/lib/core/custom-fields";
import { createProduct, setProductActive, updateProduct } from "@/lib/apps/inventory";
import { addPackPrice, removePackPrice } from "@/lib/apps/pricing";
import { addComboItem, removeComboItem } from "@/lib/apps/combos";
import { ValidationError } from "@/lib/apps/crm";
import { safeAction } from "@/lib/ui/action";
import type { ActionResult } from "@/components/action-form";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function saveProductForm(_: ActionResult, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const ctx = await actionContext("products.write", "products");
    const cf = customFieldsFromForm(await getFieldDefs(ctx.db, "product"), form);
    if (!cf.ok) throw new ValidationError(cf.errors);
    const payload = {
      sku: s(form, "sku"), name: s(form, "name"), category: s(form, "category") || undefined, unit: s(form, "unit") || "UND",
      price: s(form, "price") || 0, cost: s(form, "cost") || 0, minStock: s(form, "minStock") || 0, taxRate: s(form, "taxRate") || 19,
      kind: s(form, "kind") || "GOODS", invoicePolicy: s(form, "invoicePolicy") || "ORDER", defaultSupplierId: s(form, "defaultSupplierId") || null,
      canBeSold: form.get("canBeSold") === "on", canBePurchased: form.get("canBePurchased") === "on", customFields: cf.values,
    };
    const id = s(form, "id");
    // Un rol con costos ocultos no ve el campo: se conserva el costo actual
    if (ctx.restricted("deny:costs")) payload.cost = id ? String((await ctx.db.product.findUniqueOrThrow({ where: { id } })).cost) : 0;
    if (id) {
      await updateProduct(ctx, id, payload);
      revalidatePath(`/products/${id}`);
      return { ok: "Producto guardado" };
    }
    const p = await createProduct(ctx, { ...payload, stock: s(form, "stock") || 0 });
    redirect(`/products/${p.id}`);
  });
}

export async function toggleArchive(form: FormData) {
  const ctx = await actionContext("products.write", "products");
  await setProductActive(ctx, s(form, "id"), s(form, "active") === "1");
  revalidatePath(`/products/${s(form, "id")}`);
}

export async function addPackPriceAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const ctx = await actionContext("products.write", "products");
    const productId = s(form, "productId");
    await addPackPrice(ctx, productId, { label: s(form, "label"), qty: Number(s(form, "qty")), totalPrice: Number(s(form, "totalPrice")) });
    revalidatePath(`/products/${productId}`);
    return { ok: "Paquete agregado" };
  });
}

export async function removePackPriceAction(form: FormData) {
  const ctx = await actionContext("products.write", "products");
  const pack = await removePackPrice(ctx, s(form, "id"));
  revalidatePath(`/products/${pack.productId}`);
}

export async function addComboItemAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const ctx = await actionContext("products.write", "products");
    const comboId = s(form, "comboId");
    // El buscador entrega "[SKU] Nombre": se resuelve por SKU
    const sku = s(form, "component").match(/^\[(.+?)\]/)?.[1] ?? s(form, "component");
    const part = await ctx.db.product.findFirst({ where: { sku } });
    if (!part) throw new ValidationError({ component: "Elige un producto de la lista" });
    await addComboItem(ctx, comboId, part.id, Number(s(form, "quantity")) || 1);
    revalidatePath(`/products/${comboId}`);
    return { ok: "Producto agregado al combo" };
  });
}

export async function removeComboItemAction(form: FormData) {
  const ctx = await actionContext("products.write", "products");
  await removeComboItem(ctx, s(form, "comboId"), s(form, "lineId"));
  revalidatePath(`/products/${s(form, "comboId")}`);
}
