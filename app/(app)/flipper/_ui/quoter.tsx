"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/immutability -- Flipper muta su estado (F.S, F.ui) y luego llama a commit(), igual que el original; no hay React Compiler. */
import { useState, type ReactNode } from "react";
import { E, P } from "@/lib/apps/flipper/engine";
import { useFlipper, type Flipper } from "./store";
import {
  Alert, Badge, Btn, Card, CardHead, FieldL, Ic, MarginBadge, MoneyIn, Progress, Progress2, Seg, Sel, Stepper, TextIn, AreaIn,
  brandName, fmtNum, fmtPct, money, parseIntSafe, parseMoney, parsePct, pctText, sameJson,
} from "./kit";
import {
  addLineToDraft, brandFootprint, capById, client, exportClientHTML, guarded, lineByUid, nextScenarioName, overResources,
  persistDraft, printQuote, purgeBrandFromQuote, startQuote, touch, clientModal, loadDemo,
} from "./ops";
import { BrandsEditor, capResources } from "./views-basic";

const STEPS = ["Cliente y marcas", "Capacidades", "Asignación", "Resumen económico", "Propuesta"];
const List = ({ items }: { items: ReactNode[] }) => <ul className="ml-5 list-disc space-y-0.5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;

export function QuoterView() {
  const F = useFlipper(); const S = F.S; const ui = F.ui;
  if (!S.draft) {
    return (
      <Card className="fl-empty py-16">
        <Ic n="spark" size={30} />
        <h2 className="mt-2 font-display text-xl font-semibold text-[var(--ork-ink)]">Construyamos una propuesta</h2>
        <p className="mt-1 text-sm">Selecciona un cliente, elige capacidades y distribúyelas entre sus marcas.</p>
        <div className="mt-4 flex justify-center gap-2"><Btn kind="primary" icon="plus" onClick={() => startQuote(F)}>Crear cotización</Btn><Btn onClick={() => F.go("quotes")}>Abrir una existente</Btn></div>
      </Card>
    );
  }
  const q = S.draft; const v = E.validateQuote(q);
  const step = (n: number) => {
    if (n < 1 || n > 5) return;
    if (n > 1 && (!q.client || !q.brandIds.length)) { F.toast("Primero selecciona un cliente y al menos una marca participante.", "err"); ui.step = 1; F.rerender(); return; }
    ui.step = n; F.rerender(); window.scrollTo(0, 0);
  };
  const close = async () => {
    if (q._dirty && !(await F.confirm("Cerrar cotización", <p>Hay cambios sin guardar. ¿Descartarlos?</p>, { ok: "Descartar cambios", danger: true }))) return;
    S.draft = null; F.commit(); F.go("quotes");
  };
  const body = [<Step1 key={1} />, <Step2 key={2} v={v} />, <Step3 key={3} v={v} step={step} />, <Step4 key={4} v={v} />, <Step5 key={5} v={v} step={step} />][ui.step - 1];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><div className="fl-upper">{q.number || "Nueva cotización"} · {q.scenarioName || ""}</div><h1 className="mt-1 font-display text-2xl font-semibold text-[var(--ork-ink)]">{q.name}</h1></div>
        <div className="flex flex-wrap items-center gap-2">
          {q._dirty ? <Badge tone="warn">Cambios sin guardar</Badge> : q.number ? <Badge tone="ok">Guardada</Badge> : null}
          {F.isInternal && <Btn icon="gear" onClick={() => openNegotiation(F)}>Ajustes de negociación</Btn>}
          <Btn icon="x" onClick={close}>Cerrar</Btn>
          <Btn kind="primary" icon="check" onClick={() => persistDraft(F)}>Guardar</Btn>
        </div>
      </div>
      <div className="fl-steps mb-4">
        {STEPS.map((s, i) => (
          <button key={s} className={ui.step === i + 1 ? "on" : ui.step > i + 1 ? "done" : ""} onClick={() => step(i + 1)}>
            <span className="n">{ui.step > i + 1 ? "✓" : i + 1}</span><span className="t">{s}</span>
          </button>
        ))}
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {body}
          <div className="flex justify-between gap-2">
            <Btn icon="arrowL" onClick={() => step(ui.step - 1)} disabled={ui.step === 1}>Anterior</Btn>
            {ui.step < 5 && <Btn kind="primary" onClick={() => step(ui.step + 1)}>Siguiente: {STEPS[ui.step]} <Ic n="arrowR" size={15} /></Btn>}
          </div>
        </div>
        <SummaryAside v={v} />
      </div>
    </>
  );
}

/* ---------- resumen lateral ---------- */
function SummaryAside({ v }: { v: any }) {
  const F = useFlipper(); const S = F.S; const q = S.draft;
  const t = E.computeTotals(q); const p = F.isAdmin ? E.computeProfitability(q, S.costs, S.settings) : null;
  const manualDisc = t.discounts - t.combo.amount - t.volume.amount;
  const row = (l: ReactNode, val: ReactNode, cls = "") => <div className={`fl-sum ${cls}`}><span>{l}</span><span className="tabular-nums">{val}</span></div>;
  return (
    <aside className="fl-card fl-summary xl:sticky xl:top-20">
      <div className="fl-upper">Inversión mensual total</div>
      <div className="mt-1 font-display text-3xl font-semibold tabular-nums text-[var(--ork-purple)]">{money(t.totalInvestment)}</div>
      <div className="text-xs text-stone-500">{q.client?.name || "Sin cliente"} · {q.brandIds.length} marca(s) · {q.lines.length} capacidad(es)</div>
      {!E.rulesAreModern(q.rules) && <div className="mt-3"><Alert kind="warn">Reglas anteriores: sin descuentos por combinación ni volumen. <button className="underline" onClick={() => applyRules(F)}>Activar descuentos vigentes</button></Alert></div>}
      {t.discounts ? (
        <div className="fl-savings mt-3">
          <div className="flex justify-between font-semibold"><span className="flex items-center gap-1"><Ic n="star" size={14} /> Descuentos aplicados</span><span className="tabular-nums">−{money(t.discounts)}</span></div>
          {t.combo.amount > 0 && row("Combinación de capacidades", `−${money(t.combo.amount)}`)}
          {t.volume.amount > 0 && row("Volumen (unidades adicionales)", `−${money(t.volume.amount)}`)}
          {manualDisc > 0 && row("Descuentos comerciales", `−${money(manualDisc)}`)}
          <div className="text-[11px]">Valores mensuales antes de IVA. Ahorro con IVA: <b className="tabular-nums">{money(t.discounts + E.applyBp(t.discounts, t.ivaBp))}</b> al mes.</div>
        </div>
      ) : q.lines.length && t.combo.enabled ? <div className="fl-savings off mt-3 text-xs">Aún sin descuentos. Combina 2 o más capacidades sin personalizar o agrega unidades para activarlos.</div> : null}
      <div className="mt-3 flex flex-col">
        {t.lines.map((l: any) => {
          const line = q.lines.find((x: any) => x.uid === l.uid); const cap = E.capOf(q, line); const disc = (l.comboDisc || 0) + (l.volumeDisc || 0);
          return (
            <div key={l.uid} className="fl-sumline">
              <span className="dot" style={{ background: cap.color }} />
              <div className="min-w-0 grow"><b className="block truncate text-[13px]">{l.name}</b><div className="text-[11px] text-stone-500">{line.mode === "exclusive" ? `Exclusiva · ${brandName(q, line.brandIds[0])}` : `Compartida · ${line.brandIds.length} marca(s)`}</div></div>
              <div className="text-right text-[13px] tabular-nums">{money(l.gross - disc)}{disc > 0 && <div className="text-[11px]"><s className="text-stone-400">{money(l.gross)}</s> <span className="text-[var(--fl-ok)]">−{Math.round((disc * 100) / l.gross)}%</span></div>}</div>
              <div className="flex items-center gap-1"><Stepper sm value={l.qty} min={1} onMinus={() => lineQty(F, l.uid, -1)} onPlus={() => lineQty(F, l.uid, 1)} /><Btn size="xs" kind="ghost" icon="x" title={`Quitar ${l.name}`} onClick={() => lineDel(F, l.uid)} /></div>
            </div>
          );
        })}
        {!t.lines.length && <div className="text-xs text-stone-500">Agrega capacidades en el paso 2.</div>}
      </div>
      {t.combo.enabled && q.lines.length > 0 && <div className="mt-2"><Ladder t={t} compact />{!q.comboOff && t.combo.nextPct > 0 && <div className="fl-tip mt-1">Agrega {t.combo.present === t.combo.capsTotal - 1 ? "la capacidad que falta" : "1 capacidad más"} y obtén −{t.combo.nextPct}%</div>}</div>}
      <div className="mt-2 border-t border-stone-200 pt-2">
        {row(<span className="text-stone-500">Servicios (paquetes)</span>, money(t.services))}
        {t.adjustments !== 0 && row(<span className="text-stone-500">Personalización</span>, t.adjustments < 0 ? `−${money(-t.adjustments)}` : money(t.adjustments))}
        {t.extras > 0 && row(<span className="text-stone-500">Ampliaciones</span>, money(t.extras))}
        {t.suppRecurring > 0 && row(<span className="text-stone-500">Suplementos</span>, money(t.suppRecurring))}
        {t.combo.amount > 0 && row("Descuento por combinación", `−${money(t.combo.amount)}`, "ok")}
        {t.volume.amount > 0 && row("Descuento por volumen", `−${money(t.volume.amount)}`, "ok")}
        {manualDisc > 0 && row(<span className="text-stone-500">Descuentos</span>, `−${money(manualDisc)}`)}
        {row(<b>Honorarios netos</b>, <b>{money(t.net)}</b>)}
        {row(<span className="text-stone-500">IVA {fmtPct(t.ivaBp)}</span>, money(t.iva))}
        {row(`Total servicios ${S.settings.companyName || ""}`.trim(), money(t.totalServices), "big")}
        {row(<span className="text-stone-500">Pauta publicitaria (separada)</span>, money(t.ad.total))}
        {t.oneTime.subtotal > 0 && row(<span className="text-stone-500">Cargos únicos con IVA</span>, money(t.oneTime.total))}
      </div>
      <div className="mt-3">
        {v.errors.length ? <Alert kind="err"><b>{v.errors.length} ajuste(s) pendiente(s)</b><List items={v.errors.slice(0, 3).map((e: any) => e.msg)} /></Alert> : q.lines.length ? <Alert kind="ok">Configuración consistente con las capacidades contratadas.</Alert> : null}
      </div>
      {q.negotiated && F.isInternal && <div className="mt-2"><Badge tone="warn">Valores ajustados en negociación</Badge></div>}
      {p && (
        <div className="mt-3 border-t border-dashed border-stone-300 pt-3">
          <div className="flex items-center justify-between"><span className="fl-upper flex items-center gap-1"><Ic n="lock" size={11} /> Interno</span><Btn size="xs" icon="gear" onClick={() => openNegotiation(F)}>Ajustes</Btn></div>
          {p.pending ? <div className="mt-1 text-xs text-stone-500">Rentabilidad pendiente de configuración</div> : <div className="mt-1 flex items-center justify-between gap-2"><span className="text-xs">Margen de contribución</span><MarginBadge bp={p.marginBp} status={p.status} /></div>}
        </div>
      )}
    </aside>
  );
}

/* ---------- acciones de líneas ---------- */
function lineQty(F: Flipper, uid: string, d: number) {
  const l = lineByUid(F, uid); const n = l.qty + d; if (n < 1) return;
  l.qty = n; touch(F); F.commit();
  if (overResources(F.S.draft, l).length) F.toast("Las asignaciones actuales exceden la nueva capacidad. Corrígelas en Asignación antes de guardar.", "err");
}
async function lineDel(F: Flipper, uid: string) {
  const q = F.S.draft; const l = lineByUid(F, uid); const cap = E.capOf(q, l);
  const used = l.brandIds.flatMap((b: string) => E.describeUsage(q, l, b));
  const disc = q.discounts.filter((d: any) => d.target === l.uid);
  if ((used.length || disc.length) && !(await F.confirm("Quitar capacidad", <>
    <p>Se quitará <b>{cap.name}</b> ({l.qty} unidad/es) de la propuesta.</p>
    {used.length > 0 && <><p>Se eliminarán sus asignaciones:</p><List items={used} /></>}
    {disc.length > 0 && <p>También se eliminarán {disc.length} descuento(s) aplicados a esta capacidad.</p>}
  </>, { ok: "Quitar capacidad", danger: true }))) return;
  q.lines = q.lines.filter((x: any) => x.uid !== l.uid); q.discounts = q.discounts.filter((d: any) => d.target !== l.uid);
  if (!q.lines.some((x: any) => x.capId === l.capId)) delete q.catalog[l.capId];
  touch(F); F.commit();
}
function applyRules(F: Flipper) {
  F.S.draft.rules = E.clone(F.S.settings.pricing); touch(F); F.commit();
  const t = E.computeTotals(F.S.draft);
  F.toast(t.discounts ? `Descuentos activados: −${money(t.discounts)} al mes.` : "Reglas vigentes aplicadas. Combina 2 o más capacidades para obtener descuento.", "ok");
}

/* =====================================================================
   PASO 1 · CLIENTE Y MARCAS
   ===================================================================== */
function Step1() {
  const F = useFlipper(); const S = F.S; const q = S.draft; const c = client(F, q.clientId);
  const pickClient = async (id: string) => {
    const nc = client(F, id);
    const hasWork = q.lines.some((l: any) => l.brandIds.length || l.items.length || l.requests.length || Object.keys(l.alloc).length);
    if (hasWork && !(await F.confirm("Cambiar cliente", <p>Las capacidades configuradas perderán sus marcas beneficiarias y asignaciones, porque pertenecen al cliente anterior. Las capacidades y unidades se conservan.</p>, { ok: "Cambiar cliente", danger: true }))) { F.rerender(); return; }
    q.lines.forEach((l: any) => { l.brandIds = []; l.items = []; l.requests = []; l.alloc = {}; l.manualShares = {}; });
    q.adBudget = {}; q.clientId = nc ? nc.id : null; q.client = nc ? E.snapshotClient(nc) : null; q.brandIds = nc ? nc.brands.filter((b: any) => b.active).map((b: any) => b.id) : [];
    if (nc) { S.activeClientId = nc.id; if (/^Propuesta OR-K Flipper/.test(q.name) || q.name === "Nueva propuesta") q.name = `Propuesta OR-K Flipper — ${nc.name}`; }
    touch(F); F.commit();
  };
  const allBrands = async (on: boolean) => {
    if (on) { q.brandIds = c.brands.filter((b: any) => b.active).map((b: any) => b.id); touch(F); F.commit(); return; }
    const fp = q.brandIds.flatMap((b: string) => brandFootprint(q, b).map((x) => <>{brandName(q, b)} · {x}</>));
    if (fp.length && !(await F.confirm("Retirar todas las marcas", <><p>Se eliminarán estos recursos asignados:</p><List items={fp} /></>, { ok: "Retirar todas", danger: true }))) return;
    q.brandIds.slice().forEach((b: string) => purgeBrandFromQuote(q, b)); touch(F); F.commit();
  };
  const field = (f: string, val: string) => {
    let v: any = val;
    if (f === "validityDays") { v = parseIntSafe(v); if (v < 1) { F.toast("La vigencia debe ser de al menos 1 día.", "err"); F.rerender(); return; } }
    if (f === "name" && !v.trim()) { F.toast("La propuesta necesita un nombre.", "err"); F.rerender(); return; }
    if (f === "date" && !v) { F.rerender(); return; }
    q[f] = v; touch(F); F.commit();
  };
  return (
    <>
      <Card>
        <CardHead title="Cliente" sub="Selecciona un cliente existente o crea uno nuevo.">
          <Btn size="sm" icon="plus" onClick={() => clientModal(F)}>Nuevo cliente</Btn>
          {!S.clients.some((x: any) => x.name === "Flipper Beta") && <Btn size="sm" icon="star" onClick={() => loadDemo(F)}>Demo Flipper Beta</Btn>}
        </CardHead>
        <Sel value={q.clientId ?? ""} onChange={pickClient} options={[["", "— Seleccionar cliente —"], ...S.clients.map((x: any) => [x.id, `${x.name}${x.legalName ? ` · ${x.legalName}` : ""}`] as [string, string])]} ariaLabel="Cliente" />
        {q.clientId && !c && <div className="mt-2"><Alert kind="warn">El cliente original de esta cotización ya no existe en el registro. Se conserva su copia histórica: {q.client?.name}</Alert></div>}
      </Card>
      {c && (
        <Card>
          <CardHead title="Marcas participantes" sub="Marca las que participan en esta propuesta. El número de marcas no modifica el precio.">
            <Btn size="sm" kind="ghost" onClick={() => allBrands(true)}>Todas</Btn><Btn size="sm" kind="ghost" onClick={() => allBrands(false)}>Ninguna</Btn>
          </CardHead>
          <BrandsEditor c={c} draftMode />
        </Card>
      )}
      <Card>
        <CardHead title="Datos de la propuesta" />
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldL label="Nombre de la propuesta"><TextIn value={q.name} onCommit={(v) => field("name", v)} /></FieldL>
          <FieldL label="Escenario" hint="Nombre editable (ej. Esencial, Crecimiento, Integral). No es un paquete obligatorio."><TextIn value={q.scenarioName} onCommit={(v) => field("scenarioName", v)} /></FieldL>
          <FieldL label="Fecha"><input type="date" className="fl-in" value={q.date} onChange={(e) => field("date", e.target.value)} /></FieldL>
          <FieldL label="Vigencia (días)" hint={`Vence el ${P.fmtDate(E.expiryDate(q))}`}><TextIn className="num" inputMode="numeric" value={q.validityDays} onCommit={(v) => field("validityDays", v)} /></FieldL>
        </div>
      </Card>
    </>
  );
}

/* =====================================================================
   PASO 2 · CAPACIDADES
   ===================================================================== */
const MODE_HELP = {
  shared: "Una sola bolsa de recursos que se reparte entre varias marcas. Se paga una vez, sin importar cuántas marcas la usen.",
  exclusive: "Todos los recursos de la capacidad son para una sola marca. Úsala cuando una marca necesita su propio equipo y entregables.",
};

function Step2({ v }: { v: any }) {
  const F = useFlipper(); const S = F.S; const q = S.draft;
  const caps = S.catalog.filter((c: any) => c.active);
  const t = E.computeTotals(q);
  return (
    <>
      <LegacyBanner />
      <Card>
        <h3 className="text-[15px] font-semibold">¿Cómo se contrata cada capacidad?</h3>
        <p className="mt-1 text-xs text-stone-500">Cada capacidad puede agregarse de dos formas. Puedes combinar ambas en una misma propuesta y cambiar la modalidad después.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl bg-[var(--ork-violet)]/[0.06] p-3"><span className="fl-capicon sm" style={{ ["--c" as string]: "var(--ork-violet)" }}><Ic n="users" size={16} /></span><div><div className="font-semibold">Compartida</div><div className="mt-0.5 text-xs text-stone-600">{MODE_HELP.shared}</div><div className="mt-1 text-[11px] text-[var(--ork-violet)]">Ej.: 10 piezas de diseño repartidas entre 3 marcas se pagan una vez, no tres.</div></div></div>
          <div className="flex items-start gap-3 rounded-xl bg-sky-500/[0.06] p-3"><span className="fl-capicon sm" style={{ ["--c" as string]: "#3578FF" }}><Ic n="star" size={16} /></span><div><div className="font-semibold">Exclusiva</div><div className="mt-0.5 text-xs text-stone-600">{MODE_HELP.exclusive}</div><div className="mt-1 text-[11px] text-sky-700">Ej.: Community &amp; Content solo para una de tus marcas.</div></div></div>
        </div>
      </Card>
      <ComboBanner t={t} />
      {caps.map((cap: any) => {
        const lines = q.lines.filter((l: any) => l.capId === cap.id); const snap = q.catalog[cap.id] || cap;
        const shared = lines.filter((l: any) => l.mode === "shared"); const excl = lines.filter((l: any) => l.mode === "exclusive");
        return (
          <div key={cap.id} className={`fl-card fl-capcard tinted ${lines.length ? "sel" : ""}`} style={{ ["--c" as string]: cap.color }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3"><span className="fl-capicon"><Ic n={cap.icon || "box"} size={20} /></span><div><div className="fl-code">{cap.code}</div><h3 className="text-base font-semibold">{cap.name}</h3><p className="mt-0.5 max-w-2xl text-xs text-stone-500">{cap.description}</p></div></div>
              <div className="ml-auto text-right"><div className="font-display text-xl font-semibold tabular-nums">{money(snap.price)}</div><div className="text-[11px] text-stone-500">por unidad mensual + IVA</div>{lines.length > 0 && <Badge tone="v">{lines.length} en la propuesta</Badge>}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">{capResources(snap)}</div>
            {shared.length > 0 && <div className="flex flex-col gap-3">{shared.map((l: any) => <LineConfigCard key={l.uid} l={l} v={v} />)}</div>}
            {excl.length > 0 && <ExclusiveGroup cap={cap} lines={excl} v={v} />}
            <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-stone-300 pt-3">
              <span className="mr-1 text-xs font-semibold">{lines.length ? "Agregar otra unidad independiente:" : "Agregar a la propuesta:"}</span>
              <Btn size="sm" kind="primary" icon="plus" title={MODE_HELP.shared} onClick={() => addLineToDraft(F, cap.id, "shared")}>Compartida entre marcas</Btn>
              {!excl.length && <Btn size="sm" icon="plus" title={MODE_HELP.exclusive} onClick={() => addLineToDraft(F, cap.id, "exclusive")}>Exclusiva por marca</Btn>}
            </div>
            {lines.length > 0 && <div className="text-[11px] text-stone-500">Para ampliar una misma bolsa usa «Unidades». Cada unidad adicional de una capacidad tiene descuento por volumen.</div>}
          </div>
        );
      })}
    </>
  );
}

function LegacyBanner() {
  const F = useFlipper(); const q = F.S.draft;
  if (E.rulesAreModern(q.rules)) return null;
  return <Alert kind="warn" action={<Btn size="sm" kind="primary" onClick={() => applyRules(F)}>Activar descuentos vigentes</Btn>}><b>Esta cotización se creó con reglas de precio anteriores</b> y no tiene activos los descuentos por combinación de capacidades ni por volumen. Las tarifas de las capacidades no cambian.</Alert>;
}

function Ladder({ t, compact }: { t: any; compact?: boolean }) {
  const c = t.combo; if (!c.enabled) return null;
  const steps = (c.tiers || []).map((p: number, i: number) => ({ n: i + 1, p })).filter((s: any) => s.n >= 2);
  return (
    <div className={`fl-ladder ${compact ? "sm" : ""}`}>
      {steps.map((s: any) => <div key={s.n} className={`${c.present >= s.n && !c.off ? "on" : ""} ${c.present + 1 === s.n ? "next" : ""}`}><b>{s.n === c.capsTotal ? "Paquete completo" : `${s.n} capacidades`}</b><span>−{s.p}%</span></div>)}
    </div>
  );
}

function ComboBanner({ t }: { t: any }) {
  const F = useFlipper(); const S = F.S; const q = S.draft; const c = t.combo;
  if (!c.enabled && !(t.volume && t.volume.enabled)) return null;
  const nm = (id: string) => (q.catalog[id] || capById(F, id) || {}).name || id;
  const vol = t.volume?.enabled ? `Unidades adicionales de una misma capacidad: ${t.volume.tiers.slice(1).map((p: number, i: number) => `${i + 2}.ª${i === t.volume.tiers.length - 2 ? "+" : ""} −${p}%`).join(" · ")}. Se aplica el descuento mayor por unidad, nunca ambos.` : "";
  let msg: ReactNode;
  if (q.comboOff) msg = "El descuento por combinación está desactivado para esta cotización.";
  else if (c.amount) msg = <><b>Descuento por combinación aplicado:</b> ahorro de <b>{money(c.amount)}</b> al mes{t.volume.amount ? <> · volumen <b>{money(t.volume.amount)}</b></> : null}.</>;
  else msg = <b>Entre más capacidades combines, mayor el descuento.</b>;
  return (
    <div className="fl-card tight fl-offer">
      <div className="flex items-start gap-3">
        <Ic n="star" size={18} className="mt-0.5 shrink-0 text-[var(--fl-ok)]" />
        <div className="min-w-0 grow text-sm">
          <div>{msg}{!q.comboOff && c.nextPct > 0 && <> Agrega {c.present === c.capsTotal - 1 ? "la capacidad que falta" : "1 capacidad más"} sin personalizar y obtén <b>−{c.nextPct}%</b>{c.missing.length ? ` (disponibles: ${c.missing.map(nm).join(", ")})` : ""}.</>}{c.customized.length > 0 && ` Personalizadas, no suman a la combinación: ${c.customized.map(nm).join(", ")}.`}</div>
          <Ladder t={t} />
          {vol && <div className="mt-2 text-[11px] text-stone-500">{vol}</div>}
        </div>
        {F.isInternal && <label className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs"><input type="checkbox" className="fl-check" checked={!q.comboOff} onChange={(e) => { q.comboOff = !e.target.checked; touch(F); F.commit(); }} /> Aplicar</label>}
      </div>
    </div>
  );
}

function contentSummary(q: any, l: any, cap: any) {
  const c = E.lineCapacity(q, l);
  return cap.resources.filter((r: any) => r.allocatable || r.adjustable).map((r: any) => `${fmtNum(c[r.key])} ${(r.short || r.label).toLowerCase()}`).join(" · ");
}
function LinePrice({ tl }: { tl: any }) {
  const disc = (tl.comboDisc || 0) + (tl.volumeDisc || 0); const net = tl.gross - disc;
  return (
    <span className="tabular-nums"><b>{money(net)}</b>
      {(disc > 0 || tl.adjustAmt !== 0) && <span className="block text-[11px]">
        {disc > 0 && <s className="mr-1 text-stone-400">{money(tl.gross)}</s>}
        {tl.comboDisc > 0 && <span className="mr-1 text-[var(--fl-ok)]">combinación −{money(tl.comboDisc)}</span>}
        {tl.volumeDisc > 0 && <span className="text-[var(--fl-ok)]">volumen −{money(tl.volumeDisc)}</span>}
        {!disc && tl.adjustAmt !== 0 && <span className="text-stone-500">paquete {money(tl.base)}</span>}
      </span>}
    </span>
  );
}
const LineIssues = ({ v, uid }: { v: any; uid: string }) => (<>
  {v.errors.filter((e: any) => e.lineUid === uid).map((e: any, i: number) => <Alert key={`e${i}`} kind="err">{e.msg}</Alert>)}
  {v.warnings.filter((w: any) => w.lineUid === uid).map((w: any, i: number) => <Alert key={`w${i}`} kind="warn">{w.msg}</Alert>)}
</>);

function LineConfigCard({ l, v }: { l: any; v: any }) {
  const F = useFlipper(); const q = F.S.draft; const ui = F.ui;
  const cap = E.capOf(q, l); const tl = E.computeTotals(q).lines.find((x: any) => x.uid === l.uid);
  const open = !!ui.open[l.uid]; const adj = E.lineAdjustment(q, l);
  return (
    <div className="fl-card tight fl-line" style={{ ["--c" as string]: cap.color }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><span className="fl-capbadge">Compartida</span><span className="text-xs text-stone-500">{l.brandIds.length} marca(s) · ID {l.uid.slice(-6)}</span></div>
        <div className="flex flex-wrap items-center gap-2">
          <Seg value={l.mode} options={[["shared", "Compartida"], ["exclusive", "Exclusiva"]]} onChange={(m) => lineMode(F, l, m)} />
          <span className="text-xs text-stone-500">Unidades</span>
          <Stepper value={l.qty} min={1} onMinus={() => lineQty(F, l.uid, -1)} onPlus={() => lineQty(F, l.uid, 1)} />
          <span className="min-w-[150px] text-right"><LinePrice tl={tl} /></span>
          <Btn size="sm" kind="ghost" icon="trash" title="Quitar de la propuesta" className="text-rose-600" onClick={() => lineDel(F, l.uid)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {q.brandIds.map((b: string) => <button key={b} className={`fl-chip ${l.brandIds.includes(b) ? "on" : ""}`} onClick={() => lineBrand(F, l, b)}>{l.brandIds.includes(b) && <Ic n="check" size={13} />}{brandName(q, b)}</button>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5"><span className="fl-upper">Contenido:</span>{contentSummary(q, l, cap)} {adj.customized ? <Badge tone="warn">Personalizada</Badge> : <Badge tone="ok">Paquete completo</Badge>}</div>
        <Btn size="xs" onClick={() => { ui.open[l.uid] = !open; F.rerender(); }}>{open ? "Cerrar" : "Personalizar contenido"} <Ic n="chevDown" size={13} className={open ? "rotate-180" : ""} /></Btn>
      </div>
      {open && <ContentEditor l={l} />}
      {(cap.extras || []).length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-xs"><span className="fl-upper">Bloques adicionales:</span>
          {cap.extras.map((x: any) => <div key={x.id} className="flex items-center gap-2"><span>{x.name} <span className="text-stone-500">({x.price ? money(x.price) : "requiere cotización especial"})</span></span>{x.price > 0 && <Stepper sm value={E.nonNeg(l.extras[x.id])} onMinus={() => lineExtra(F, l, x.id, -1)} onPlus={() => lineExtra(F, l, x.id, 1)} />}</div>)}
        </div>
      )}
      <div className="flex flex-col gap-1.5"><LineIssues v={v} uid={l.uid} /></div>
    </div>
  );
}
function lineExtra(F: Flipper, l: any, id: string, d: number) {
  const n = E.nonNeg(l.extras[id]) + d; if (n < 0) return;
  l.extras[id] = n; touch(F); F.commit();
  if (overResources(F.S.draft, l).length) F.toast("Las asignaciones actuales exceden la capacidad. Corrígelas antes de guardar.", "err");
}
function lineMode(F: Flipper, l: any, m: "shared" | "exclusive") {
  const q = F.S.draft; if (l.mode === m) return;
  if (m === "exclusive") {
    const ub = Object.keys(E.lineUsage(q, l).byBrand);
    if (ub.length > 1) { F.info("No es posible convertir a exclusiva", <p>Esta capacidad tiene recursos asignados a {ub.length} marcas ({ub.map((b) => brandName(q, b)).join(", ")}). Una capacidad exclusiva pertenece a una sola marca: reasigna o retira los recursos primero.</p>); return; }
    const target = ub[0] || l.brandIds[0] || q.brandIds[0];
    l.brandIds = target ? [target] : []; Object.keys(l.manualShares).forEach((k) => delete l.manualShares[k]);
  }
  l.mode = m; touch(F); F.commit();
}
async function lineBrand(F: Flipper, l: any, b: string) {
  const q = F.S.draft; const cap = E.capOf(q, l);
  if (l.mode === "exclusive") {
    if (l.brandIds[0] === b) return;
    const prev = l.brandIds[0]; const used = prev ? E.describeUsage(q, l, prev) : [];
    if (used.length) {
      if (!(await F.confirm("Reasignar capacidad exclusiva", <><p>{cap.name} pasará de <b>{brandName(q, prev)}</b> a <b>{brandName(q, b)}</b>. Estas asignaciones se transferirán:</p><List items={used} /></>, { ok: "Reasignar" }))) return;
      l.items.forEach((i: any) => { if (i.brandId === prev) i.brandId = b; }); l.requests.forEach((r: any) => { if (r.brandId === prev) r.brandId = b; });
      if (l.alloc[prev]) { l.alloc[b] = l.alloc[prev]; delete l.alloc[prev]; }
      delete l.manualShares[prev];
    }
    l.brandIds = [b];
  } else if (l.brandIds.includes(b)) {
    const used = E.describeUsage(q, l, b);
    if (used.length && !(await F.confirm("Retirar marca de la capacidad", <><p>Al retirar <b>{brandName(q, b)}</b> de {cap.name} se eliminarán:</p><List items={used} /></>, { ok: "Retirar", danger: true }))) return;
    l.items = l.items.filter((i: any) => i.brandId !== b); l.requests = l.requests.filter((r: any) => r.brandId !== b); delete l.alloc[b]; delete l.manualShares[b]; l.brandIds = l.brandIds.filter((x: string) => x !== b);
  } else l.brandIds.push(b);
  touch(F); F.commit();
}

function ExclusiveGroup({ cap, lines, v }: { cap: any; lines: any[]; v: any }) {
  const F = useFlipper(); const q = F.S.draft; const ui = F.ui;
  const byBrand: Record<string, any> = Object.fromEntries(lines.map((l) => [l.brandIds[0], l]));
  const tot = E.computeTotals(q);
  const toggle = async (b: string) => {
    const line = byBrand[b];
    if (line) { await lineDel(F, line.uid); return; }
    E.newLine(q, capById(F, cap.id) || q.catalog[cap.id], { mode: "exclusive", brandIds: [b] }); touch(F); F.commit();
  };
  return (
    <div className="fl-panelcap">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-semibold">Exclusiva por marca</div><div className="text-[11px] text-stone-500">Toca una marca para darle su propia unidad, o tócala de nuevo para quitarla. Desde la 2.ª unidad aplica descuento por volumen.</div></div><span className="fl-capbadge">{lines.length} marca(s)</span></div>
      <div className="mt-2 flex flex-wrap gap-1.5">{q.brandIds.map((b: string) => <button key={b} className={`fl-chip ${byBrand[b] ? "on" : ""}`} onClick={() => toggle(b)}><Ic n={byBrand[b] ? "check" : "plus"} size={13} />{brandName(q, b)}</button>)}</div>
      <div className="mt-3 overflow-x-auto">
        <table className="fl-tbl compact">
          <thead><tr><th>Marca</th><th className="text-center">Unidades</th><th>Contenido</th><th className="text-right">Valor mensual</th><th /></tr></thead>
          <tbody>{lines.map((l) => {
            const tl = tot.lines.find((x: any) => x.uid === l.uid); const open = !!ui.open[l.uid]; const adj = E.lineAdjustment(q, l);
            const errs = v.errors.filter((e: any) => e.lineUid === l.uid);
            return [
              <tr key={l.uid}>
                <td><div className="flex items-center gap-1.5"><span className="fl-dot" style={{ background: cap.color }} /><b>{brandName(q, l.brandIds[0])}</b>{errs.length > 0 && <Badge tone="err">{errs.length} ajuste(s)</Badge>}</div></td>
                <td className="text-center"><Stepper sm value={l.qty} min={1} onMinus={() => lineQty(F, l.uid, -1)} onPlus={() => lineQty(F, l.uid, 1)} /></td>
                <td className="text-xs">{contentSummary(q, l, cap)} {adj.customized ? <Badge tone="warn">Personalizada</Badge> : <Badge tone="ok">Completa</Badge>}</td>
                <td className="text-right"><LinePrice tl={tl} /></td>
                <td className="whitespace-nowrap text-right"><Btn size="xs" onClick={() => { ui.open[l.uid] = !open; F.rerender(); }}>{open ? "Cerrar" : "Personalizar"}</Btn> <Btn size="xs" kind="ghost" icon="x" title={`Quitar ${brandName(q, l.brandIds[0])}`} onClick={() => lineDel(F, l.uid)} /></td>
              </tr>,
              open && <tr key={`${l.uid}-d`}><td colSpan={5}><ContentEditor l={l} />{errs.map((e: any, i: number) => <div key={i} className="mt-2"><Alert kind="err">{e.msg}</Alert></div>)}</td></tr>,
            ];
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

/** Contenido de la capacidad: quitar o agregar elementos con su efecto en precio. */
function ContentEditor({ l }: { l: any }) {
  const F = useFlipper(); const q = F.S.draft;
  const cap = E.capOf(q, l); const capy = E.lineCapacity(q, l);
  const rules = q.rules || {}; const adj = E.lineAdjustment(q, l); const hrs = E.lineHours(q, l);
  const pricingOn = E.nonNeg(rules.maxHoursPerUnit) > 0;
  const adjStep = (k: string, d: number) => {
    const r = cap.resources.find((x: any) => x.key === k);
    const before = E.computeTotals(q).combo.amount; const cur = E.int(l.adjust[k]); const next = cur + d;
    if (E.nonNeg(r.perUnit) * l.qty + next < 0) return;
    const used = E.lineUsage(q, l).total[k] || 0;
    if (d < 0 && E.nonNeg(r.perUnit) * l.qty + next < used) { F.toast(`Hay ${used} ${r.label.toLowerCase()} asignados a marcas. Retíralos en Asignación antes de quitarlos.`, "err"); return; }
    const set = (val: number) => { if (val) l.adjust[k] = val; else delete l.adjust[k]; };
    set(next);
    const h = E.lineHours(q, l);
    if (d > 0 && h.hasModel && h.used > h.max) {
      set(cur);
      void F.confirm("Capacidad máxima de la unidad", <><p>Agregar más elementos supera la capacidad máxima de una unidad de <b>{cap.name}</b> (25% del tiempo de un profesional).</p><p>Puedes contratar <b>1 unidad adicional</b> (+{money(cap.price)} / mes), que incluye un paquete completo más.</p></>, { ok: "Agregar 1 unidad" }).then((ok) => { if (ok) { l.qty += 1; touch(F); F.commit(); } });
      return;
    }
    touch(F); F.commit();
    if (before && !E.computeTotals(q).combo.amount) F.toast("Al personalizar una capacidad se pierde la oferta «Paquete completo».", "err");
  };
  const reset = () => {
    const capy0 = E.lineCapacity(q, { ...l, adjust: {} }); const used = E.lineUsage(q, l).total;
    if (cap.resources.some((r: any) => (used[r.key] || 0) > capy0[r.key])) { F.toast("Hay asignaciones que superan el paquete estándar. Ajusta la asignación primero.", "err"); return; }
    l.adjust = {}; touch(F); F.commit(); F.toast("Paquete completo restaurado.", "ok");
  };
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-50 px-3 py-2">
        <span className="fl-upper">Contenido mensual de la capacidad</span>
        <div className="flex items-center gap-1.5">{adj.customized ? <><Badge tone="warn">Personalizada · no aplica oferta paquete completo</Badge><Btn size="xs" onClick={reset}>Restaurar paquete</Btn></> : <Badge tone="ok">Paquete completo</Badge>}</div>
      </div>
      <table className="fl-tbl compact">
        <thead><tr><th>Elemento</th><th className="text-center">Paquete</th><th className="text-center">Contratado</th><th className="text-right">Efecto en precio</th></tr></thead>
        <tbody>{cap.resources.map((r: any) => {
          const base = E.nonNeg(r.perUnit) * l.qty; const cur = capy[r.key]; const det = adj.detail.find((x: any) => x.key === r.key);
          const canAdj = pricingOn && r.adjustable && E.nonNeg(r.refValue) > 0;
          return (
            <tr key={r.key}>
              <td>{r.label}</td><td className="text-center tabular-nums text-stone-500">{fmtNum(base)}</td>
              <td className="text-center">{canAdj ? <Stepper sm value={cur} onMinus={() => adjStep(r.key, -1)} onPlus={() => adjStep(r.key, 1)} /> : <b className="tabular-nums">{fmtNum(cur)}</b>}</td>
              <td className="text-right text-xs tabular-nums">{det ? <span style={{ color: det.amount < 0 ? "var(--fl-ok)" : "var(--ork-violet)" }}>{det.amount < 0 ? "−" : "+"}{money(Math.abs(det.amount))}</span> : <span className="text-stone-400">—</span>}</td>
            </tr>
          );
        })}</tbody>
      </table>
      <div className="border-t border-stone-200 px-3 py-2 text-[11px] text-stone-500">
        {pricingOn ? <>El paquete completo es la mejor tarifa. Al quitar un elemento se descuenta el {100 - E.nonNeg(rules.removalPenaltyPct)}% de su valor; al agregarlo se cobra su valor + {E.nonNeg(rules.additionSurchargePct)}%. Precio mínimo: {E.nonNeg(rules.floorPct)}% del paquete.{adj.floorApplied && <b> Se aplicó el precio mínimo.</b>}
          {hrs.hasModel && F.isInternal && <> · Ocupación estimada (interno): <b style={{ color: hrs.used > hrs.max ? "var(--fl-err)" : undefined }}>{pctText(hrs.used)} / {hrs.max} h</b>, máx. 25% del profesional por unidad</>}</>
          : "Cotización con reglas anteriores: actualiza las tarifas en el paso 4 para personalizar el contenido."}
      </div>
    </div>
  );
}

/* =====================================================================
   PASO 3 · ASIGNACIÓN
   ===================================================================== */
function Step3({ v, step }: { v: any; step: (n: number) => void }) {
  const F = useFlipper(); const q = F.S.draft; const ui = F.ui;
  if (!q.lines.length) return <Card className="fl-empty"><Ic n="layers" size={28} /><div>Agrega capacidades en el paso 2 para asignar sus recursos.</div><Btn className="mt-3" onClick={() => step(2)}>Ir a capacidades</Btn></Card>;
  const isOpen = (uid: string) => (uid in ui.open3 ? ui.open3[uid] : q.lines.length <= 3);
  const setAll = (val: boolean) => { q.lines.forEach((l: any) => { ui.open3[l.uid] = val; }); F.rerender(); };
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-stone-500">{q.lines.length} capacidad(es) en la propuesta. Despliega cada una para asignar sus entregables a las marcas.</span><div className="flex gap-1.5"><Btn size="xs" onClick={() => setAll(true)}>Desplegar todo</Btn><Btn size="xs" onClick={() => setAll(false)}>Contraer todo</Btn></div></div>
      {q.lines.map((l: any) => {
        const cap = E.capOf(q, l); const capy = E.lineCapacity(q, l); const use = E.lineUsage(q, l).total;
        const open = isOpen(l.uid) || v.errors.some((e: any) => e.lineUid === l.uid);
        const sub = `${l.mode === "exclusive" ? `Exclusiva de ${brandName(q, l.brandIds[0])}` : `Compartida entre ${l.brandIds.length} marca(s)`} · ${l.qty} unidad(es)`;
        const alloc = cap.resources.filter((r: any) => r.allocatable);
        if (!open) return (
          <div key={l.uid} className="fl-card tight fl-line" style={{ ["--c" as string]: cap.color }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2"><span className="fl-capicon sm"><Ic n={cap.icon || "box"} size={15} /></span><div><b>{cap.name}</b><div className="text-[11px] text-stone-500">{sub}</div></div></div>
              <div className="flex flex-wrap items-center gap-1.5">
                {alloc.map((r: any) => { const u = use[r.key] || 0; const c = capy[r.key]; return <span key={r.key} className={`fl-mini ${u > c ? "over" : u === c && c ? "full" : ""}`}><i style={{ width: `${c ? Math.min(100, Math.round((u * 100) / c)) : 0}%` }} /><em>{r.short || r.label} {fmtNum(u)}/{fmtNum(c)}</em></span>; })}
                <Btn size="xs" onClick={() => { ui.open3[l.uid] = true; F.rerender(); }}>Asignar <Ic n="chevDown" size={13} /></Btn>
              </div>
            </div>
          </div>
        );
        return (
          <div key={l.uid} className="fl-card fl-line" style={{ ["--c" as string]: cap.color }}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-3"><span className="fl-capicon"><Ic n={cap.icon || "box"} size={20} /></span><div><h3 className="text-base font-semibold">{cap.name}</h3><div className="text-xs text-stone-500">{sub}</div></div></div>
              <div className="flex gap-1.5"><Btn size="sm" kind="ghost" icon="edit" onClick={() => step(2)}>Marcas y unidades</Btn><Btn size="xs" onClick={() => { ui.open3[l.uid] = false; F.rerender(); }}>Contraer <Ic n="chevDown" size={13} className="rotate-180" /></Btn></div>
            </div>
            <div className={`grid gap-3 ${alloc.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              {alloc.map((r: any) => cap.engine === "requests" && r.key === "hours" ? <Progress2 key={r.key} appr={use.hoursApproved || 0} resv={use.hoursReserved || 0} cap={capy.hours} label={r.label} /> : <Progress key={r.key} used={use[r.key] || 0} cap={capy[r.key]} label={r.label} />)}
            </div>
            {l.brandIds.length ? (cap.engine === "points" ? <EditorPoints l={l} /> : cap.engine === "requests" ? <EditorRequests l={l} /> : <EditorBuckets l={l} />) : <Alert kind="warn">Asigna al menos una marca beneficiaria en el paso 2.</Alert>}
            <div className="flex flex-col gap-1.5"><LineIssues v={v} uid={l.uid} /></div>
          </div>
        );
      })}
      <DistributionPanel />
    </>
  );
}

const brandOpts = (q: any, l: any) => l.brandIds.map((b: string) => [b, brandName(q, b)] as [string, string]);

function EditorPoints({ l }: { l: any }) {
  const F = useFlipper(); const q = F.S.draft; const cap = E.capOf(q, l);
  const [add, setAdd] = useState({ d: cap.deliverables[0]?.id ?? "", b: l.brandIds[0] ?? "", n: "1" });
  const dOpts = cap.deliverables.map((d: any) => [d.id, `${d.name} — ${d.points} pts`] as [string, string]);
  const addItem = () => {
    const qty = parseIntSafe(add.n); if (qty < 1) { F.toast("La cantidad debe ser mayor que cero.", "err"); return; }
    if (guarded(F, l, (x) => x.items.push({ id: E.uid("it"), deliverableId: add.d, brandId: add.b || l.brandIds[0], qty }))) F.toast("Entregable asignado.", "ok");
  };
  return (
    <div className="overflow-x-auto"><table className="fl-tbl compact">
      <thead><tr><th>Entregable</th><th>Marca</th><th className="text-center">Cantidad</th><th className="text-right">Puntos</th><th /></tr></thead>
      <tbody>{l.items.map((it: any) => { const d = E.deliverableOf(cap, it.deliverableId); return (
        <tr key={it.id}>
          <td><Sel className="sm" value={it.deliverableId} options={dOpts} onChange={(val) => guarded(F, l, (x) => { x.items.find((i: any) => i.id === it.id).deliverableId = val; })} />{d ? <div className="mt-1 text-[11px] text-stone-500">{d.spec}</div> : <div className="text-[11px] text-rose-600">Entregable no disponible en la tarifa</div>}</td>
          <td><Sel className="sm" value={it.brandId} options={brandOpts(q, l)} onChange={(val) => guarded(F, l, (x) => { x.items.find((i: any) => i.id === it.id).brandId = val; })} /></td>
          <td className="text-center"><Stepper sm min={1} value={it.qty} onMinus={() => guarded(F, l, (x) => { const i = x.items.find((y: any) => y.id === it.id); i.qty = Math.max(1, i.qty - 1); })} onPlus={() => guarded(F, l, (x) => { const i = x.items.find((y: any) => y.id === it.id); i.qty += 1; })} /></td>
          <td className="text-right font-semibold tabular-nums">{d ? it.qty * d.points : 0}</td>
          <td className="text-right"><Btn size="sm" kind="ghost" icon="trash" title="Quitar" onClick={() => { l.items = l.items.filter((i: any) => i.id !== it.id); touch(F); F.commit(); }} /></td>
        </tr>); })}
        {!l.items.length && <tr><td colSpan={5} className="text-xs text-stone-500">Sin entregables asignados todavía.</td></tr>}
      </tbody>
      <tfoot><tr><td colSpan={5}><div className="flex flex-wrap gap-2">
        <Sel className="sm" style={{ maxWidth: 280 }} value={add.d} options={dOpts} onChange={(d) => setAdd({ ...add, d })} />
        <Sel className="sm" style={{ maxWidth: 220 }} value={add.b || l.brandIds[0]} options={brandOpts(q, l)} onChange={(b) => setAdd({ ...add, b })} />
        <input className="fl-in sm num" style={{ width: 70 }} value={add.n} inputMode="numeric" aria-label="Cantidad" onChange={(e) => setAdd({ ...add, n: e.target.value })} />
        <Btn size="sm" kind="primary" icon="plus" onClick={addItem}>Agregar entregable</Btn>
      </div></td></tr></tfoot>
    </table></div>
  );
}

function EditorBuckets({ l }: { l: any }) {
  const F = useFlipper(); const S = F.S; const q = S.draft; const cap = E.capOf(q, l); const capy = E.lineCapacity(q, l);
  const res = cap.resources.filter((r: any) => r.allocatable); const info = cap.resources.filter((r: any) => !r.allocatable); const use = E.lineUsage(q, l).total;
  const step = (b: string, k: string, d: number) => guarded(F, l, (x) => { x.alloc[b] ||= {}; x.alloc[b][k] = Math.max(0, E.nonNeg(x.alloc[b][k]) + d); if (!x.alloc[b][k]) delete x.alloc[b][k]; if (!Object.keys(x.alloc[b]).length) delete x.alloc[b]; });
  const cs = cap.usesAdBudget ? E.creativeSource(q, l) : null;
  return (
    <>
      <div className="overflow-x-auto"><table className="fl-tbl compact">
        <thead><tr><th>Marca</th>{res.map((r: any) => <th key={r.key}>{r.label}</th>)}</tr></thead>
        <tbody>{l.brandIds.map((b: string) => <tr key={b}><td><span className="fl-brandtag">{brandName(q, b)}</span></td>{res.map((r: any) => { const full = (use[r.key] || 0) >= capy[r.key]; return <td key={r.key}><Stepper sm value={E.nonNeg(l.alloc[b]?.[r.key])} onMinus={() => step(b, r.key, -1)} onPlus={() => step(b, r.key, 1)} plusTitle={full ? "Capacidad completa: requiere ampliación" : undefined} /></td>; })}</tr>)}</tbody>
        <tfoot><tr><td className="font-semibold">Total asignado</td>{res.map((r: any) => <td key={r.key} className={`tabular-nums ${(use[r.key] || 0) > capy[r.key] ? "text-rose-600" : ""}`}>{fmtNum(use[r.key] || 0)} / {fmtNum(capy[r.key])}</td>)}</tr></tfoot>
      </table></div>
      {info.length > 0 && <div className="text-xs text-stone-500">También incluye: {info.map((r: any) => `${fmtNum(capy[r.key])} ${r.label.toLowerCase()}`).join(" · ")}.</div>}
      {["cap_community", "cap_design"].includes(cap.id) && <div className="text-xs text-stone-500">Las cantidades por tipo no son intercambiables. Para cambiar la composición, ajusta el contenido de la capacidad en el paso 2.</div>}
      {cs && <div className="text-xs">
        {cs.ork.length > 0 && <div className="flex items-center gap-1"><Ic n="check" size={13} className="text-[var(--fl-ok)]" /> Creatividades producidas por {S.settings.companyName || "OR-K"} (la marca tiene Community &amp; Content): <b>{cs.ork.map((b: string) => brandName(q, b)).join(", ")}</b></div>}
        {cs.client.length > 0 && <div className="flex items-center gap-1"><Ic n="info" size={13} className="text-amber-600" /> Creatividades suministradas por el cliente (la marca no tiene Community &amp; Content): <b>{cs.client.map((b: string) => brandName(q, b)).join(", ")}</b></div>}
      </div>}
      {cap.usesAdBudget && <div>
        <div className="fl-upper mb-1.5">Indicadores de seguimiento sugeridos</div>
        <div className="flex flex-wrap gap-1.5">{S.settings.kpiCatalog.map((k: string) => <button key={k} className={`fl-chip ${l.kpis.includes(k) ? "on" : ""}`} onClick={() => { l.kpis = l.kpis.includes(k) ? l.kpis.filter((x: string) => x !== k) : [...l.kpis, k]; touch(F); F.commit(); }}>{k}</button>)}</div>
        <div className="mt-1.5 text-[11px] text-stone-500">Se presentan como objetivos o campos de seguimiento, no como resultados garantizados. El presupuesto de pauta se registra en el paso 4.</div>
      </div>}
    </>
  );
}

const STATUS_CLS: Record<string, string> = { Pendiente: "pend", Estimada: "est", Aprobada: "ok", "En ejecución": "run", Terminada: "done" };
function EditorRequests({ l }: { l: any }) {
  const F = useFlipper(); const q = F.S.draft; const cap = E.capOf(q, l);
  const u = E.lineUsage(q, l).total; const c = E.lineCapacity(q, l);
  const upd = (rq: any, fn: (r: any) => void) => guarded(F, l, (x) => fn(x.requests.find((y: any) => y.id === rq.id)));
  const field = (rq: any, f: string, val: string) => {
    if (f === "name") { if (!val.trim()) { F.toast("La solicitud necesita un nombre.", "err"); F.rerender(); return; } rq.name = val.trim(); touch(F); F.commit(); return; }
    if (["description", "workType", "priority", "brandId"].includes(f)) { rq[f] = val; touch(F); F.commit(); return; }
    if (f === "estHours") { const n = parseIntSafe(val); upd(rq, (r) => { const appr = E.APPROVED_STATES.includes(r.status); if (appr && (!E.nonNeg(r.approvedHours) || E.nonNeg(r.approvedHours) === E.nonNeg(r.estHours))) r.approvedHours = n; r.estHours = n; if (E.nonNeg(r.consumedHours) > E.nonNeg(r.approvedHours)) r.consumedHours = r.approvedHours; }); F.rerender(); return; }
    if (f === "consumedHours") { const n = parseIntSafe(val); if (n > E.nonNeg(rq.approvedHours)) { F.toast("Las horas consumidas no pueden superar las aprobadas.", "err"); F.rerender(); return; } rq.consumedHours = n; touch(F); F.commit(); return; }
    if (f === "status") { upd(rq, (r) => { r.status = val; if (E.APPROVED_STATES.includes(val) && !E.nonNeg(r.approvedHours)) r.approvedHours = E.nonNeg(r.estHours); if (!E.APPROVED_STATES.includes(val)) { r.approvedHours = 0; r.consumedHours = 0; } }); F.rerender(); return; }
    if (f === "approvedHours") { const n = parseIntSafe(val); upd(rq, (r) => { r.approvedHours = n; if (E.nonNeg(r.consumedHours) > n) r.consumedHours = n; }); F.rerender(); }
  };
  const addRq = () => {
    const mk = (x: any) => ({ id: E.uid("rq"), name: "Nueva solicitud", brandId: x.brandIds[0], workType: cap.workTypes[0], description: "", estHours: 0, priority: "Media", status: "Estimada", approvedHours: 0, consumedHours: 0 });
    if (u.requests >= c.requests) { guarded(F, l, (x) => x.requests.push(mk(x))); return; }
    l.requests.push(mk(l)); touch(F); F.commit();
  };
  const hrs = (rq: any, f: string, label: string, dis: boolean, hint?: string) => (
    <label className="block"><span className="mb-1 block text-[11px] font-medium text-stone-500">{label}</span>
      <span className={`fl-inunit ${dis ? "dis" : ""}`}><TextIn className="num sm" inputMode="numeric" value={E.nonNeg(rq[f])} disabled={dis} onCommit={(val) => field(rq, f, val)} /><em>h</em></span>
      {hint && <span className="mt-0.5 block text-[10px] text-stone-400">{hint}</span>}
    </label>
  );
  return (
    <>
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5"><i className="fl-sw appr" />Aprobadas {fmtNum(u.hoursApproved || 0)} h</span>
        <span className="flex items-center gap-1.5"><i className="fl-sw resv" />Reservadas {fmtNum(u.hoursReserved || 0)} h</span>
        <span className="flex items-center gap-1.5"><i className="fl-sw" />Disponibles {fmtNum(Math.max(0, c.hours - (u.hours || 0)))} h</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {l.requests.map((rq: any) => { const appr = E.APPROVED_STATES.includes(rq.status); return (
          <div key={rq.id} className={`fl-rq st-${STATUS_CLS[rq.status] || "pend"}`}>
            <div className="flex items-center gap-2">
              <TextIn className="grow font-semibold" value={rq.name} placeholder="Nombre de la solicitud" onCommit={(val) => field(rq, "name", val)} />
              <Sel className="sm fl-status" value={rq.status} options={E.REQUEST_STATES} onChange={(val) => field(rq, "status", val)} ariaLabel="Estado" />
              <Btn size="sm" kind="ghost" icon="trash" title="Eliminar solicitud" onClick={() => { l.requests = l.requests.filter((r: any) => r.id !== rq.id); touch(F); F.commit(); }} />
            </div>
            <TextIn className="sm mt-2" value={rq.description || ""} placeholder="Describe brevemente el alcance de la solicitud" onCommit={(val) => field(rq, "description", val)} />
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="block"><span className="mb-1 block text-[11px] font-medium text-stone-500">Marca</span><Sel className="sm" value={rq.brandId} options={brandOpts(q, l)} onChange={(val) => field(rq, "brandId", val)} /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-medium text-stone-500">Tipo de trabajo</span><Sel className="sm" value={rq.workType} options={cap.workTypes} onChange={(val) => field(rq, "workType", val)} /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-medium text-stone-500">Prioridad</span><Sel className="sm" value={rq.priority} options={E.PRIORITIES} onChange={(val) => field(rq, "priority", val)} /></label>
              {hrs(rq, "estHours", "Horas estimadas", false, appr ? "" : "Reservan capacidad")}
              {hrs(rq, "approvedHours", "Horas aprobadas", !appr, appr ? "Descuentan capacidad" : "Al aprobar")}
              {hrs(rq, "consumedHours", "Horas consumidas", !appr)}
            </div>
          </div>); })}
        {!l.requests.length && <div className="fl-empty col-span-full"><Ic n="code" size={24} /><div>Sin solicitudes todavía. Agrega la primera para reservar horas de la bolsa.</div></div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-stone-500">Las solicitudes <b>pendientes o estimadas</b> reservan sus horas estimadas; al <b>aprobarlas</b> cuentan sus horas aprobadas. Nunca se puede superar la bolsa contratada.</span>
        <Btn size="sm" kind="primary" icon="plus" onClick={addRq}>Nueva solicitud</Btn>
      </div>
    </>
  );
}

const PALETTE = ["#9B4DFF", "#E0218A", "#D08A5B", "#7C83F0", "#C77DB8", "#F472B6", "#C8553D", "#B79FD6", "#9CA3AF", "#6B4FA3"];
function DistributionPanel() {
  const F = useFlipper(); const q = F.S.draft; const ui = F.ui;
  const d = E.computeDistribution(q);
  const total = d.byLine.reduce((a: number, x: any) => a + x.net, 0);
  const color = (i: number) => PALETTE[i % PALETTE.length];
  const brandVal = d.brands.map((b: any) => b.exclusiveValue + b.sharedValue); const unassigned = d.byLine.reduce((a: number, x: any) => a + x.unassigned, 0);
  return (
    <Card>
      <CardHead title="Asignación por marca" sub="Ambas vistas usan exactamente los mismos datos. El valor de una capacidad compartida se factura una sola vez.">
        <Seg value={ui.distView} options={[["capability", "Por capacidad"], ["brand", "Por marca"]]} onChange={(val) => { ui.distView = val; F.rerender(); }} />
        <Seg value={q.shareMode} options={[["consumption", "Por consumo"], ["manual", "Manual"]]} onChange={(val) => { q.shareMode = val; touch(F); F.commit(); }} />
      </CardHead>
      {total > 0 && <>
        <div className="fl-stack mb-2">{d.brands.map((b: any, i: number) => brandVal[i] ? <i key={b.id} style={{ width: `${(brandVal[i] * 100) / total}%`, background: color(i) }} title={`${b.name}: ${money(brandVal[i])}`} /> : null)}{unassigned > 0 && <i style={{ width: `${(unassigned * 100) / total}%`, background: "#e7e5e4" }} title="No asignado" />}</div>
        <div className="mb-4 flex flex-wrap gap-4 text-xs">{d.brands.map((b: any, i: number) => <span key={b.id} className="flex items-center gap-1.5"><span className="fl-dot" style={{ background: color(i) }} />{b.name} <b className="tabular-nums">{money(brandVal[i])}</b></span>)}{unassigned > 0 && <span className="flex items-center gap-1.5"><span className="fl-dot" style={{ background: "#d6d3d1" }} />Capacidad no asignada <b className="tabular-nums">{money(unassigned)}</b></span>}</div>
      </>}
      {ui.distView === "capability" ? d.byLine.map((x: any) => (
        <div key={x.uid} className="mb-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1.5"><span className="fl-dot" style={{ background: x.cap.color }} /><b>{x.cap.name}</b><Badge tone={x.mode === "exclusive" ? "b" : "v"}>{x.mode === "exclusive" ? "Exclusiva" : "Compartida"}</Badge></div><span className="text-xs">Valor facturado: <b className="tabular-nums">{money(x.net)}</b> <span className="text-stone-500">(una sola vez)</span></span></div>
          <div className="overflow-x-auto"><table className="fl-tbl compact">
            <thead><tr><th>Marca</th><th>Entregables y recursos</th><th className="text-right">{x.mode === "exclusive" ? "Valor exclusivo" : "Participación informativa"}</th></tr></thead>
            <tbody>
              {x.perBrand.map((pb: any) => (
                <tr key={pb.brandId}><td className="font-semibold">{brandName(q, pb.brandId)}</td><td className="text-xs">{pb.detail.length ? pb.detail.map((t: string, i: number) => <div key={i}>{t}</div>) : <span className="text-stone-400">Sin recursos asignados</span>}</td>
                  <td className="text-right tabular-nums">{q.shareMode === "manual" && x.mode === "shared" ? <><div className="flex items-center justify-end gap-1"><TextIn className="sm num" style={{ width: 70 }} value={pctText(lineByUid(F, x.uid).manualShares[pb.brandId] ?? 0)} onCommit={(val) => { lineByUid(F, x.uid).manualShares[pb.brandId] = parsePct(val); touch(F); F.commit(); }} /> %</div><div className="text-[11px] text-stone-500">{money(pb.value)}</div></> : money(pb.value)}</td></tr>
              ))}
              {x.unassigned > 0 && <tr><td className="text-stone-500">Capacidad no asignada</td><td className="text-xs text-stone-500">Recursos aún disponibles para distribuir</td><td className="text-right tabular-nums text-stone-500">{money(x.unassigned)}</td></tr>}
            </tbody>
          </table></div>
        </div>
      )) : (
        <div className="grid gap-3 md:grid-cols-2">{d.brands.map((b: any, i: number) => {
          const sum = (k: string) => b.lines.reduce((a: number, x: any) => a + E.nonNeg(x.usage[k]), 0);
          const ad = b.ad.meta + b.ad.google + b.ad.other;
          const stats = ([["Horas técnicas", sum("hours")], ["Piezas de diseño", sum("pieces")], ["Catálogos", sum("catalog")], ["Puntos", sum("points")], ["Contenidos", sum("posts") + sum("reels") + sum("stories") + sum("graphics") + sum("carousels")], ["Campañas Meta", sum("meta")], ["Campañas Google", sum("google")]] as [string, number][]).filter((s) => s[1]);
          return (
            <div key={b.id} className="fl-card tight" style={{ borderTop: `3px solid ${color(i)}` }}>
              <div className="flex justify-between"><h3 className="font-semibold">{b.name}</h3><span className="font-semibold tabular-nums">{money(b.exclusiveValue + b.sharedValue)}</span></div>
              <div className="mt-2 flex flex-wrap gap-1.5">{b.exclusiveValue > 0 && <Badge tone="b">Exclusivo {money(b.exclusiveValue)}</Badge>}{b.sharedValue > 0 && <Badge tone="v">Participación compartida {money(b.sharedValue)}</Badge>}{ad > 0 && <Badge>Pauta {money(ad)}</Badge>}</div>
              {stats.length > 0 && <div className="mt-2 flex flex-wrap gap-4 text-xs">{stats.map(([l2, v2]) => <span key={l2}><span className="text-stone-500">{l2}</span> <b>{fmtNum(v2)}</b></span>)}</div>}
              <div className="mt-3 flex flex-col gap-1.5">{b.lines.map((x: any) => <div key={x.uid} className="text-xs"><div className="flex items-center gap-1.5"><span className="fl-dot" style={{ background: x.color }} /><b>{x.capName}</b><span className="text-stone-500">· {x.mode === "exclusive" ? "exclusiva" : "compartida"}</span></div><div className="pl-4 text-stone-500">{x.detail.length ? x.detail.join(" · ") : "Beneficiaria · sin recursos asignados"}</div></div>)}{!b.lines.length && <div className="text-xs text-stone-500">Sin capacidades asignadas.</div>}</div>
            </div>
          );
        })}</div>
      )}
    </Card>
  );
}

/* =====================================================================
   PASO 4 · RESUMEN ECONÓMICO
   ===================================================================== */
function Step4({ v }: { v: any }) {
  const F = useFlipper(); const S = F.S; const q = S.draft; const int = F.isInternal;
  const t = E.computeTotals(q);
  const outdated = Object.keys(q.catalog).filter((id) => capById(F, id) && !sameJson(capById(F, id), q.catalog[id]));
  const rulesOut = !sameJson(q.rules, S.settings.pricing);
  const otherOn = S.settings.enableOtherMedia;
  const [tpl, setTpl] = useState(S.settings.supplementTemplates[0]?.id ?? "__custom");
  const updateTariffs = async () => {
    const ok = await F.confirm("Actualizar tarifas", <>
      <p>Se reemplazarán las tarifas históricas de esta cotización por las vigentes del catálogo:</p>
      <List items={[...(rulesOut ? ["Reglas de precio (personalización, precio mínimo, capacidad máxima y oferta paquete completo)"] : []), ...outdated.map((id) => <>{capById(F, id).name}: {money(q.catalog[id].price)} → <b>{money(capById(F, id).price)}</b></>)]} />
      <p className="text-xs text-stone-500">Los recursos incluidos también se actualizarán; revisa la asignación después.</p>
    </>, { ok: "Actualizar tarifas" });
    if (!ok) return;
    outdated.forEach((id) => { q.catalog[id] = E.clone(capById(F, id)); }); q.rules = E.clone(S.settings.pricing);
    q.tariffsDate = new Date().toISOString(); touch(F); F.commit();
    const vv = E.validateQuote(q); F.toast(vv.ok ? "Tarifas actualizadas." : "Tarifas actualizadas. Hay asignaciones por corregir.", vv.ok ? "ok" : "err");
  };
  const supp = (s: any, f: string, val: any) => {
    if (f === "approved") { if (val && !E.nonNeg(s.value)) F.toast("El suplemento está en $0: registra su valor."); s.approved = val; }
    else if (f === "value") s.value = parseMoney(val);
    else if (f === "name") { if (!String(val).trim()) { F.toast("El suplemento necesita un nombre.", "err"); F.rerender(); return; } s.name = String(val).trim(); }
    else s[f] = val;
    touch(F); F.commit();
  };
  const disc = (d: any, f: string, val: string) => {
    if (f === "type") { d.type = val; d.value = 0; }
    else if (f === "value") { d.value = d.type === "pct" ? parsePct(val) : parseMoney(val); if (d.type === "pct" && d.value > 100) { F.toast("Un descuento porcentual no puede superar el 100%.", "err"); d.value = 0; } }
    else d[f] = val;
    touch(F); F.commit();
    const issues = E.computeTotals(q).discountIssues; if (issues.length) F.toast(issues[0], "err");
  };
  const adField = (b: string, f: string, val: string) => { q.adBudget[b] ||= { meta: 0, google: 0, other: 0 }; q.adBudget[b][f] = parseMoney(val); touch(F); F.commit(); };
  const sumRows: [string, number, boolean?][] = [["Subtotal de servicios (paquetes)", t.services], ["Personalización de capacidades", t.adjustments], ["Subtotal de ampliaciones", t.extras], ["Subtotal de suplementos", t.suppRecurring], ["Subtotal comercial", t.commercial, true], ["Descuento por combinación de capacidades", -t.combo.amount], ["Descuento por volumen", -t.volume.amount], ["Descuentos", -(t.discounts - t.combo.amount - t.volume.amount)], ["Honorarios netos antes de IVA", t.net, true]];
  const p = F.isAdmin ? E.computeProfitability(q, S.costs, S.settings) : null;
  return (
    <>
      {(outdated.length > 0 || rulesOut) && int && <Alert kind="info" action={<Btn size="sm" onClick={updateTariffs}>Actualizar a tarifas vigentes</Btn>}>Esta cotización conserva sus tarifas y reglas históricas del {P.fmtDate(q.tariffsDate || q.createdAt)}. Cambios vigentes en: {[...outdated.map((id) => capById(F, id).name), ...(rulesOut ? ["reglas de precio y oferta paquete completo"] : [])].join(", ")}.</Alert>}
      <Card className="!p-0">
        <div className="px-5 pb-1 pt-4"><h3 className="text-[15px] font-semibold">Servicios seleccionados</h3><p className="text-xs text-stone-500">Importes mensuales recurrentes antes de IVA.</p></div>
        <div className="overflow-x-auto"><table className="fl-tbl">
          <thead><tr><th>Capacidad</th><th>Modalidad</th><th className="text-right">Unidades</th><th className="text-right">Precio por unidad</th><th className="text-right">Personalización</th><th className="text-right">Ampliaciones</th><th className="text-right">Subtotal</th></tr></thead>
          <tbody>{t.lines.map((l: any) => { const line = q.lines.find((x: any) => x.uid === l.uid); return (
            <tr key={l.uid}><td className="font-semibold">{l.name}</td><td className="text-xs">{line.mode === "exclusive" ? `Exclusiva · ${brandName(q, line.brandIds[0])}` : `Compartida · ${line.brandIds.length} marcas`}</td><td className="text-right tabular-nums">{l.qty}</td><td className="text-right tabular-nums">{money(l.unitPrice)}</td><td className="text-right tabular-nums">{l.adjustAmt ? (l.adjustAmt < 0 ? `−${money(-l.adjustAmt)}` : `+${money(l.adjustAmt)}`) : "—"}</td><td className="text-right tabular-nums">{l.extrasAmt ? money(l.extrasAmt) : "—"}</td><td className="text-right font-semibold tabular-nums">{money(l.gross)}</td></tr>); })}
            {!t.lines.length && <tr><td colSpan={7} className="text-stone-500">Sin capacidades.</td></tr>}
          </tbody>
        </table></div>
      </Card>
      <ComboBanner t={t} />

      <Card>
        <CardHead title="Suplementos por complejidad operativa" sub="Nunca se agregan automáticamente: requieren aprobación manual.">
          {int && <><Sel className="sm" style={{ maxWidth: 260 }} value={tpl} onChange={setTpl} options={[...S.settings.supplementTemplates.map((s: any) => [s.id, s.name] as [string, string]), ["__custom", "Suplemento personalizado"]]} /><Btn size="sm" icon="plus" onClick={() => { const tp = S.settings.supplementTemplates.find((s: any) => s.id === tpl); q.supplements.push({ id: E.uid("sp"), name: tp ? tp.name : "Suplemento", description: tp ? tp.description : "", value: tp ? E.nonNeg(tp.value) : 0, periodicity: tp ? tp.periodicity : "Mensual", reason: "", approved: false, taxable: true }); touch(F); F.commit(); }}>Agregar</Btn></>}
        </CardHead>
        {q.supplements.length ? <div className="overflow-x-auto"><table className="fl-tbl compact">
          <thead><tr><th>Suplemento</th><th>Motivo</th><th className="text-right">Valor</th><th>Periodicidad</th><th className="text-center">Aprobado</th><th /></tr></thead>
          <tbody>{q.supplements.map((s: any) => int ? (
            <tr key={s.id}>
              <td><TextIn className="sm" value={s.name} onCommit={(val) => supp(s, "name", val)} /><TextIn className="sm mt-1" value={s.description} placeholder="Descripción" onCommit={(val) => supp(s, "description", val)} /></td>
              <td><TextIn className="sm" value={s.reason} placeholder="Motivo" onCommit={(val) => supp(s, "reason", val)} /></td>
              <td><MoneyIn className="sm" value={s.value} onCommit={(val) => supp(s, "value", val)} /></td>
              <td><Sel className="sm" value={s.periodicity} options={["Mensual", "Único"]} onChange={(val) => supp(s, "periodicity", val)} /></td>
              <td className="text-center"><input type="checkbox" className="fl-check" checked={!!s.approved} onChange={(e) => supp(s, "approved", e.target.checked)} aria-label="Aprobado" /></td>
              <td><Btn size="sm" kind="ghost" icon="trash" title="Quitar suplemento" onClick={() => { q.supplements = q.supplements.filter((x: any) => x.id !== s.id); touch(F); F.commit(); }} /></td>
            </tr>
          ) : s.approved ? <tr key={s.id}><td>{s.name}</td><td className="text-xs">{s.reason}</td><td className="text-right tabular-nums">{money(s.value)}</td><td>{s.periodicity}</td><td className="text-center">✓</td><td /></tr> : null)}</tbody>
        </table></div> : <div className="text-xs text-stone-500">Sin suplementos. Inicialmente en cero.</div>}
        {q.lines.some((l: any) => l.mode === "shared" && l.brandIds.length > 2) && <div className="mt-3"><Alert kind="info">Hay capacidades compartidas entre más de dos marcas. Evalúa si existe complejidad operativa adicional que justifique un suplemento.</Alert></div>}
      </Card>

      <Card>
        <CardHead title="Descuentos" sub={`No se aplican automáticamente. Máximo sugerido: ${q.maxDiscountPct}%.`}>
          {int && <Btn size="sm" icon="plus" onClick={() => { q.discounts.push({ id: E.uid("dc"), type: "pct", value: 0, target: "all", reason: "", authorizedBy: "" }); touch(F); F.commit(); }}>Agregar descuento</Btn>}
        </CardHead>
        {q.discounts.length ? <div className="overflow-x-auto"><table className="fl-tbl compact">
          <thead><tr><th>Tipo</th><th className="text-right">Valor</th><th>Aplica a</th><th>Motivo</th><th>Autoriza</th><th className="text-right">Importe</th><th /></tr></thead>
          <tbody>{q.discounts.map((d: any) => { const row = t.discountRows.find((r: any) => r.id === d.id); return int ? (
            <tr key={d.id}>
              <td><Sel className="sm" value={d.type} options={[["pct", "Porcentaje"], ["fixed", "Valor fijo"]]} onChange={(val) => disc(d, "type", val)} /></td>
              <td>{d.type === "pct" ? <div className="flex items-center gap-1"><TextIn className="sm num" style={{ width: 70 }} value={pctText(d.value)} onCommit={(val) => disc(d, "value", val)} />%</div> : <MoneyIn className="sm" value={d.value} onCommit={(val) => disc(d, "value", val)} />}</td>
              <td><Sel className="sm" value={d.target} onChange={(val) => disc(d, "target", val)} options={[["all", "Subtotal comercial"], ...q.lines.map((l: any) => [l.uid, `${E.capOf(q, l).name} (${l.uid.slice(-4)})`] as [string, string])]} /></td>
              <td><TextIn className="sm" value={d.reason} placeholder="Motivo" onCommit={(val) => disc(d, "reason", val)} /></td>
              <td><TextIn className="sm" value={d.authorizedBy} placeholder="Responsable" onCommit={(val) => disc(d, "authorizedBy", val)} /></td>
              <td className="text-right font-semibold tabular-nums">−{money(row?.amount || 0)}</td>
              <td><Btn size="sm" kind="ghost" icon="trash" title="Quitar descuento" onClick={() => { q.discounts = q.discounts.filter((x: any) => x.id !== d.id); touch(F); F.commit(); }} /></td>
            </tr>
          ) : <tr key={d.id}><td>{d.type === "pct" ? "Porcentaje" : "Valor fijo"}</td><td className="text-right">{d.type === "pct" ? `${d.value}%` : money(d.value)}</td><td>{row?.target || ""}</td><td>{d.reason}</td><td>{d.authorizedBy}</td><td className="text-right tabular-nums">−{money(row?.amount || 0)}</td><td /></tr>; })}</tbody>
        </table></div> : <div className="text-xs text-stone-500">Sin descuentos.</div>}
        <div className="mt-3 flex flex-col gap-1.5">
          {v.errors.filter((e: any) => !e.lineUid && /descuento/i.test(e.msg)).map((e: any, i: number) => <Alert key={`e${i}`} kind="err">{e.msg}</Alert>)}
          {v.warnings.filter((w: any) => /descuento/i.test(w.msg)).map((w: any, i: number) => <Alert key={`w${i}`} kind="warn">{w.msg}</Alert>)}
        </div>
      </Card>

      <Card>
        <CardHead title="Presupuesto publicitario (pauta)" sub="No incluido en los honorarios. Se muestra por separado y no se le aplica el IVA de los servicios." />
        <div className="overflow-x-auto"><table className="fl-tbl compact">
          <thead><tr><th>Marca</th><th className="text-right">Meta Ads</th><th className="text-right">Google Ads</th>{otherOn && <th className="text-right">Otros medios</th>}<th className="text-right">Total</th></tr></thead>
          <tbody>{q.brandIds.map((b: string) => { const a = q.adBudget[b] || {}; return (
            <tr key={b}><td className="font-semibold">{brandName(q, b)}</td><td><MoneyIn className="sm" value={a.meta || 0} onCommit={(val) => adField(b, "meta", val)} /></td><td><MoneyIn className="sm" value={a.google || 0} onCommit={(val) => adField(b, "google", val)} /></td>{otherOn && <td><MoneyIn className="sm" value={a.other || 0} onCommit={(val) => adField(b, "other", val)} /></td>}<td className="text-right font-semibold tabular-nums">{money((a.meta || 0) + (a.google || 0) + (otherOn ? a.other || 0 : 0))}</td></tr>); })}</tbody>
          <tfoot><tr><td className="font-semibold">Total pauta</td><td className="text-right tabular-nums">{money(t.ad.meta)}</td><td className="text-right tabular-nums">{money(t.ad.google)}</td>{otherOn && <td className="text-right tabular-nums">{money(t.ad.other)}</td>}<td className="text-right tabular-nums">{money(t.ad.total)}</td></tr></tfoot>
        </table></div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="text-[15px] font-semibold">Totales mensuales recurrentes</h3>
          <div className="mt-3">
            {sumRows.map(([l2, v2, b]) => <div key={l2} className={`fl-sum ${b ? "font-semibold" : ""}`}><span>{l2}</span><span className="tabular-nums">{v2 < 0 ? `−${money(-v2)}` : money(v2)}</span></div>)}
            <div className="fl-sum"><span className="flex flex-wrap items-center gap-1.5">IVA de servicios {int ? <><TextIn className="sm num" style={{ width: 60 }} value={pctText(q.ivaBp / 100)} onCommit={(val) => { const n = parsePct(val); if (n > 100) { F.toast("Tasa de IVA inválida.", "err"); F.rerender(); return; } q.ivaBp = E.pctToBp(n); touch(F); F.commit(); }} />%</> : fmtPct(q.ivaBp)} <span className="text-[11px] text-stone-500">base gravable {money(t.taxableNet)}</span></span><span className="tabular-nums">{money(t.iva)}</span></div>
            <div className="fl-sum big"><span>Total de servicios</span><span className="tabular-nums">{money(t.totalServices)}</span></div>
            <div className="fl-sum"><span>Presupuesto publicitario separado</span><span className="tabular-nums">{money(t.ad.total)}</span></div>
            <div className="fl-sum big accent"><span>Inversión mensual total estimada</span><span className="tabular-nums">{money(t.totalInvestment)}</span></div>
          </div>
        </Card>
        <Card>
          <h3 className="text-[15px] font-semibold">Cargos únicos (no recurrentes)</h3>
          <p className="text-xs text-stone-500">Suplementos con periodicidad «Único». Se presentan separados de los importes mensuales.</p>
          <div className="mt-3">{t.oneTime.subtotal ? <><div className="fl-sum"><span>Subtotal</span><span className="tabular-nums">{money(t.oneTime.subtotal)}</span></div><div className="fl-sum"><span>IVA</span><span className="tabular-nums">{money(t.oneTime.iva)}</span></div><div className="fl-sum big"><span>Total cargos únicos</span><span className="tabular-nums">{money(t.oneTime.total)}</span></div></> : <div className="text-xs text-stone-500">Sin cargos únicos.</div>}</div>
          {p && <div className="mt-4 border-t border-dashed border-stone-300 pt-3"><ProfitMini p={p} /></div>}
        </Card>
      </div>

      <Card>
        <h3 className="text-[15px] font-semibold">Notas</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <FieldL label="Notas para el cliente (aparecen en la propuesta)"><AreaIn value={q.clientNotes} onCommit={(val) => { q.clientNotes = val; touch(F); F.commit(); }} /></FieldL>
          {F.isAdmin && <FieldL label={<span className="flex items-center gap-1"><Ic n="lock" size={12} /> Notas privadas (nunca se exportan en la propuesta)</span>}><AreaIn value={q.privateNotes} onCommit={(val) => { q.privateNotes = val; touch(F); F.commit(); }} /></FieldL>}
        </div>
      </Card>
    </>
  );
}
function ProfitMini({ p }: { p: any }) {
  const F = useFlipper();
  if (p.pending) return <><div className="fl-upper flex items-center gap-1"><Ic n="lock" size={11} /> Rentabilidad interna</div><div className="mt-1 text-xs text-stone-500">Rentabilidad pendiente de configuración{p.lines.some((l: any) => !l.configured) ? `: faltan costos de ${p.lines.filter((l: any) => !l.configured).map((l: any) => l.name).join(", ")}` : ""}.</div><Btn size="sm" className="mt-2" onClick={() => F.go("team")}>Configurar costos</Btn></>;
  return <><div className="fl-upper flex items-center gap-1"><Ic n="lock" size={11} /> Rentabilidad interna</div><div className="fl-sum"><span>Ingresos netos antes de impuestos</span><span className="tabular-nums">{money(p.revenue)}</span></div><div className="fl-sum"><span>Costos directos</span><span className="tabular-nums">{money(p.cost)}</span></div><div className="fl-sum font-semibold"><span>Margen de contribución</span><span className="tabular-nums">{money(p.margin)}</span></div><div className="mt-1 flex justify-end"><MarginBadge bp={p.marginBp} status={p.status} /></div></>;
}

/* =====================================================================
   PASO 5 · PROPUESTA
   ===================================================================== */
function Step5({ v, step }: { v: any; step: (n: number) => void }) {
  const F = useFlipper(); const S = F.S; const q = S.draft;
  const dup = async (asScenario: boolean) => {
    if (q._dirty || !q.number) {
      if (!(await F.confirm("Guardar antes de duplicar", <p>Se guardará la cotización actual para que el original quede intacto y luego se abrirá la copia.</p>, { ok: "Guardar y duplicar" }))) return;
      if (!persistDraft(F, { silent: true })) return;
    }
    const copy = E.clone(q); delete copy._sourceId; copy.id = E.uid("q"); copy.number = null; copy.status = "Borrador"; copy.createdAt = copy.updatedAt = new Date().toISOString();
    if (asScenario) copy.scenarioName = nextScenarioName(F, q.groupId); else { copy.groupId = E.uid("grp"); copy.name = `${q.name} (copia)`; }
    S.draft = copy; S.draft._dirty = true; F.ui.step = asScenario ? 2 : 1; F.commit();
    F.toast(asScenario ? `Escenario «${copy.scenarioName}» creado. El original no cambia.` : "Copia creada. El original no cambia.", "ok");
  };
  const compare = async () => {
    if (q._dirty || !q.number) {
      if (!(await F.confirm("Guardar para comparar", <p>La comparación usa cotizaciones guardadas. ¿Guardar la actual?</p>, { ok: "Guardar y comparar" }))) return;
      if (!persistDraft(F, { silent: true })) return;
    }
    F.go("scenarios", { compareGroup: q.groupId, compare: [] });
  };
  return (
    <>
      <Card>
        <CardHead title="Propuesta comercial" sub="Vista previa del documento que recibe el cliente. No incluye costos, márgenes ni notas privadas.">
          <label className="flex items-center gap-2 text-xs text-stone-500">Estado <Sel className="sm" style={{ width: "auto" }} value={q.status} options={E.QUOTE_STATES} onChange={(val) => { q.status = val; touch(F); F.commit(); }} /></label>
        </CardHead>
        <div className="flex flex-wrap gap-2">
          <Btn kind="primary" icon="check" onClick={() => persistDraft(F)}>Guardar</Btn>
          <Btn icon="copy" onClick={() => dup(false)}>Duplicar</Btn>
          <Btn icon="layers" onClick={() => dup(true)}>Crear escenario alternativo</Btn>
          <Btn icon="compare" onClick={compare}>Comparar escenarios</Btn>
          <Btn icon="print" onClick={() => printQuote(F, q)}>Imprimir / Exportar PDF</Btn>
          <Btn icon="download" onClick={() => exportClientHTML(F, q)}>Exportar HTML para cliente</Btn>
          <Btn kind="ghost" icon="edit" onClick={() => step(3)}>Volver a editar</Btn>
        </div>
        {v.errors.length > 0 && <div className="mt-3"><Alert kind="err"><b>La propuesta tiene ajustes pendientes:</b><List items={v.errors.map((e: any) => e.msg)} /></Alert></div>}
        <p className="mt-3 text-[11px] text-stone-500">Para PDF: en el diálogo de impresión elige «Guardar como PDF», tamaño A4 vertical. El HTML para cliente es un archivo independiente que solo contiene esta propuesta.</p>
      </Card>
      {q.client && <ProposalPreview q={q} />}
    </>
  );
}
export function ProposalPreview({ q }: { q: any }) {
  const F = useFlipper();
  // HTML generado por el motor de propuestas a partir de datos escapados (P.h); no incluye costos ni notas privadas.
  return (
    <div className="fl-paper overflow-x-auto rounded-2xl bg-stone-200/70 p-4">
      <style>{P.CSS}{".fl-paper .pp-page{margin:0 auto 16px;box-shadow:0 6px 26px rgba(0,0,0,.12)}"}</style>
      <div dangerouslySetInnerHTML={{ __html: P.render(q, F.S.settings) }} />
    </div>
  );
}

/* =====================================================================
   AJUSTES DE NEGOCIACIÓN (modal en vivo)
   ===================================================================== */
export function openNegotiation(F: Flipper) {
  if (!F.S.draft) return;
  void F.openModal({ title: "Ajustes de negociación", wide: true, body: () => <Negotiation />, footer: (close) => <Btn kind="primary" onClick={() => close()}>Listo</Btn> });
}
export function TierInputs({ tiers, onSet, combo }: { tiers: number[]; onSet: (i: number, v: string) => void; combo?: boolean }) {
  return (<>{[1, 2, 3].map((i) => (
    <div key={i} className="flex items-center gap-1 text-xs"><span className="text-stone-500">{combo ? (i + 1 === 4 ? "Paquete completo (4)" : `${i + 1} capacidades`) : `${i + 1}.ª${i === 3 ? "+" : ""}`}</span><TextIn className="sm num" style={{ width: 60 }} value={pctText((tiers || [])[i] ?? 0)} onCommit={(val) => onSet(i, val)} />%</div>
  ))}</>);
}
function Negotiation() {
  const F = useFlipper(); const S = F.S; const q = S.draft;
  if (!q) return null;
  const t = E.computeTotals(q); const p = E.computeProfitability(q, S.costs, S.settings); const v = E.validateQuote(q);
  const caps = Object.keys(q.catalog).filter((id) => q.lines.some((l: any) => l.capId === id));
  const r = q.rules || {};
  const done = () => { q.negotiated = true; touch(F); F.commit(); };
  const pctOk = (val: number) => { if (val > 100) { F.toast("Porcentaje inválido.", "err"); F.rerender(); return false; } return true; };
  const rule = (k: string, val: string) => { const n = k === "maxHoursPerUnit" ? parseIntSafe(val) : parsePct(val); if (k !== "maxHoursPerUnit" && !pctOk(n)) return; q.rules[k] = n; done(); };
  const rf = (label: string, key: string, hint = "") => <FieldL label={label} hint={hint}><TextIn className="sm num" value={pctText(r[key] ?? 0)} onCommit={(val) => rule(key, val)} /></FieldL>;
  const restore = (id: string) => {
    const prev = q.catalog[id]; q.catalog[id] = E.clone(capById(F, id));
    if (!E.validateQuote(q).ok && q.lines.some((l: any) => l.capId === id && overResources(q, l).length)) { q.catalog[id] = prev; F.toast("Las asignaciones actuales no caben en el paquete del catálogo. Ajusta la asignación primero.", "err"); return; }
    touch(F); F.commit();
  };
  const perUnit = (cap: any, i: number, val: string) => {
    const res = cap.resources[i]; const n = parseIntSafe(val); const prev = res.perUnit; res.perUnit = n;
    const bad = q.lines.filter((l: any) => l.capId === cap.id).some((l: any) => (E.lineUsage(q, l).total[res.key] || 0) > E.lineCapacity(q, l)[res.key]);
    if (bad) { res.perUnit = prev; F.toast("Hay asignaciones que superarían la nueva cantidad. Ajusta la asignación primero.", "err"); F.rerender(); return; }
    E.rebalanceRefs(cap); done();
  };
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex flex-col gap-3">
        <Alert kind="info">Estos cambios aplican solo a esta cotización y se reflejan de inmediato en el resumen y en la propuesta. El catálogo general no cambia. Los valores de referencia de cada elemento se reajustan automáticamente al nuevo precio.</Alert>
        {caps.map((id) => {
          const cap = q.catalog[id]; const base = capById(F, id); const changed = base && !sameJson(base, cap);
          return (
            <div key={id} className="fl-card tight" style={{ borderLeft: `4px solid ${cap.color}` }}>
              <div className="flex flex-wrap items-center justify-between gap-2"><b>{cap.name}</b><div className="flex gap-1.5">{changed && <Badge tone="warn">Ajustado</Badge>}{changed && <Btn size="xs" onClick={() => restore(id)}>Restaurar catálogo</Btn>}</div></div>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <FieldL label="Precio por unidad (antes de IVA)" hint={base && base.price !== cap.price ? `Catálogo: ${money(base.price)}` : undefined}><MoneyIn className="sm" value={cap.price} onCommit={(val) => { cap.price = parseMoney(val); E.rebalanceRefs(cap); done(); }} /></FieldL>
                {cap.resources.map((res: any, i: number) => <FieldL key={res.key} label={`${res.label} por unidad`} hint={base?.resources[i] && base.resources[i].perUnit !== res.perUnit ? `Catálogo: ${base.resources[i].perUnit}` : undefined}><TextIn className="sm num" value={res.perUnit} onCommit={(val) => perUnit(cap, i, val)} /></FieldL>)}
              </div>
              {F.isAdmin && <div className="mt-2 flex flex-col gap-1.5">{q.lines.filter((l: any) => l.capId === id).map((l: any) => <div key={l.uid} className="flex flex-wrap items-center gap-2 text-xs"><span className="text-stone-500">Perfil interno ({l.mode === "exclusive" ? "exclusiva" : "compartida"} · {l.qty} unid.):</span><ProfileSelect q={q} l={l} /></div>)}</div>}
            </div>
          );
        })}
        {!caps.length && <div className="text-xs text-stone-500">Agrega capacidades para ajustarlas.</div>}
        <div className="fl-card tight">
          <b>Reglas de precio de esta cotización</b>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {rf("Penalidad al quitar (%)", "removalPenaltyPct")}{rf("Recargo al agregar (%)", "additionSurchargePct")}{rf("Precio mínimo (% del paquete)", "floorPct")}{rf("Capacidad máxima por unidad (h)", "maxHoursPerUnit", "Interno: 25% de un profesional ≈ 40 h.")}
            <FieldL label="Descuento por combinación"><label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="fl-check" checked={!!r.comboEnabled} onChange={(e) => { q.rules.comboEnabled = e.target.checked; touch(F); F.commit(); }} /> Disponible en esta cotización</label></FieldL>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4"><span className="text-xs font-semibold">Combinación:</span><TierInputs combo tiers={r.comboTiers || [0, 0, 0, r.comboPct || 0]} onSet={(i, val) => { const n = parsePct(val); if (!pctOk(n)) return; if (!Array.isArray(q.rules.comboTiers)) q.rules.comboTiers = [0, 0, 0, q.rules.comboPct || 0]; q.rules.comboTiers[i] = n; done(); }} /></div>
          <div className="mt-2 flex flex-wrap items-center gap-4"><label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="fl-check" checked={!!r.volumeEnabled} onChange={(e) => { q.rules.volumeEnabled = e.target.checked; if (!Array.isArray(q.rules.volumeTiers)) q.rules.volumeTiers = [0, 10, 15, 20]; touch(F); F.commit(); }} /> Descuento por volumen</label><TierInputs tiers={r.volumeTiers || [0, 0, 0, 0]} onSet={(i, val) => { const n = parsePct(val); if (!pctOk(n)) return; if (!Array.isArray(q.rules.volumeTiers)) q.rules.volumeTiers = [0, 0, 0, 0]; q.rules.volumeTiers[i] = n; done(); }} /></div>
          <div className="mt-2"><Btn size="xs" onClick={() => { q.rules = E.clone(S.settings.pricing); touch(F); F.commit(); }}>Restaurar reglas vigentes</Btn></div>
        </div>
      </div>
      <div className="fl-card tight lg:sticky lg:top-0">
        <div className="fl-upper">Resultado en vivo</div>
        <div className="fl-sum mt-2"><span>Honorarios netos</span><b className="tabular-nums">{money(t.net)}</b></div>
        {t.combo.amount > 0 && <div className="fl-sum ok"><span>Oferta paquete</span><span className="tabular-nums">−{money(t.combo.amount)}</span></div>}
        <div className="fl-sum"><span>IVA</span><span className="tabular-nums">{money(t.iva)}</span></div>
        <div className="fl-sum big"><span>Total servicios</span><span className="tabular-nums">{money(t.totalServices)}</span></div>
        <div className="fl-sum"><span className="text-stone-500">Pauta</span><span className="tabular-nums">{money(t.ad.total)}</span></div>
        {F.isAdmin && <div className="mt-2 border-t border-dashed border-stone-300 pt-2">{p.pending ? <div className="text-xs text-stone-500">Rentabilidad pendiente de configuración</div> : <><div className="fl-sum"><span>Costo directo</span><span className="tabular-nums">{money(p.cost)}</span></div><div className="fl-sum font-semibold"><span>Contribución</span><span className="tabular-nums">{money(p.margin)}</span></div><div className="mt-1"><MarginBadge bp={p.marginBp} status={p.status} /></div></>}</div>}
        {v.errors.length > 0 && <div className="mt-2"><Alert kind="err">{v.errors.slice(0, 3).map((e: any, i: number) => <div key={i}>{e.msg}</div>)}</Alert></div>}
      </div>
    </div>
  );
}

/** Selector de perfil interno para una línea (borrador o cotización guardada). */
export function ProfileSelect({ q, l }: { q: any; l: any }) {
  const F = useFlipper(); const S = F.S;
  const def = S.settings.team.find((t: any) => t.id === S.settings.capProfiles[l.capId]);
  return (
    <Sel className="sm" style={{ maxWidth: 320 }} value={l.profileId ?? ""} onChange={(val) => {
      if (val) l.profileId = val; else delete l.profileId;
      if (q === S.draft) touch(F); else q.updatedAt = new Date().toISOString();
      F.commit();
    }} options={[["", `Predeterminado${def ? ` · ${def.name}` : ""}`], ...S.settings.team.map((t: any) => [t.id, `${t.name} · ${money(E.profileUnitCost(t))}/cuenta`] as [string, string])]} />
  );
}
