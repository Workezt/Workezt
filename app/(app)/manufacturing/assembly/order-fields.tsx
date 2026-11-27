"use client";

import { useState } from "react";
import { Field, input } from "@/components/ui-base";

type Product = { id: string; name: string };
type Order = { id: string; number: string; productId: string };

export function AssemblyOrderFields({ orders, products }: { orders: Order[]; products: Product[] }) {
  const [orderId, setOrderId] = useState("");
  const [productId, setProductId] = useState("");
  const productNames = new Map(products.map(({ id, name }) => [id, name]));
  const order = orders.find(({ id }) => id === orderId);
  const defaultProduct = order ? productNames.get(order.productId) ?? "Producto de la orden" : "";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {orders.length > 0 && (
        <Field label="Orden de producción">
          <select name="productionId" value={orderId} className={input} onChange={(event) => {
            const next = orders.find(({ id }) => id === event.target.value);
            setOrderId(event.target.value);
            setProductId(next?.productId ?? "");
          }}>
            <option value="">Registrar sin una orden vinculada</option>
            {orders.map(({ id, number, productId }) => <option key={id} value={id}>{number}{productNames.has(productId) ? ` · ${productNames.get(productId)}` : ""}</option>)}
          </select>
        </Field>
      )}
      {!order && <Field label="N.º de orden *"><input name="orderNumber" required className={input} /></Field>}
      <Field label="Producto *">
        <select name="productId" required value={productId} onChange={(event) => setProductId(event.target.value)} className={input}>
          <option value="" disabled>Selecciona el producto</option>
          {order && !productNames.has(order.productId) && <option value={order.productId}>{defaultProduct}</option>}
          {products.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </Field>
    </div>
  );
}
