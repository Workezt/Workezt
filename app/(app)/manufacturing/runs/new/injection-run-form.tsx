"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type ReactNode } from "react";
import { ActionForm, SubmitButton, type ActionResult } from "@/components/action-form";
import { btn, Field, input } from "@/components/ui-base";
import { saveInjectionRun } from "../../plant-actions";

type Option = { id: string; label: string };
type Props = {
  machines: Option[];
  operators: Option[];
  defaultOperator: string;
  products: Option[];
  orders: { id: string; number: string; product?: string }[];
  molds: Option[];
  today: string;
};

const zoneNumbers = [1, 2, 3, 4, 5, 6];
const columns = "grid gap-4 sm:grid-cols-2";
const threeColumns = "grid gap-4 sm:grid-cols-3";

function Options({ options }: { options: Option[] }) {
  return options.map(({ id, label }) => <option key={id} value={id}>{label}</option>);
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-4 rounded-2xl border border-[var(--ork-rule)] bg-white/90 px-5 pb-5 pt-2">
      <legend className="px-2 text-base font-semibold text-[var(--ork-ink)]">{title}</legend>
      {children}
    </fieldset>
  );
}

export function InjectionRunForm({ machines, operators, defaultOperator, products, orders, molds, today }: Props) {
  const defaults = {
    workCenterId: machines.length === 1 ? machines[0].id : "",
    operatorId: operators.some(({ id }) => id === defaultOperator) ? defaultOperator : "",
    productionDate: today,
    cycleUnit: "seconds",
    cavities: "1",
    damaged: "0",
    nonConforming: "0",
    downtimeMinutes: "0",
  };
  const [values, setValues] = useState<Record<string, string>>(defaults);
  const [temperatureMode, setTemperatureMode] = useState("simple");
  const order = orders.find(({ id }) => id === values.productionId);
  const hasZone = zoneNumbers.some((zone) => values[`zone${zone}`]);
  const manualProduct = values.productId === "manual";

  function field(name: string) {
    return {
      name,
      value: values[name] ?? "",
      className: input,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        setValues((current) => ({ ...current, [name]: value }));
      },
    };
  }

  async function submit(previous: ActionResult, form: FormData) {
    if (form.get("productId") === "manual") form.delete("productId");
    const result = await saveInjectionRun(previous, form);
    if (result?.ok) {
      setValues(defaults);
      setTemperatureMode("simple");
    }
    return result;
  }

  return (
    <ActionForm action={submit} className="space-y-6">
      <FormSection title="Orden y turno">
        {orders.length > 0 && (
          <Field label="Orden de producción">
            <select {...field("productionId")} onChange={(event) => {
              const productionId = event.target.value;
              setValues((current) => ({ ...current, productionId, orderNumber: "", productId: "", manualProductName: "" }));
            }}>
              <option value="">Registrar sin una orden vinculada</option>
              {orders.map(({ id, number, product }) => <option key={id} value={id}>{number}{product && ` · ${product}`}</option>)}
            </select>
          </Field>
        )}
        {order ? (
          <>
            <div className="rounded-xl bg-[var(--brand)]/5 px-4 py-3 text-sm text-[var(--ork-ink)]">
              <p><strong>Orden:</strong> {order.number}</p>
              {order.product && <p><strong>Producto:</strong> {order.product}</p>}
            </div>
            <details>
              <summary className="cursor-pointer text-sm text-[var(--ork-ink)]">Usar otro número o producto en esta corrida</summary>
              <div className={`mt-3 ${columns}`}>
                <Field label="Otro número de orden" hint="Si lo dejas vacío, se usa el número de la orden vinculada.">
                  <input {...field("orderNumber")} />
                </Field>
                <Field label="Otro producto">
                  <select {...field("productId")}>
                    <option value="">Usar el producto de la orden</option>
                    <Options options={products} />
                  </select>
                </Field>
              </div>
            </details>
          </>
        ) : (
          <div className={columns}>
            <Field label="N.º de orden *"><input {...field("orderNumber")} required /></Field>
            <Field label="Producto *">
              <select {...field("productId")} required>
                <option value="" disabled>Selecciona el producto</option>
                <option value="manual">Escribir nombre del producto</option>
                <Options options={products} />
              </select>
            </Field>
            {manualProduct && <Field className="sm:col-span-2" label="Nombre del producto *"><input {...field("manualProductName")} required /></Field>}
          </div>
        )}
        <div className={columns}>
          <Field label="Máquina *">
            <select {...field("workCenterId")} required><option value="" disabled>Selecciona una máquina</option><Options options={machines} /></select>
          </Field>
          <Field label="Operario *">
            <select {...field("operatorId")} required><option value="" disabled>Selecciona un operario</option><Options options={operators} /></select>
          </Field>
        </div>
        <div className={threeColumns}>
          <Field label="Fecha *"><input {...field("productionDate")} type="date" required /></Field>
          <Field label="Hora de inicio *"><input {...field("startTime")} type="time" required /></Field>
          <Field label="Hora de fin *"><input {...field("endTime")} type="time" required /></Field>
        </div>
      </FormSection>

      <FormSection title="Material y parámetros de inyección">
        <div className={columns}>
          <Field label="Material *"><input {...field("material")} required /></Field>
          <Field label="Molde"><select {...field("moldId")}><option value="">Seleccionar molde</option><Options options={molds} /></select></Field>
          <Field label="Peso de inyección (g) *"><input {...field("injectionWeight")} type="number" step="any" min="0" required /></Field>
          <Field label="Peso por pieza (g) *"><input {...field("pieceWeight")} type="number" step="any" min="0" required /></Field>
        </div>
        <div className={threeColumns}>
          <Field label="Duración del ciclo *"><input {...field("cycle")} type="number" step="any" min="0" required /></Field>
          <Field label="Unidad del ciclo"><select {...field("cycleUnit")}><option value="seconds">Segundos</option><option value="minutes">Minutos</option></select></Field>
          <Field label="Cavidades"><input {...field("cavities")} type="number" min="1" max="500" /></Field>
          <Field label="Registro de temperatura">
            <select className={input} value={temperatureMode} onChange={(event) => setTemperatureMode(event.target.value)}>
              <option value="simple">Una temperatura</option>
              <option value="zones">Por zonas</option>
            </select>
          </Field>
          {temperatureMode === "simple" && <Field label="Temperatura (°C) *"><input {...field("temperature")} type="number" step="any" min="0" required /></Field>}
        </div>
        {temperatureMode === "zones" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <p className="col-span-full text-sm text-slate-500">Ingresa la temperatura de al menos una zona.</p>
            {zoneNumbers.map((zone) => (
              <Field key={zone} label={`Zona ${zone} (°C)`}>
                <input {...field(`zone${zone}`)} type="number" step="any" min="0" required={zone === 1 && !hasZone} />
              </Field>
            ))}
          </div>
        )}
      </FormSection>

      <FormSection title="Resultado de la corrida">
        <div className={threeColumns}>
          <Field label="Piezas producidas *"><input {...field("produced")} type="number" min="0" required /></Field>
          <Field label="Piezas dañadas"><input {...field("damaged")} type="number" min="0" /></Field>
          <Field label="Piezas no conformes"><input {...field("nonConforming")} type="number" min="0" /></Field>
        </div>
        <Field label="Minutos de parada"><input {...field("downtimeMinutes")} type="number" min="0" /></Field>
        <Field label="Observaciones"><textarea {...field("observations")} rows={2} /></Field>
      </FormSection>

      <details className="rounded-xl border border-[var(--ork-rule)] bg-white/90 px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--ork-ink)]">Detalles opcionales de material y acople</summary>
        <div className={`mt-4 ${columns}`}>
          <Field label="Material entregado (kg)"><input {...field("materialQuantityKg")} type="number" step="any" min="0" /></Field>
          <Field label="Pigmento"><input {...field("pigment")} /></Field>
          <Field label="Color del pigmento"><input {...field("pigmentColor")} /></Field>
          <Field label="Cantidad de pigmento"><input {...field("pigmentQuantity")} type="number" step="any" min="0" /></Field>
          <Field label="Prueba de acople"><input {...field("couplingTest")} /></Field>
          <Field label="Estado de la prueba">
            <select {...field("couplingStatus")}><option value="">Seleccionar estado</option><option value="completed">Completada</option><option value="na">No aplica</option></select>
          </Field>
          <Field label="Hora de la prueba"><input {...field("couplingTime")} type="time" /></Field>
        </div>
      </details>

      <div className="flex flex-wrap justify-end gap-3">
        <Link href="/manufacturing/runs" className={btn.secondary}>Volver a corridas</Link>
        <SubmitButton className={btn.primary}>Guardar corrida</SubmitButton>
      </div>
    </ActionForm>
  );
}
