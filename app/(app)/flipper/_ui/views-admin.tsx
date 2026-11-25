"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/immutability -- Flipper muta su estado (F.S, F.ui) y luego llama a commit(), igual que el original; no hay React Compiler. */
import { useState } from "react";
import { E } from "@/lib/apps/flipper/engine";
import { useFlipper } from "./store";
import {
  Alert, AreaIn, Badge, Btn, Card, CardHead, FieldL, Ic, Internal, MarginBadge, MoneyIn, PageHead, Sel, StatusBadge, TextIn,
  fmtNum, fmtPct, money, parseIntSafe, parseMoney, parsePct, pctText,
} from "./kit";
import { capById, download, exportClientHTML, nextScenarioName, openQuoteInEditor, printQuote, startQuote } from "./ops";
import { ProfileSelect, TierInputs } from "./quoter";

/* =====================================================================
   COTIZACIONES
   ===================================================================== */
export function QuotesView() {
  const F = useFlipper(); const S = F.S; const ui = F.ui;
  const [term, setTerm] = useState(ui.quoteSearch || "");
  const counts: Record<string, number> = {};
  S.quotes.forEach((q: any) => { const s = E.effectiveStatus(q); counts[s] = (counts[s] || 0) + 1; });
  const t = term.trim().toLowerCase();
  const rows = S.quotes.map((q: any) => ({ q, st: E.effectiveStatus(q), t: E.computeTotals(q) }))
    .filter((x: any) => ui.quoteFilter === "all" || x.st === ui.quoteFilter)
    .filter((x: any) => !t || [x.q.number, x.q.name, x.q.client?.name, x.q.scenarioName].join(" ").toLowerCase().includes(t));
  const dupQ = (src: any) => {
    const c = E.clone(src); c.id = E.uid("q"); c.number = E.nextQuoteNumber(S); c.status = "Borrador"; c.name = `${src.name} (copia)`; c.createdAt = c.updatedAt = new Date().toISOString(); c.date = new Date().toISOString().slice(0, 10);
    S.quotes.unshift(c); F.commit(); F.toast(`Copia creada: ${c.number}. Conserva las tarifas de la original.`, "ok");
  };
  const delQ = async (q: any) => {
    if (!(await F.confirm("Eliminar cotización", <p>Se eliminará definitivamente <b>{q.number}</b> — {q.name}.</p>, { ok: "Eliminar", danger: true }))) return;
    S.quotes = S.quotes.filter((x: any) => x.id !== q.id); ui.compare = ui.compare.filter((x: string) => x !== q.id);
    if (S.draft && S.draft.id === q.id) { S.draft.number = null; S.draft._sourceId = null; S.draft._dirty = true; }
    F.commit(); F.toast("Cotización eliminada.");
  };
  const setStatus = (q: any, st: string) => {
    q.status = st; q.updatedAt = new Date().toISOString(); if (S.draft && S.draft.id === q.id) S.draft.status = st;
    F.commit(); F.toast(`${q.number}: ${st}.`);
  };
  return (
    <>
      <PageHead title="Mis cotizaciones" sub="Cada cotización conserva sus tarifas históricas. Los cambios posteriores del catálogo no la alteran.">
        {ui.compare.length >= 2 && <Btn icon="compare" onClick={() => F.go("scenarios", { compareGroup: null })}>Comparar seleccionadas ({ui.compare.length})</Btn>}
        <Btn kind="primary" icon="plus" onClick={() => startQuote(F)}>Crear cotización</Btn>
      </PageHead>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="fl-seg">{["all", ...E.QUOTE_STATES].map((s: string) => <button key={s} className={ui.quoteFilter === s ? "on" : ""} onClick={() => { ui.quoteFilter = s; F.rerender(); }}>{s === "all" ? "Todas" : s} <span className="opacity-60">{s === "all" ? S.quotes.length : counts[s] || 0}</span></button>)}</div>
        <label className="fl-search w-full max-w-[280px]"><Ic n="search" size={15} /><input className="fl-in" placeholder="Buscar número, cliente o propuesta" value={term} onChange={(e) => { setTerm(e.target.value); ui.quoteSearch = e.target.value; }} /></label>
      </div>
      <Card className="!p-0">
        {rows.length ? <div className="overflow-x-auto"><table className="fl-tbl">
          <thead><tr><th /><th>Número</th><th>Propuesta</th><th>Cliente</th><th>Fecha</th><th>Vigencia</th><th>Estado</th><th className="text-right">Marcas</th><th className="text-right">Mensual antes de IVA</th><th className="text-right">Mensual con IVA</th><th className="text-right">Pauta separada</th><th /></tr></thead>
          <tbody>{rows.map(({ q, st, t: tt }: any) => (
            <tr key={q.id}>
              <td><input type="checkbox" className="fl-check" checked={ui.compare.includes(q.id)} aria-label="Comparar" title="Seleccionar para comparar" onChange={(e) => { ui.compare = e.target.checked ? [...new Set([...ui.compare, q.id])].slice(-4) : ui.compare.filter((x: string) => x !== q.id); F.rerender(); }} /></td>
              <td className="whitespace-nowrap font-semibold tabular-nums">{q.number}</td>
              <td><div className="font-semibold">{q.name}</div><div className="text-[11px] text-stone-500">{q.scenarioName || ""}</div></td>
              <td>{q.client?.name}</td><td className="whitespace-nowrap text-xs tabular-nums">{q.date}</td><td className="whitespace-nowrap text-xs tabular-nums">{E.expiryDate(q)}</td>
              <td>{F.isInternal && F.perms.write ? <Sel className="sm" style={{ width: "auto" }} value={st} options={E.QUOTE_STATES} onChange={(val) => setStatus(q, val)} /> : <StatusBadge st={st} />}</td>
              <td className="text-right tabular-nums">{q.brandIds.length}</td><td className="text-right font-semibold tabular-nums">{money(tt.net)}</td><td className="text-right tabular-nums">{money(tt.totalServices)}</td><td className="text-right tabular-nums">{money(tt.ad.total)}</td>
              <td className="text-right"><div className="flex justify-end gap-1">
                <Btn size="sm" onClick={() => openQuoteInEditor(F, q.id, 4)}>Abrir</Btn>
                {F.perms.write && <Btn size="sm" kind="ghost" icon="copy" title="Duplicar" onClick={() => dupQ(q)} />}
                <Btn size="sm" kind="ghost" icon="print" title="Imprimir / PDF" onClick={() => printQuote(F, q)} />
                <Btn size="sm" kind="ghost" icon="download" title="Exportar HTML para cliente" onClick={() => exportClientHTML(F, q)} />
                {F.isInternal && F.perms.write && <Btn size="sm" kind="ghost" icon="trash" title="Eliminar" className="text-rose-600" onClick={() => delQ(q)} />}
              </div></td>
            </tr>
          ))}</tbody>
        </table></div> : <div className="fl-empty py-10"><Ic n="file" size={28} /><div>{S.quotes.length ? "No hay cotizaciones con este filtro." : "Todavía no hay cotizaciones guardadas."}</div></div>}
      </Card>
      <p className="mt-3 text-[11px] text-stone-500">«Vencida» se calcula automáticamente cuando la fecha de vigencia expira en cotizaciones en Borrador o Presentada. Los valores son cotizados, no facturación ni ingresos cobrados.</p>
    </>
  );
}

/* =====================================================================
   ESCENARIOS
   ===================================================================== */
export function ScenariosView() {
  const F = useFlipper(); const S = F.S; const ui = F.ui;
  const groups: Record<string, any[]> = {};
  S.quotes.forEach((q: any) => { (groups[q.groupId] ||= []).push(q); });
  const groupList = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  let sel: any[] = [];
  if (ui.compareGroup && groups[ui.compareGroup]) sel = groups[ui.compareGroup].slice().sort((a, b) => (a.scenarioName || "").localeCompare(b.scenarioName || "")).slice(0, 4);
  else sel = ui.compare.map((id: string) => S.quotes.find((q: any) => q.id === id)).filter(Boolean);
  return (
    <>
      <PageHead title="Simulador de escenarios" sub="Compara alcance e inversión. Cada escenario es una cotización independiente: modificar uno no altera los demás." />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
        <Card tight>
          <div className="fl-upper mb-2">Grupos de escenarios</div>
          {groupList.length ? groupList.map(([gid, qs]) => (
            <button key={gid} className={`fl-pick ${gid === ui.compareGroup ? "on" : ""}`} onClick={() => { ui.compareGroup = gid; ui.compare = []; F.rerender(); }}>
              <span className="min-w-0 grow text-left"><span className="block truncate font-semibold">{qs[0].client?.name}</span><span className="block truncate text-[11px] text-stone-500">{qs.length} escenario(s) · {qs[0].name}</span></span>
            </button>
          )) : <div className="text-xs text-stone-500">Guarda una cotización para crear escenarios.</div>}
          <p className="mt-3 text-[11px] text-stone-500">También puedes seleccionar hasta 4 cotizaciones en «Mis cotizaciones» y compararlas.</p>
        </Card>
        <div>{sel.length ? <CompareTable qs={sel} /> : <Card className="fl-empty"><Ic n="compare" size={28} /><div>Selecciona un grupo de escenarios o cotizaciones para comparar.</div></Card>}</div>
      </div>
    </>
  );
}
function CompareTable({ qs }: { qs: any[] }) {
  const F = useFlipper(); const S = F.S;
  const data = qs.map((q) => {
    const t = E.computeTotals(q); const res = { hours: 0, requests: 0, pieces: 0, catalog: 0, points: 0, contents: 0, meta: 0, google: 0 };
    q.lines.forEach((l: any) => { const c = E.lineCapacity(q, l); res.hours += c.hours || 0; res.requests += c.requests || 0; res.pieces += c.pieces || 0; res.catalog += c.catalog || 0; res.points += c.points || 0; res.contents += (c.posts || 0) + (c.reels || 0) + (c.stories || 0) + (c.graphics || 0) + (c.carousels || 0); res.meta += c.meta || 0; res.google += c.google || 0; });
    return { q, t, res };
  });
  const capIds = [...new Set(qs.flatMap((q) => q.lines.map((l: any) => l.capId)))] as string[];
  const base = data[0].t.totalInvestment;
  const capName = (id: string) => { for (const q of qs) if (q.catalog[id]) return q.catalog[id].name; return id; };
  const row = (label: React.ReactNode, fn: (d: any) => React.ReactNode, key: string) => <tr key={key}><td>{label}</td>{data.map((d) => <td key={d.q.id} className="text-right tabular-nums">{fn(d)}</td>)}</tr>;
  const sec = (l: string) => <tr key={l}><td colSpan={data.length + 1} className="fl-upper bg-stone-50">{l}</td></tr>;
  const scnDup = (src: any) => {
    const c = E.clone(src); c.id = E.uid("q"); c.number = E.nextQuoteNumber(S); c.status = "Borrador"; c.scenarioName = nextScenarioName(F, src.groupId); c.createdAt = c.updatedAt = new Date().toISOString();
    S.quotes.unshift(c); F.ui.compareGroup = src.groupId; F.commit(); F.toast(`Escenario «${c.scenarioName}» creado como ${c.number}.`, "ok");
  };
  const other = (d: any) => d.t.discounts - d.t.combo.amount - d.t.volume.amount;
  return (
    <Card className="!p-0">
      <div className="flex justify-between px-5 pb-2 pt-4"><h3 className="text-[15px] font-semibold">Comparación</h3><span className="text-xs text-stone-500">Diferencias calculadas contra la primera columna</span></div>
      <div className="overflow-x-auto"><table className="fl-tbl">
        <thead><tr><th />{data.map((d) => <th key={d.q.id} className="min-w-[170px] text-right !normal-case !tracking-normal"><span className="text-[13px] text-[var(--ork-ink)]">{d.q.scenarioName || d.q.name}</span><div className="text-[11px] font-medium text-stone-500">{d.q.number} · {E.effectiveStatus(d.q)}</div></th>)}</tr></thead>
        <tbody>
          {row("Cliente", (d) => d.q.client?.name, "cli")}{row("Marcas participantes", (d) => d.q.brandIds.length, "mb")}
          {sec("Capacidades (unidades)")}
          {capIds.map((id) => row(capName(id), (d) => { const ls = d.q.lines.filter((l: any) => l.capId === id); return ls.length ? ls.map((l: any) => `${l.qty} ${l.mode === "exclusive" ? "excl." : "comp."}`).join(" + ") : "—"; }, `c${id}`))}
          {sec("Alcance mensual")}
          {row("Horas técnicas", (d) => fmtNum(d.res.hours), "h")}{row("Solicitudes pequeñas", (d) => fmtNum(d.res.requests), "r")}{row("Piezas de diseño / catálogos", (d) => `${fmtNum(d.res.pieces)} / ${fmtNum(d.res.catalog)}`, "p")}
          {data.some((d) => d.res.points) && row("Puntos de diseño", (d) => fmtNum(d.res.points), "pt")}
          {row("Contenidos originales", (d) => fmtNum(d.res.contents), "ct")}{row("Campañas Meta / Google", (d) => `${d.res.meta} / ${d.res.google}`, "mg")}
          {sec("Inversión mensual")}
          {row("Servicios (paquetes)", (d) => money(d.t.services), "sv")}
          {row("Personalización", (d) => (d.t.adjustments < 0 ? `−${money(-d.t.adjustments)}` : money(d.t.adjustments)), "ad")}
          {row("Ampliaciones", (d) => money(d.t.extras), "ex")}{row("Suplementos", (d) => money(d.t.suppRecurring), "su")}
          {row("Oferta paquete completo", (d) => (d.t.combo.amount ? `−${money(d.t.combo.amount)}` : "—"), "co")}
          {row("Descuento por volumen", (d) => (d.t.volume.amount ? `−${money(d.t.volume.amount)}` : "—"), "vo")}
          {row("Otros descuentos", (d) => (other(d) ? `−${money(other(d))}` : money(0)), "od")}
          {row(<b>Honorarios netos</b>, (d) => <b>{money(d.t.net)}</b>, "net")}{row("IVA", (d) => money(d.t.iva), "iva")}
          {row(<b>Total servicios</b>, (d) => <b>{money(d.t.totalServices)}</b>, "ts")}{row("Pauta separada", (d) => money(d.t.ad.total), "pa")}
          {row(<b>Inversión total</b>, (d) => <b className="text-[var(--ork-purple)]">{money(d.t.totalInvestment)}</b>, "it")}
          {row("Diferencia", (d) => { const x = d.t.totalInvestment - base; return x === 0 ? "—" : <span style={{ color: x > 0 ? "var(--ork-violet)" : "var(--fl-ok)" }}>{x > 0 ? "+" : "−"}{money(Math.abs(x))}</span>; }, "df")}
          {data.some((d) => d.t.oneTime.total) && row("Cargos únicos con IVA", (d) => money(d.t.oneTime.total), "ot")}
          <tr><td />{data.map((d) => <td key={d.q.id} className="text-right"><div className="flex justify-end gap-1"><Btn size="sm" onClick={() => openQuoteInEditor(F, d.q.id, 4)}>Editar</Btn>{F.perms.write && <Btn size="sm" icon="copy" title="Duplicar como nuevo escenario" onClick={() => scnDup(d.q)} />}</div></td>)}</tr>
        </tbody>
      </table></div>
    </Card>
  );
}

/* =====================================================================
   RENTABILIDAD (administración)
   ===================================================================== */
export function ProfitView() {
  const F = useFlipper(); const S = F.S; const ui = F.ui;
  if (!F.isAdmin) return <Alert kind="info">Rentabilidad está oculta en modo presentación.</Alert>;
  const options = [...(S.draft ? [{ id: "__draft", label: `Cotización en curso — ${S.draft.name}` }] : []), ...S.quotes.map((q: any) => ({ id: q.id, label: `${q.number} — ${q.name}` }))];
  if (!ui.profitQuoteId || !options.some((o) => o.id === ui.profitQuoteId)) ui.profitQuoteId = options[0]?.id || null;
  const q = ui.profitQuoteId === "__draft" ? S.draft : S.quotes.find((x: any) => x.id === ui.profitQuoteId);
  const configured = S.catalog.filter((c: any) => S.settings.capProfiles[c.id] || E.costConfigured(S.costs[c.id])).length;
  const p = q ? E.computeProfitability(q, S.costs, S.settings) : null;
  return (
    <>
      <PageHead kicker={<Internal />} title="Rentabilidad interna" sub={`${configured} de ${S.catalog.length} capacidades con costos configurados. No se usan costos ficticios.`}>
        <Btn icon="gear" onClick={() => F.go("team")}>Configurar costos</Btn>
      </PageHead>
      {options.length > 0 && <FieldL label="Cotización" className="mb-4 max-w-[520px]"><Sel value={ui.profitQuoteId} options={options.map((o) => [o.id, o.label] as [string, string])} onChange={(val) => { ui.profitQuoteId = val; F.rerender(); }} /></FieldL>}
      {q && p ? (
        <Card className="!p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-4"><h3 className="text-[15px] font-semibold">{q.name}</h3>{p.pending ? <Badge tone="warn">Rentabilidad pendiente de configuración</Badge> : <MarginBadge bp={p.marginBp} status={p.status} />}</div>
          <div className="overflow-x-auto"><table className="fl-tbl">
            <thead><tr><th>Capacidad</th><th>Perfil asignado</th><th className="text-right">Unid.</th><th className="text-right">Ingresos netos</th><th className="text-right">Costos directos</th><th className="text-right">Margen $</th><th className="text-right">Margen %</th><th>Indicador</th></tr></thead>
            <tbody>{p.lines.map((l: any) => { const line = q.lines.find((x: any) => x.uid === l.uid); return l.configured ? (
              <tr key={l.uid}><td className="font-semibold">{l.name}</td><td><ProfileSelect q={q} l={line} /></td><td className="text-right tabular-nums">{l.qty}</td><td className="text-right tabular-nums">{money(l.net)}</td><td className="text-right tabular-nums">{money(l.cost)}</td><td className="text-right tabular-nums">{money(l.margin)}</td><td className="text-right font-semibold tabular-nums">{fmtPct(l.marginBp)}</td><td><MarginBadge bp={l.marginBp} status={l.status} /></td></tr>
            ) : (
              <tr key={l.uid}><td className="font-semibold">{l.name}</td><td><ProfileSelect q={q} l={line} /></td><td className="text-right tabular-nums">{l.qty}</td><td className="text-right tabular-nums">{money(l.net)}</td><td colSpan={4} className="text-stone-500">Rentabilidad pendiente de configuración</td></tr>
            ); })}
              {!p.lines.length && <tr><td colSpan={8} className="text-stone-500">Sin capacidades.</td></tr>}
            </tbody>
            {!p.pending && <tfoot><tr><td>Total (incluye suplementos y descuentos)</td><td /><td /><td className="text-right tabular-nums">{money(p.revenue)}</td><td className="text-right tabular-nums">{money(p.cost)}</td><td className="text-right tabular-nums">{money(p.margin)}</td><td className="text-right tabular-nums">{fmtPct(p.marginBp)}</td><td /></tr></tfoot>}
          </table></div>
          <div className="px-5 py-3 text-xs text-stone-500">Margen de contribución (%) = (Ingresos netos − Costos directos) / Ingresos netos × 100. No es markup. Objetivo: {S.settings.marginTargetPct}% ± {S.settings.marginTolerancePct} p.p. Los costos se toman de Equipo y costos (perfil predeterminado o el asignado a cada línea) y nunca se incluyen en propuestas exportadas.</div>
        </Card>
      ) : <Card className="fl-empty"><Ic n="pie" size={28} /><div>No hay cotizaciones para analizar.</div></Card>}
    </>
  );
}

/* =====================================================================
   EQUIPO Y COSTOS (administración)
   ===================================================================== */
export function TeamView() {
  const F = useFlipper(); const S = F.S;
  if (!F.isAdmin) return <Alert kind="info">Equipo y costos está oculto en modo presentación.</Alert>;
  const team = S.settings.team; const caps = S.catalog.filter((c: any) => c.active); const rules = S.settings.pricing;
  const used = (id: string) => Object.values(S.settings.capProfiles).includes(id) || S.quotes.some((q: any) => q.lines.some((l: any) => l.profileId === id)) || (S.draft && S.draft.lines.some((l: any) => l.profileId === id));
  const tgt = E.pctToBp(S.settings.marginTargetPct); const tol = E.pctToBp(S.settings.marginTolerancePct);
  const cls = (bp: number) => (bp < tgt - tol ? "below" : bp > tgt + tol ? "above" : "within") as "below" | "above" | "within";
  const fullPct = (rules.comboTiers || [])[(rules.comboTiers || []).length - 1] ?? rules.comboPct;
  const teamField = (t: any, f: string, val: string) => {
    if (f === "name") { if (!val.trim()) { F.toast("El perfil necesita un nombre.", "err"); F.rerender(); return; } t.name = val.trim(); }
    else if (f === "overheadPct") { const n = parsePct(val); if (n > 300) { F.toast("Sobrecosto inválido.", "err"); F.rerender(); return; } t.overheadPct = n; }
    else if (f === "accounts") { const n = parseIntSafe(val); if (n < 1) { F.toast("Debe atender al menos 1 cuenta.", "err"); F.rerender(); return; } t.accounts = n; }
    else t[f] = parseMoney(val);
    F.commit();
  };
  const comboCaps = rules.comboCapIds.map((id: string) => capById(F, id)).filter(Boolean);
  const sim = comboCaps.reduce((a: any, c: any) => { const p = team.find((t: any) => t.id === S.settings.capProfiles[c.id]); const extra = E.nonNeg((S.costs[c.id] || {}).operating); a.price += c.price; a.cost += E.profileUnitCost(p) + extra; return a; }, { price: 0, cost: 0 });
  const simCombo = sim.price - E.applyBp(sim.price, E.pctToBp(fullPct));
  const m = (price: number) => (price ? Math.round(((price - sim.cost) * 10000) / price) : 0);
  return (
    <>
      <PageHead kicker={<Internal />} title="Equipo y costos" sub="Ajusta el costo de cada perfil y observa de inmediato la rentabilidad de cada capacidad. Los cambios afectan todos los cálculos internos de rentabilidad; nunca se muestran al cliente.">
        <Btn kind="primary" icon="plus" onClick={() => { S.settings.team.push({ id: E.uid("tm"), name: "Nuevo perfil", salary: 0, monthlyCost: 0, overheadPct: 25, accounts: 4 }); F.commit(); }}>Agregar perfil</Btn>
      </PageHead>
      <Card className="!p-0">
        <div className="px-5 pb-2 pt-4"><h3 className="text-[15px] font-semibold">Perfiles del equipo</h3><p className="text-xs text-stone-500">Costo por cuenta = costo mensual empresa × (1 + sobrecosto) ÷ cuentas que atiende el profesional.</p></div>
        <div className="overflow-x-auto"><table className="fl-tbl">
          <thead><tr><th>Perfil</th><th className="text-right">Salario base</th><th className="text-right">Costo mensual empresa</th><th className="text-right">Sobrecosto %</th><th className="text-right">Cuentas por profesional</th><th className="text-right">Costo por cuenta</th><th /></tr></thead>
          <tbody>{team.map((t: any) => (
            <tr key={t.id}>
              <td><TextIn className="sm" style={{ minWidth: 200 }} value={t.name} onCommit={(val) => teamField(t, "name", val)} /></td>
              <td><MoneyIn className="sm" value={t.salary || 0} onCommit={(val) => teamField(t, "salary", val)} /><div className="mt-1 text-right text-[11px]"><button className="text-[var(--ork-violet)] hover:underline" onClick={() => { if (!t.salary) { F.toast("Ingresa primero el salario base.", "err"); return; } t.monthlyCost = E.applyBp(t.salary, 15300); F.commit(); F.toast(`Costo calculado: ${money(t.monthlyCost)} (salario + 53% de prestaciones).`, "ok"); }}>Calcular costo con 53%</button></div></td>
              <td><MoneyIn className="sm" value={t.monthlyCost} onCommit={(val) => teamField(t, "monthlyCost", val)} /></td>
              <td><TextIn className="sm num ml-auto" style={{ width: 70 }} value={pctText(t.overheadPct)} onCommit={(val) => teamField(t, "overheadPct", val)} /></td>
              <td><TextIn className="sm num ml-auto" style={{ width: 70 }} value={t.accounts} onCommit={(val) => teamField(t, "accounts", val)} /></td>
              <td className="text-right font-semibold tabular-nums">{money(E.profileUnitCost(t))}</td>
              <td className="text-right">{used(t.id) ? <span className="text-[11px] text-stone-500">En uso</span> : <Btn size="sm" kind="ghost" icon="trash" title="Eliminar perfil" className="text-rose-600" onClick={async () => { if (!(await F.confirm("Eliminar perfil", <p>Se eliminará este perfil del equipo.</p>, { ok: "Eliminar", danger: true }))) return; S.settings.team = S.settings.team.filter((x: any) => x.id !== t.id); F.commit(); }} />}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      <Card className="mt-4 !p-0">
        <div className="px-5 pb-2 pt-4"><h3 className="text-[15px] font-semibold">Costo y margen por capacidad</h3><p className="text-xs text-stone-500">Perfil predeterminado de cada capacidad. En una cotización puedes asignar otro perfil a una línea específica (en Rentabilidad o en Ajustes de negociación).</p></div>
        <div className="overflow-x-auto"><table className="fl-tbl">
          <thead><tr><th>Capacidad</th><th>Perfil predeterminado</th><th className="text-right">Otros costos directos / unidad</th><th className="text-right">Costo por unidad</th><th className="text-right">Margen a precio lista</th><th className="text-right">En paquete completo ({fullPct}% off)</th></tr></thead>
          <tbody>{caps.map((cap: any) => {
            const p = team.find((t: any) => t.id === S.settings.capProfiles[cap.id]); const extra = ["direct", "operating", "coordination", "other"].reduce((a, k) => a + E.nonNeg((S.costs[cap.id] || {})[k]), 0);
            const unit = E.profileUnitCost(p) + extra; const has = p || extra;
            const bpList = cap.price ? Math.round(((cap.price - unit) * 10000) / cap.price) : 0;
            const inCombo = rules.comboEnabled && rules.comboCapIds.includes(cap.id); const comboPrice = inCombo ? cap.price - E.applyBp(cap.price, E.pctToBp(fullPct)) : 0;
            const bpCombo = inCombo && comboPrice ? Math.round(((comboPrice - unit) * 10000) / comboPrice) : 0;
            return (
              <tr key={cap.id}>
                <td><div className="font-semibold">{cap.name}</div><div className="text-[11px] text-stone-500">Precio {money(cap.price)}</div></td>
                <td><Sel className="sm" value={S.settings.capProfiles[cap.id] ?? ""} options={[["", "— Sin perfil —"], ...team.map((t: any) => [t.id, t.name] as [string, string])]} onChange={(val) => { if (val) S.settings.capProfiles[cap.id] = val; else delete S.settings.capProfiles[cap.id]; F.commit(); }} /></td>
                <td><MoneyIn className="sm" value={(S.costs[cap.id] || {}).operating || 0} onCommit={(val) => { const c = (S.costs[cap.id] ||= E.emptyCost()); c.operating = parseMoney(val) || null; F.commit(); }} /></td>
                <td className="text-right font-semibold tabular-nums">{has ? money(unit) : "—"}</td>
                <td className="text-right">{has ? <MarginBadge bp={bpList} status={cls(bpList)} /> : <span className="text-[11px] text-stone-500">Pendiente</span>}</td>
                <td className="text-right">{inCombo && has ? <><div className="text-xs tabular-nums">{money(comboPrice)}</div><MarginBadge bp={bpCombo} status={cls(bpCombo)} /></> : <span className="text-[11px] text-stone-500">—</span>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </Card>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Card tight><div className="text-xs text-stone-500">Paquete completo para una marca · precio lista</div><div className="mt-1 font-display text-2xl font-semibold tabular-nums">{money(sim.price)}</div><div className="mt-2"><MarginBadge bp={m(sim.price)} status={cls(m(sim.price))} /></div></Card>
        <Card tight><div className="text-xs text-stone-500">Con oferta paquete completo ({fullPct}%)</div><div className="mt-1 font-display text-2xl font-semibold tabular-nums">{money(simCombo)}</div><div className="mt-2"><MarginBadge bp={m(simCombo)} status={cls(m(simCombo))} /></div></Card>
        <Card tight><div className="text-xs text-stone-500">Costo directo del paquete (incluye sobrecosto)</div><div className="mt-1 font-display text-2xl font-semibold tabular-nums">{money(sim.cost)}</div><div className="mt-2 text-[11px] text-stone-500">Contribución con oferta: {money(simCombo - sim.cost)} / mes · {simCombo && sim.cost ? (simCombo / sim.cost).toFixed(1).replace(".", ",") : "—"}× el costo</div></Card>
      </div>
      <p className="mt-3 text-[11px] text-stone-500">El margen supone que cada profesional tiene todas sus cuentas vendidas. Si atiende menos cuentas de las previstas, el costo real por cuenta aumenta. Margen objetivo: {S.settings.marginTargetPct}% ± {S.settings.marginTolerancePct} p.p. (editable en Configuración).</p>
    </>
  );
}

/* =====================================================================
   CONFIGURACIÓN (administración)
   ===================================================================== */
const TABS: [string, string][] = [["general", "General"], ["caps", "Capacidades y entregables"], ["costs", "Costos detallados"], ["supp", "Suplementos"], ["conds", "Condiciones e indicadores"], ["data", "Datos y respaldo"]];
export function SettingsView() {
  const F = useFlipper(); const ui = F.ui;
  if (!F.isAdmin) return <Alert kind="info">Configuración está oculta en modo presentación.</Alert>;
  const body = { general: <SetGeneral />, caps: <SetCaps />, costs: <SetCosts />, supp: <SetSupp />, conds: <SetConds />, data: <SetData /> }[ui.adminTab as string] ?? <SetGeneral />;
  return (
    <>
      <PageHead kicker={<Internal />} title="Configuración" sub="Los cambios aplican a nuevas cotizaciones. Las cotizaciones guardadas conservan sus tarifas." />
      <div className="fl-tabs mb-4">{TABS.map(([k, l]) => <button key={k} className={ui.adminTab === k ? "on" : ""} onClick={() => { ui.adminTab = k; F.rerender(); }}>{l}</button>)}</div>
      {body}
    </>
  );
}
const listToText = (a: string[]) => (a || []).join("\n");
const textToList = (s: string) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

function SetGeneral() {
  const F = useFlipper(); const S = F.S; const pr = S.settings.pricing;
  const setField = (k: string, raw: string, type: "text" | "num" | "pct" = "text") => {
    let v: any = raw.trim();
    if (type !== "text") { v = type === "pct" ? parsePct(v) : parseIntSafe(v); if (k === "validityDays" && v < 1) { F.toast("La vigencia debe ser al menos 1 día.", "err"); F.rerender(); return; } if (type === "pct" && v > 100) { F.toast("Porcentaje inválido.", "err"); F.rerender(); return; } }
    else if (["companyName", "quotePrefix"].includes(k) && !v) { F.toast("Este campo es obligatorio.", "err"); F.rerender(); return; }
    S.settings[k] = v; F.commit(); F.toast("Configuración actualizada.");
  };
  const sf = (label: string, key: string, type: "text" | "num" | "pct" = "text", hint = "") => <FieldL label={label} hint={hint}><TextIn className={type !== "text" ? "num" : ""} value={type === "pct" ? pctText(S.settings[key]) : S.settings[key] ?? ""} onCommit={(val) => setField(key, val, type)} /></FieldL>;
  const rule = (k: string, val: string) => {
    const n = k === "maxHoursPerUnit" ? parseIntSafe(val) : parsePct(val);
    if (k !== "maxHoursPerUnit" && n > 100) { F.toast("Porcentaje inválido.", "err"); F.rerender(); return; }
    if (k === "maxHoursPerUnit" && n < 1) { F.toast("La capacidad máxima debe ser mayor que cero.", "err"); F.rerender(); return; }
    pr[k] = n; F.commit(); F.toast("Reglas actualizadas para nuevas cotizaciones.");
  };
  const rf = (label: string, key: string, hint = "") => <FieldL label={label} hint={hint}><TextIn className="num" value={pctText(pr[key])} onCommit={(val) => rule(key, val)} /></FieldL>;
  const tier = (arr: "comboTiers" | "volumeTiers", i: number, val: string) => { const n = parsePct(val); if (n > 100) { F.toast("Porcentaje inválido.", "err"); F.rerender(); return; } const t = (pr[arr] ||= [0, 8, 12, 20]); t[i] = n; if (arr === "comboTiers" && i === t.length - 1) pr.comboPct = n; F.commit(); };
  const logo = (file?: File) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { F.toast("El archivo debe ser una imagen.", "err"); return; }
    if (file.size > 1.5 * 1024 * 1024) { F.toast("La imagen supera 1,5 MB. Usa una versión optimizada.", "err"); return; }
    const r = new FileReader(); r.onload = () => { S.settings.logo = r.result; F.commit(); F.toast("Logotipo cargado.", "ok"); }; r.readAsDataURL(file);
  };
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="text-[15px] font-semibold">Identidad</h3>
          <div className="mt-3 flex flex-col gap-3">
            {sf("Nombre de la compañía", "companyName")}{sf("Descriptor", "tagline")}{sf("Lema", "motto")}
            <FieldL label="Logotipo para la propuesta" hint="Se usa tal como se carga, sin redibujarlo ni deformarlo. Mientras no se cargue se muestra el nombre de la compañía. Recomendado: PNG o SVG de menos de 300 KB.">
              <div className="flex items-center gap-3">
                <div className="grid min-h-[56px] min-w-[140px] place-items-center rounded-xl border border-dashed border-stone-300 px-3 py-2">{S.settings.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- logo cargado por el usuario como data URL
                  <img src={S.settings.logo} alt={S.settings.companyName} className="max-h-12 max-w-[160px] object-contain" />
                ) : <span className="font-display font-semibold">{S.settings.companyName}</span>}</div>
                <div className="flex flex-col gap-1.5">
                  <label className="fl-btn sm cursor-pointer"><Ic n="upload" size={14} /> Cargar imagen<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => logo(e.target.files?.[0])} /></label>
                  {S.settings.logo && <Btn size="sm" kind="danger" onClick={() => { S.settings.logo = null; F.commit(); }}>Quitar logotipo</Btn>}
                </div>
              </div>
            </FieldL>
          </div>
        </Card>
        <Card>
          <h3 className="text-[15px] font-semibold">Parámetros comerciales</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {sf("IVA de servicios (%)", "ivaPct", "pct", "Aplica a nuevas cotizaciones.")}{sf("Vigencia por defecto (días)", "validityDays", "num")}{sf("Margen objetivo (%)", "marginTargetPct", "pct")}{sf("Tolerancia del objetivo (p.p.)", "marginTolerancePct", "pct", "Rango «dentro del objetivo».")}{sf("Descuento máximo sugerido (%)", "maxDiscountPct", "pct")}{sf("Prefijo de cotización", "quotePrefix")}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" className="fl-check" checked={!!S.settings.enableOtherMedia} onChange={(e) => { S.settings.enableOtherMedia = e.target.checked; F.commit(); }} /> Habilitar presupuesto de «otros medios» en pauta</label>
        </Card>
      </div>
      <Card className="mt-4">
        <h3 className="text-[15px] font-semibold">Reglas de precio y oferta</h3>
        <p className="mt-1 text-xs text-stone-500">Se copian a cada nueva cotización. Las cotizaciones guardadas conservan sus reglas.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rf("Penalidad al quitar elementos (%)", "removalPenaltyPct", "Se descuenta el resto del valor del elemento quitado.")}{rf("Recargo al agregar elementos (%)", "additionSurchargePct", "Sobre el valor de referencia del elemento.")}{rf("Precio mínimo de una capacidad personalizada (% del paquete)", "floorPct")}{rf("Capacidad máxima por unidad (horas internas)", "maxHoursPerUnit", "≈ 25% del tiempo de un profesional (jornada de 42 h semanales). No se muestra al cliente.")}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4"><span className="text-xs font-semibold">Descuento por combinación de capacidades sin personalizar:</span><TierInputs combo tiers={pr.comboTiers} onSet={(i, val) => tier("comboTiers", i, val)} /></div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="fl-check" checked={!!pr.comboEnabled} onChange={(e) => { pr.comboEnabled = e.target.checked; F.commit(); }} /> Descuento por combinación activo</label>
        <div className="mt-3 flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="fl-check" checked={!!pr.volumeEnabled} onChange={(e) => { pr.volumeEnabled = e.target.checked; F.commit(); }} /> Descuento por volumen</label><TierInputs tiers={pr.volumeTiers} onSet={(i, val) => tier("volumeTiers", i, val)} /></div>
        <div className="mt-1 text-[11px] text-stone-500">Por cada unidad se aplica el descuento mayor entre la oferta paquete completo y el volumen; nunca se acumulan.</div>
        <div className="mt-2 flex flex-wrap items-center gap-3"><span className="text-xs text-stone-500">Capacidades del paquete:</span>{S.catalog.map((c: any) => <label key={c.id} className="flex items-center gap-1 text-xs"><input type="checkbox" className="fl-check" checked={pr.comboCapIds.includes(c.id)} onChange={(e) => { const ids = pr.comboCapIds; pr.comboCapIds = e.target.checked ? [...new Set([...ids, c.id])] : ids.filter((x: string) => x !== c.id); F.commit(); }} /> {c.name}</label>)}</div>
      </Card>
    </>
  );
}

const ENGINE_LABEL: Record<string, string> = { requests: "Horas y solicitudes", points: "Bolsa de puntos", buckets: "Recursos por tipo" };
function SetCaps() {
  const F = useFlipper(); const S = F.S; const ui = F.ui;
  const cap = capById(F, ui.capEditId);
  const create = () => {
    let name = ""; let price = "0"; let engine = "buckets";
    void F.openModal({
      title: "Nueva capacidad",
      body: () => (
        <div className="flex flex-col gap-3">
          <FieldL label="Nombre *"><input className="fl-in" autoFocus onChange={(e) => { name = e.target.value; }} /></FieldL>
          <FieldL label="Precio base mensual (COP)"><input className="fl-in num" inputMode="numeric" defaultValue="0" onChange={(e) => { price = e.target.value; }} /></FieldL>
          <FieldL label="Tipo de capacidad"><select className="fl-in" defaultValue="buckets" onChange={(e) => { engine = e.target.value; }}><option value="buckets">Recursos por tipo (cantidades por marca)</option><option value="points">Bolsa de puntos con catálogo de entregables</option><option value="requests">Bolsa de horas y solicitudes</option></select></FieldL>
        </div>
      ),
      footer: (close) => (<><Btn onClick={() => close()}>Cancelar</Btn><Btn kind="primary" onClick={() => {
        if (!name.trim()) { F.toast("El nombre es obligatorio.", "err"); return; }
        const id = E.uid("cap");
        const base: any = { id, code: name.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 10) || "CAP", name: name.trim(), tagline: "", description: "", price: parseMoney(price), unitLabel: "Unidad mensual", active: false, taxable: true, color: "#3578FF", icon: "box", engine, included: [], limits: [], exclusions: [], conditions: "", extras: [], custom: true };
        if (engine === "buckets") base.resources = [{ key: "units", label: "Entregables", short: "", perUnit: 1, allocatable: true }];
        if (engine === "points") { base.resources = [{ key: "points", label: "Puntos", short: "pts", perUnit: 10, allocatable: true }]; base.deliverables = [{ id: E.uid("d"), name: "Entregable", spec: "", points: 1 }]; }
        if (engine === "requests") { base.resources = [{ key: "hours", label: "Horas", short: "h", perUnit: 10, allocatable: true }, { key: "requests", label: "Solicitudes", short: "sol.", perUnit: 2, allocatable: true }]; base.workTypes = ["General"]; }
        S.catalog.push(base); S.costs[id] = E.emptyCost(); ui.capEditId = id; close(); F.commit(); F.toast("Capacidad creada como inactiva. Completa su configuración y actívala.", "ok");
      }}>Crear</Btn></>),
    });
  };
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
      <Card tight>
        <div className="fl-upper mb-2">Catálogo</div>
        {S.catalog.map((c: any) => (
          <button key={c.id} className={`fl-pick ${c.id === ui.capEditId ? "on" : ""}`} onClick={() => { ui.capEditId = c.id; F.rerender(); }}>
            <span className="fl-dot" style={{ background: c.color }} /><span className="min-w-0 grow text-left"><span className="block truncate font-semibold">{c.name}</span><span className="block text-[11px] text-stone-500">{money(c.price)} · {ENGINE_LABEL[c.engine]}</span></span>{!c.active && <Badge>Inactiva</Badge>}
          </button>
        ))}
        <Btn size="sm" icon="plus" className="mt-3" onClick={create}>Nueva capacidad</Btn>
      </Card>
      <div>{cap ? <CapEditor cap={cap} /> : <Card className="fl-empty"><Ic n="layers" size={28} /><div>Selecciona una capacidad para editar precios, entregables, puntos y límites.</div></Card>}</div>
    </div>
  );
}
function CapEditor({ cap }: { cap: any }) {
  const F = useFlipper(); const S = F.S;
  const set = (k: string, raw: string) => {
    let v: any = raw;
    if (k === "price") v = parseMoney(v);
    else if (["included", "limits", "exclusions", "workTypes"].includes(k)) { v = textToList(v); if (k === "workTypes" && !v.length) { F.toast("Debe existir al menos un tipo de trabajo.", "err"); F.rerender(); return; } }
    else if (k === "name" && !v.trim()) { F.toast("La capacidad necesita un nombre.", "err"); F.rerender(); return; }
    cap[k] = v; F.commit(); F.toast("Catálogo actualizado. Las cotizaciones guardadas no cambian.");
  };
  const f = (label: string, key: string, type: "text" | "area" | "money" | "color" = "text") => (
    <FieldL label={label}>{type === "area" ? <AreaIn value={Array.isArray(cap[key]) ? listToText(cap[key]) : cap[key] ?? ""} onCommit={(val) => set(key, val)} /> : type === "money" ? <MoneyIn value={cap[key]} onCommit={(val) => set(key, val)} /> : type === "color" ? <input type="color" className="fl-in h-[38px] p-1" value={cap[key]} onChange={(e) => set(key, e.target.value)} /> : <TextIn value={cap[key] ?? ""} onCommit={(val) => set(key, val)} />}</FieldL>
  );
  const resField = (i: number, k: string, val: any) => {
    const r = cap.resources[i];
    if (k === "allocatable") { if (!val && cap.resources.filter((x: any) => x.allocatable).length === 1) { F.toast("Debe existir al menos un recurso asignable.", "err"); F.rerender(); return; } r.allocatable = val; }
    else if (k === "adjustable") r.adjustable = val;
    else if (k === "perUnit") r.perUnit = parseIntSafe(val);
    else if (k === "refValue") r.refValue = parseMoney(val);
    else if (k === "hours") { const n = parseFloat(String(val).replace(",", ".")); r.hours = Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0; }
    else { if (!String(val).trim()) { F.rerender(); return; } r.label = String(val).trim(); }
    F.commit();
  };
  const sum = cap.resources.reduce((a: number, r: any) => a + E.nonNeg(r.perUnit) * E.nonNeg(r.refValue), 0);
  const hrs = Number(cap.fixedHours || 0) + cap.resources.reduce((a: number, r: any) => a + E.nonNeg(r.perUnit) * Number(r.hours || 0), 0);
  const del = async () => { if (!(await F.confirm("Eliminar capacidad", <p>Se eliminará «{cap.name}» del catálogo. Las cotizaciones guardadas conservan su copia.</p>, { ok: "Eliminar", danger: true }))) return; S.catalog = S.catalog.filter((c: any) => c.id !== cap.id); delete S.costs[cap.id]; F.ui.capEditId = null; F.commit(); };
  return (
    <>
      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3"><span className="fl-capicon" style={{ ["--c" as string]: cap.color }}><Ic n={cap.icon || "box"} size={20} /></span><div><h2 className="font-display text-lg font-semibold">{cap.name}</h2><div className="text-[11px] text-stone-500">ID {cap.id} · motor: {ENGINE_LABEL[cap.engine]?.toLowerCase()}</div></div></div>
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5"><input type="checkbox" className="fl-check" checked={!!cap.active} onChange={(e) => { cap.active = e.target.checked; F.commit(); }} /> Activa</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" className="fl-check" checked={cap.taxable !== false} onChange={(e) => { cap.taxable = e.target.checked; F.commit(); }} /> Gravada con IVA</label>
            {cap.custom && <Btn size="sm" kind="danger" icon="trash" title="Eliminar capacidad" onClick={del} />}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">{f("Nombre", "name")}{f("Código", "code")}{f("Color", "color", "color")}{f("Precio base mensual (COP, sin IVA)", "price", "money")}{f("Unidad de contratación", "unitLabel")}{f("Subtítulo", "tagline")}</div>
        <div className="mt-3">{f("Descripción", "description", "area")}</div>
      </Card>
      <Card className="mt-4">
        <CardHead title="Recursos por unidad" sub="Las unidades adicionales multiplican estos recursos. «Asignable» indica que se distribuye por marca.">
          {cap.engine === "buckets" && <Btn size="sm" icon="plus" onClick={() => { cap.resources.push({ key: `r${Date.now().toString(36)}`, label: "Nuevo recurso", short: "", perUnit: 1, allocatable: true }); F.commit(); }}>Recurso</Btn>}
        </CardHead>
        <div className="overflow-x-auto"><table className="fl-tbl compact">
          <thead><tr><th>Recurso</th><th className="text-right">Por unidad</th><th className="text-right">Valor de referencia</th><th className="text-right">Horas internas c/u</th><th className="text-center">Asignable</th><th className="text-center">Personalizable</th><th /></tr></thead>
          <tbody>{cap.resources.map((r: any, i: number) => (
            <tr key={r.key}>
              <td><TextIn className="sm" value={r.label} onCommit={(val) => resField(i, "label", val)} /></td>
              <td><TextIn className="sm num ml-auto" style={{ width: 80 }} value={r.perUnit} onCommit={(val) => resField(i, "perUnit", val)} /></td>
              <td><MoneyIn className="sm" value={r.refValue || 0} onCommit={(val) => resField(i, "refValue", val)} /></td>
              <td><TextIn className="sm num ml-auto" style={{ width: 70 }} value={pctText(r.hours || 0)} onCommit={(val) => resField(i, "hours", val)} /></td>
              <td className="text-center"><input type="checkbox" className="fl-check" checked={!!r.allocatable} disabled={cap.engine !== "buckets"} onChange={(e) => resField(i, "allocatable", e.target.checked)} /></td>
              <td className="text-center"><input type="checkbox" className="fl-check" checked={!!r.adjustable} onChange={(e) => resField(i, "adjustable", e.target.checked)} /></td>
              <td>{cap.engine === "buckets" && cap.resources.length > 1 && <Btn size="sm" kind="ghost" icon="trash" title="Eliminar recurso" onClick={async () => { if (!(await F.confirm("Eliminar recurso", <p>Se eliminará «{r.label}» del catálogo vigente. Las cotizaciones guardadas no cambian.</p>, { ok: "Eliminar", danger: true }))) return; cap.resources.splice(i, 1); cap.extras = (cap.extras || []).filter((x: any) => x.resourceKey !== r.key); if (!cap.resources.some((x: any) => x.allocatable)) cap.resources[0].allocatable = true; F.commit(); }} />}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <div className="mt-3 flex flex-wrap items-start gap-6">
          <FieldL label="Horas internas fijas por unidad" hint="Planeación, informes y reuniones." className="max-w-[220px]"><TextIn className="num" value={pctText(cap.fixedHours || 0)} onCommit={(val) => { const n = parseFloat(String(val).replace(",", ".")); cap.fixedHours = Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0; F.commit(); }} /></FieldL>
          <div className="text-xs">Suma de valores de referencia: <b className="tabular-nums" style={{ color: sum === cap.price ? "var(--fl-ok)" : "#b45309" }}>{money(sum)}</b> {sum === cap.price ? "= precio del paquete ✓" : `≠ precio ${money(cap.price)}: ajústalos para que el prorrateo sea exacto`}<br />Horas internas por unidad: <b style={{ color: hrs > S.settings.pricing.maxHoursPerUnit ? "var(--fl-err)" : undefined }}>{pctText(hrs)} h</b> de máximo {S.settings.pricing.maxHoursPerUnit} h</div>
        </div>
      </Card>
      {cap.engine === "points" && (
        <Card className="mt-4">
          <CardHead title="Catálogo de entregables y equivalencia en puntos" sub="Los puntos son una unidad comercial de consumo orientativa."><Btn size="sm" icon="plus" onClick={() => { cap.deliverables.push({ id: E.uid("d"), name: "Nuevo entregable", spec: "", points: 1 }); F.commit(); }}>Entregable</Btn></CardHead>
          <table className="fl-tbl compact"><thead><tr><th>Entregable</th><th>Especificación</th><th className="text-right">Puntos</th><th /></tr></thead>
            <tbody>{cap.deliverables.map((d: any) => (
              <tr key={d.id}>
                <td><TextIn className="sm" value={d.name} onCommit={(val) => { if (!val.trim()) { F.rerender(); return; } d.name = val; F.commit(); }} /></td>
                <td><TextIn className="sm" value={d.spec} onCommit={(val) => { d.spec = val; F.commit(); }} /></td>
                <td><TextIn className="sm num ml-auto" style={{ width: 80 }} value={d.points} onCommit={(val) => { d.points = parseIntSafe(val); F.commit(); }} /></td>
                <td><Btn size="sm" kind="ghost" icon="trash" title="Eliminar entregable" onClick={async () => { if (cap.deliverables.length === 1) { F.toast("Debe existir al menos un entregable.", "err"); return; } if (!(await F.confirm("Eliminar entregable", <p>Se retirará del catálogo vigente. Las cotizaciones guardadas conservan su copia.</p>, { ok: "Eliminar", danger: true }))) return; cap.deliverables = cap.deliverables.filter((x: any) => x.id !== d.id); F.commit(); }} /></td>
              </tr>
            ))}</tbody></table>
        </Card>
      )}
      {cap.engine === "requests" && <Card className="mt-4"><h3 className="text-[15px] font-semibold">Tipos de trabajo</h3><div className="mt-3">{f("Uno por línea", "workTypes", "area")}</div></Card>}
      <Card className="mt-4">
        <CardHead title="Ampliaciones con precio específico" sub="Bloques adicionales de recursos. Si no hay ninguno configurado, la herramienta muestra «Requiere cotización especial»."><Btn size="sm" icon="plus" onClick={() => { (cap.extras ||= []).push({ id: E.uid("x"), name: "Bloque adicional", resourceKey: cap.resources[0].key, amount: 1, price: 0 }); F.commit(); }}>Bloque</Btn></CardHead>
        {(cap.extras || []).length ? <table className="fl-tbl compact"><thead><tr><th>Nombre</th><th>Recurso</th><th className="text-right">Cantidad</th><th className="text-right">Precio (COP)</th><th /></tr></thead>
          <tbody>{cap.extras.map((x: any) => (
            <tr key={x.id}>
              <td><TextIn className="sm" value={x.name} onCommit={(val) => { x.name = val; F.commit(); }} /></td>
              <td><Sel className="sm" value={x.resourceKey} options={cap.resources.map((r: any) => [r.key, r.label] as [string, string])} onChange={(val) => { x.resourceKey = val; F.commit(); }} /></td>
              <td><TextIn className="sm num ml-auto" style={{ width: 80 }} value={x.amount} onCommit={(val) => { x.amount = parseIntSafe(val); F.commit(); }} /></td>
              <td><MoneyIn className="sm" value={x.price} onCommit={(val) => { x.price = parseMoney(val); F.commit(); }} /></td>
              <td><Btn size="sm" kind="ghost" icon="trash" title="Quitar bloque" onClick={() => { cap.extras = cap.extras.filter((y: any) => y.id !== x.id); F.commit(); }} /></td>
            </tr>
          ))}</tbody></table> : <div className="text-xs text-stone-500">Sin bloques configurados.</div>}
      </Card>
      <Card className="mt-4">
        <h3 className="text-[15px] font-semibold">Alcance, límites y condiciones</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">{f("Entregables incluidos (uno por línea)", "included", "area")}{f("Límites operativos", "limits", "area")}{f("Exclusiones", "exclusions", "area")}</div>
        <div className="mt-3">{f("Condiciones", "conditions", "area")}</div>
      </Card>
    </>
  );
}

function SetCosts() {
  const F = useFlipper(); const S = F.S;
  const keys: [string, string][] = [["direct", "Costo interno directo"], ["operating", "Costo operativo"], ["coordination", "Costo de coordinación"], ["other", "Sobrecosto (espacio, energía, licencias, IA)"]];
  const tgt = E.pctToBp(S.settings.marginTargetPct); const tol = E.pctToBp(S.settings.marginTolerancePct);
  return (
    <>
      <Alert kind="info">Valores mensuales por unidad de capacidad, en COP, que se suman al costo del perfil asignado en Equipo y costos. Deja vacío lo que no se haya calculado: la herramienta mostrará «Rentabilidad pendiente de configuración» en lugar de usar costos ficticios. Estos datos nunca se incluyen en propuestas exportadas.</Alert>
      <Card className="mt-4 !p-0"><div className="overflow-x-auto"><table className="fl-tbl">
        <thead><tr><th>Capacidad</th>{keys.map(([, l]) => <th key={l} className="text-right">{l}</th>)}<th className="text-right">Horas contratadas</th><th className="text-right">Horas productivas</th><th className="text-right">Costo / unidad</th><th className="text-right">Margen a precio base</th></tr></thead>
        <tbody>{S.catalog.map((cap: any) => {
          const c = (S.costs[cap.id] ||= E.emptyCost()); const conf = E.costConfigured(c); const tot = keys.reduce((a, [k]) => a + E.nonNeg(c[k]), 0);
          const bp = cap.price ? Math.round(((cap.price - tot) * 10000) / cap.price) : 0;
          const inp = (k: string, w: number) => <TextIn className="sm num ml-auto" style={{ width: w }} inputMode="numeric" placeholder="—" value={c[k] === null || c[k] === undefined || c[k] === "" ? "" : fmtNum(c[k])} onCommit={(val) => { c[k] = val.trim() === "" ? null : parseMoney(val); F.commit(); }} />;
          return (
            <tr key={cap.id}>
              <td><div className="font-semibold">{cap.name}</div><div className="text-[11px] text-stone-500">Precio {money(cap.price)}</div></td>
              {keys.map(([k]) => <td key={k}>{inp(k, 120)}</td>)}
              <td>{inp("hoursContracted", 80)}</td>
              <td>{inp("hoursProductive", 80)}{c.hoursContracted && c.hoursProductive ? <div className="text-right text-[11px] text-stone-500">{Math.round((c.hoursProductive * 100) / c.hoursContracted)}% productivo</div> : null}</td>
              <td className="text-right font-semibold tabular-nums">{conf ? money(tot) : "—"}</td>
              <td className="text-right">{conf ? <MarginBadge bp={bp} status={bp < tgt - tol ? "below" : bp > tgt + tol ? "above" : "within"} /> : <span className="text-[11px] text-stone-500">Pendiente</span>}</td>
            </tr>
          );
        })}</tbody>
      </table></div></Card>
    </>
  );
}

function SetSupp() {
  const F = useFlipper(); const S = F.S;
  return (
    <Card>
      <CardHead title="Plantillas de suplementos" sub="Se ofrecen en el cotizador para casos de mayor complejidad operativa. Inicialmente en $0; siempre requieren aprobación manual en cada cotización.">
        <Btn size="sm" icon="plus" onClick={() => { S.settings.supplementTemplates.push({ id: E.uid("st"), name: "Nuevo suplemento", description: "", value: 0, periodicity: "Mensual" }); F.commit(); }}>Plantilla</Btn>
      </CardHead>
      <div className="overflow-x-auto"><table className="fl-tbl compact">
        <thead><tr><th>Nombre</th><th>Descripción</th><th className="text-right">Valor sugerido</th><th>Periodicidad</th><th /></tr></thead>
        <tbody>{S.settings.supplementTemplates.map((s: any) => (
          <tr key={s.id}>
            <td><TextIn className="sm" value={s.name} onCommit={(val) => { s.name = val; F.commit(); }} /></td>
            <td><TextIn className="sm" value={s.description} onCommit={(val) => { s.description = val; F.commit(); }} /></td>
            <td><MoneyIn className="sm" value={s.value} onCommit={(val) => { s.value = parseMoney(val); F.commit(); }} /></td>
            <td><Sel className="sm" value={s.periodicity} options={["Mensual", "Único"]} onChange={(val) => { s.periodicity = val; F.commit(); }} /></td>
            <td><Btn size="sm" kind="ghost" icon="trash" title="Quitar plantilla" onClick={() => { S.settings.supplementTemplates = S.settings.supplementTemplates.filter((x: any) => x.id !== s.id); F.commit(); }} /></td>
          </tr>
        ))}</tbody>
      </table></div>
    </Card>
  );
}

function SetConds() {
  const F = useFlipper(); const S = F.S;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h3 className="text-[15px] font-semibold">Condiciones comerciales</h3><p className="text-xs text-stone-500">Una por línea. Se copian a cada nueva cotización.</p><AreaIn className="mt-3" style={{ minHeight: 260 }} value={listToText(S.settings.conditions)} onCommit={(val) => { S.settings.conditions = textToList(val); F.commit(); F.toast("Condiciones actualizadas para nuevas cotizaciones."); }} /></Card>
      <Card><h3 className="text-[15px] font-semibold">Indicadores sugeridos (Marketing &amp; Performance)</h3><p className="text-xs text-stone-500">Uno por línea. Se presentan como campos de seguimiento, nunca como resultados garantizados.</p><AreaIn className="mt-3" style={{ minHeight: 260 }} value={listToText(S.settings.kpiCatalog)} onCommit={(val) => { S.settings.kpiCatalog = textToList(val); F.commit(); }} /></Card>
    </div>
  );
}

function SetData() {
  const F = useFlipper(); const S = F.S;
  const exportJson = () => { download(`Flipper_respaldo_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(E.backupPayload({ ...S, draft: null }), null, 2)); F.toast("Respaldo exportado.", "ok"); };
  const importJson = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = async () => {
      let obj: any;
      try { obj = JSON.parse(String(r.result)); } catch { F.info("Archivo inválido", <p>El archivo no es un JSON válido. No se modificó ningún dato.</p>); return; }
      const errs = E.validateBackup(obj);
      if (errs.length) { F.info("Respaldo no válido", <><p>No se modificó ningún dato. Problemas encontrados:</p><ul className="ml-5 list-disc">{errs.map((x: string) => <li key={x}>{x}</li>)}</ul></>); return; }
      const ok = await F.confirm("Importar respaldo", <>
        <p>El respaldo contiene <b>{obj.clients.length}</b> cliente(s), <b>{obj.quotes.length}</b> cotización(es) y <b>{obj.catalog.length}</b> capacidad(es){obj.exportedAt ? `, exportado el ${obj.exportedAt.slice(0, 10)}` : ""}.</p>
        <Alert kind="warn">Reemplazará todos los datos de Flipper de esta empresa ({S.clients.length} clientes, {S.quotes.length} cotizaciones) para todos los usuarios. Exporta un respaldo antes si lo necesitas.</Alert>
      </>, { ok: "Reemplazar datos", danger: true });
      if (!ok) return;
      const n = E.normalizeState(obj); delete n._migrated;
      Object.keys(S).forEach((k) => { delete S[k]; }); Object.assign(S, n);
      F.ui.clientId = null; F.ui.compare = []; F.ui.compareGroup = null;
      F.commit(); F.toast("Respaldo importado correctamente.", "ok");
    };
    r.readAsText(file);
  };
  const restore = async () => {
    if (!(await F.confirm("Restaurar tarifas predeterminadas", <p>Las cuatro capacidades iniciales volverán a sus precios, recursos, entregables y condiciones originales. Las capacidades creadas se conservan. Las cotizaciones guardadas no cambian.</p>, { ok: "Restaurar", danger: true }))) return;
    const defs = E.defaultCatalog(); S.catalog = [...defs, ...S.catalog.filter((c: any) => !defs.some((d: any) => d.id === c.id))]; F.commit(); F.toast("Tarifas restauradas.", "ok");
  };
  return (
    <>
      <Alert kind="info"><b>Datos en la nube de Workezt.</b> Clientes, cotizaciones y configuración de Flipper se guardan solos en la base de datos de la empresa y los comparten todos los usuarios con acceso. La cotización en curso es personal de cada usuario.</Alert>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card><h3 className="text-[15px] font-semibold">Exportar respaldo</h3><p className="mt-1 text-xs text-stone-500">Clientes, marcas, cotizaciones, escenarios y configuración en un archivo JSON. Incluye costos internos <b>sin cifrar</b>: es un archivo de uso interno. No incluye usuarios ni contraseñas.</p><Btn kind="primary" icon="download" className="mt-3" onClick={exportJson}>Exportar JSON</Btn></Card>
        <Card><h3 className="text-[15px] font-semibold">Importar respaldo</h3><p className="mt-1 text-xs text-stone-500">Acepta respaldos de OR-K Flipper (archivo HTML independiente). Se valida la estructura antes de modificar los datos y se pide confirmación antes de reemplazar.</p><label className="fl-btn mt-3 cursor-pointer"><Ic n="upload" size={15} /> Seleccionar archivo JSON<input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = ""; }} /></label></Card>
        <Card><h3 className="text-[15px] font-semibold">Restaurar</h3><p className="mt-1 text-xs text-stone-500">Restablece las tarifas y el catálogo inicial (las capacidades nuevas se conservan). Las cotizaciones guardadas no cambian.</p><Btn className="mt-3" onClick={restore}>Restaurar tarifas predeterminadas</Btn></Card>
      </div>
      <Card className="mt-4"><h3 className="text-[15px] font-semibold">Modo presentación</h3><p className="mt-1 text-xs text-stone-500">El modo presentación oculta información interna en pantalla, pero no es una barrera de seguridad. Para compartir con clientes usa «Exportar HTML para cliente» o la impresión en PDF, que no contienen datos internos. Los usuarios sin el permiso «Ver costos, márgenes y configuración de Flipper» nunca reciben esos datos desde el servidor.</p></Card>
    </>
  );
}
