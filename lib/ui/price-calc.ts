/**
 * Calculadora de precio de venta (misma fórmula de KLINIU). Sin dependencias de servidor:
 * la usan el editor (navegador) y el servidor, así el resumen siempre coincide.
 */
const n = (v: unknown) => Number(v ?? 0);

export type SimInput = { shipping: number; picking: number; commissionPct: number; campaignPct: number; marginPct: number; items: { quantity: number; unitCost: number }[] };

export const MAX_PCT = 99.99;
const pct = (v: unknown) => Math.min(Math.max(n(v), 0), MAX_PCT);

/**
 * Misma fórmula de la calculadora de KLINIU:
 *   precio base = costo de los productos / (1 − margen)
 *   comisión y campaña = % del precio base
 *   total = precio base + envío + picking + comisión;  precio final = total + campaña
 */
export function simulate(s: SimInput) {
  const productsCost = s.items.reduce((a, i) => a + n(i.quantity) * n(i.unitCost), 0);
  const basePrice = productsCost / (1 - pct(s.marginPct) / 100);
  const commission = basePrice * pct(s.commissionPct) / 100;
  const campaign = basePrice * pct(s.campaignPct) / 100;
  const total = basePrice + n(s.shipping) + n(s.picking) + commission;
  const price = total + campaign;
  return { productsCost, basePrice, margin: basePrice - productsCost, commission, campaign, shipping: n(s.shipping), picking: n(s.picking), total, price };
}

