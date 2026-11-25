"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/immutability -- Flipper muta su estado (F.S, F.ui) y luego llama a commit(), igual que el original; no hay React Compiler. */
import { useState } from "react";
import { E } from "@/lib/apps/flipper/engine";
import { useFlipper, type View } from "./store";
import { Alert, AppTile, Badge, Btn, Card, CardHead, Ic, Internal, PageHead, StatusBadge, TextIn, fmtNum, initials, money } from "./kit";
import { addBrand, clientModal, deleteBrand, loadDemo, openQuoteInEditor, renameBrand, startQuote, toggleBrandActive, addLineToDraft, activeClient, touch, brandFootprint, purgeBrandFromQuote } from "./ops";

/* =====================================================================
   INICIO · tablero de aplicaciones de Flipper
   ===================================================================== */
export const APPS: { v: View; l: string; i: string; g: [string, string]; internal?: boolean; admin?: boolean }[] = [
  { v: "quoter", l: "Cotizador", i: "calc", g: ["#B37BFF", "#6815D5"] },
  { v: "clients", l: "Clientes y marcas", i: "users", g: ["#FFB067", "#EA580C"] },
  { v: "catalog", l: "Capacidades", i: "layers", g: ["#3FD1C2", "#0F766E"] },
  { v: "quotes", l: "Cotizaciones", i: "file", g: ["#5EA0FF", "#1D4ED8"] },
  { v: "scenarios", l: "Escenarios", i: "compare", g: ["#FF6FB5", "#BE185D"] },
  { v: "kpis", l: "Indicadores", i: "chart", g: ["#4ADE80", "#047857"], internal: true },
  { v: "profit", l: "Rentabilidad", i: "pie", g: ["#7C83F0", "#3730A3"], internal: true, admin: true },
  { v: "team", l: "Equipo y costos", i: "team", g: ["#8E97A8", "#475063"], internal: true, admin: true },
  { v: "settings", l: "Configuración", i: "sliders", g: ["#A3AAB8", "#5B6372"], internal: true, admin: true },
];

export function DashboardView() {
  const F = useFlipper(); const S = F.S;
  const [term, setTerm] = useState("");
  const apps = APPS.filter((x) => (!x.internal || F.isInternal) && (!x.admin || F.isAdmin)).filter((x) => !term.trim() || x.l.toLowerCase().includes(term.trim().toLowerCase()));
  const badge = (v: View) => v === "quoter" ? (S.draft ? (S.draft._dirty ? "•" : "1") : "") : v === "quotes" && S.quotes.length ? String(S.quotes.length) : "";
  return (
    <>
      <section className="fl-banner mb-8">
        <span className="ring" />
        <div className="relative z-[1]">
          <div className="fl-upper mb-2 text-white/70">Workezt · Comercial</div>
          <h1 className="font-display text-4xl font-semibold text-white sm:text-5xl">OR-K <span className="neon">Flipper</span></h1>
          <p className="mt-2 text-white/75">Capacidades empresariales móviles y flexibles</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="fl-btn primary" onClick={() => (S.draft ? F.go("quoter") : startQuote(F))}><Ic n="spark" size={15} />{S.draft ? "Continuar cotización" : "Crear cotización"}</button>
            <button className="fl-btn glass" onClick={() => F.go("quotes")}>Ver cotizaciones</button>
          </div>
        </div>
      </section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-[var(--ork-ink)]">Aplicaciones</h2>
        <label className="fl-search w-full max-w-xs"><Ic n="search" size={15} /><input className="fl-in" placeholder="Buscar aplicación…" value={term} onChange={(e) => setTerm(e.target.value)} /></label>
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-5 lg:grid-cols-7">
        {apps.map((x) => (
          <button key={x.v} className="fl-app" onClick={() => (x.v === "quoter" && !S.draft ? startQuote(F) : F.go(x.v))}>
            <AppTile icon={x.i} g={x.g} size={72} badge={badge(x.v)} />
            <span className="mt-2 text-[13px] font-medium text-[var(--ork-ink)]">{x.l}</span>
            {x.internal && <span className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-400"><Ic n="lock" size={10} /> Interno</span>}
          </button>
        ))}
        {!apps.length && <div className="col-span-full text-sm text-stone-500">Ninguna aplicación coincide con «{term}».</div>}
      </div>
    </>
  );
}

/* =====================================================================
   INDICADORES
   ===================================================================== */
export function KpisView() {
  const F = useFlipper(); const S = F.S;
  const qs = S.quotes.map((q: any) => ({ q, st: E.effectiveStatus(q), t: E.computeTotals(q) }));
  const approved = qs.filter((x: any) => x.st === "Aprobada");
  const approvedValue = approved.reduce((a: number, x: any) => a + x.t.net, 0);
  const capUnits: Record<string, number> = {};
  qs.filter((x: any) => !["Rechazada", "Vencida"].includes(x.st)).forEach((x: any) => x.q.lines.forEach((l: any) => { const c = E.capOf(x.q, l); capUnits[c.name] = (capUnits[c.name] || 0) + l.qty; }));
  const max = Math.max(1, ...Object.values(capUnits));
  if (!F.isInternal) return <Alert kind="info">Indicadores está oculto en modo presentación.</Alert>;
  return (
    <>
      <PageHead kicker={<Internal />} title="Indicadores" sub="Calculados con las cotizaciones guardadas. Son valores cotizados, no facturación." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {([["Clientes registrados", fmtNum(S.clients.length)], ["Cotizaciones creadas", fmtNum(S.quotes.length)], ["Cotizaciones aprobadas", fmtNum(approved.length)], ["Valor mensual aprobado", money(approvedValue), "Antes de IVA · valor cotizado, no facturación"], ["Unidades de capacidad cotizadas", fmtNum(Object.values(capUnits).reduce((a, b) => a + b, 0)), "Excluye rechazadas y vencidas"]] as [string, string, string?][]).map(([l, v, n]) => (
          <Card key={l} tight><div className="text-xs text-stone-500">{l}</div><div className="mt-1 font-display text-2xl font-semibold tabular-nums">{v}</div>{n && <div className="mt-1 text-[11px] text-stone-400">{n}</div>}</Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="Cotizaciones recientes"><Btn size="sm" kind="ghost" onClick={() => F.go("quotes")}>Ver todas <Ic n="arrowR" size={13} /></Btn></CardHead>
          {qs.length ? (
            <table className="fl-tbl compact"><tbody>{qs.slice(0, 6).map((x: any) => (
              <tr key={x.q.id} className="cursor-pointer hover:bg-stone-50" onClick={() => openQuoteInEditor(F, x.q.id, 4)}>
                <td><div className="font-semibold">{x.q.number}</div><div className="text-[11px] text-stone-500">{x.q.client.name} · {x.q.scenarioName || ""}</div></td>
                <td><StatusBadge st={x.st} /></td><td className="text-right font-semibold tabular-nums">{money(x.t.net)}</td>
              </tr>))}</tbody></table>
          ) : <div className="fl-empty"><Ic n="file" size={28} /><div>Aún no hay cotizaciones guardadas.</div></div>}
        </Card>
        <Card>
          <CardHead title="Capacidad comercial cotizada" sub="Unidades en cotizaciones vigentes" />
          {Object.keys(capUnits).length ? Object.entries(capUnits).map(([n, u]) => {
            const cap = S.catalog.find((c: any) => c.name === n);
            return (
              <div key={n} className="fl-res mb-3">
                <div className="flex justify-between text-xs"><span className="font-medium">{n}</span><span>{u} unid.</span></div>
                <div className="fl-bar"><i style={{ width: `${Math.round((u * 100) / max)}%`, background: cap?.color }} /></div>
              </div>
            );
          }) : <div className="fl-empty"><Ic n="chart" size={28} /><div>Los indicadores se calculan con cotizaciones reales guardadas.</div></div>}
        </Card>
      </div>
    </>
  );
}

/* =====================================================================
   CLIENTES Y MARCAS
   ===================================================================== */
export function ClientsView() {
  const F = useFlipper(); const S = F.S; const ui = F.ui;
  const [term, setTerm] = useState(ui.clientSearch || "");
  const t = term.trim().toLowerCase();
  const list = S.clients.filter((c: any) => !t || [c.name, c.legalName, c.contact, c.email, ...c.brands.map((b: any) => b.name)].join(" ").toLowerCase().includes(t));
  if (!ui.clientId || !S.clients.some((c: any) => c.id === ui.clientId)) ui.clientId = S.activeClientId && S.clients.some((c: any) => c.id === S.activeClientId) ? S.activeClientId : S.clients[0]?.id || null;
  const c = S.clients.find((x: any) => x.id === ui.clientId);
  return (
    <>
      <PageHead title="Clientes y marcas" sub="Cada cliente puede tener una o múltiples marcas, divisiones o unidades de negocio.">
        <Btn icon="star" onClick={() => loadDemo(F)}>Cargar demostración Flipper Beta</Btn>
        <Btn kind="primary" icon="plus" onClick={() => clientModal(F)}>Crear nuevo cliente</Btn>
      </PageHead>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <Card tight>
          <label className="fl-search mb-2"><Ic n="search" size={15} /><input className="fl-in" placeholder="Buscar cliente o marca" value={term} onChange={(e) => { setTerm(e.target.value); ui.clientSearch = e.target.value; }} /></label>
          <div className="flex flex-col gap-1">
            {list.length ? list.map((x: any) => (
              <button key={x.id} className={`fl-pick ${x.id === ui.clientId ? "on" : ""}`} onClick={() => { ui.clientId = x.id; F.rerender(); }}>
                <span className="fl-avatar">{initials(x.name)}</span>
                <span className="min-w-0 grow text-left"><span className="block truncate font-semibold">{x.name}</span><span className="block truncate text-[11px] text-stone-500">{x.brands.length} marca(s){x.legalName ? ` · ${x.legalName}` : ""}</span></span>
                {x.id === S.activeClientId && <Badge tone="v">Activo</Badge>}
              </button>
            )) : <div className="py-4 text-center text-xs text-stone-500">{S.clients.length ? "Sin resultados." : "Sin clientes registrados."}</div>}
          </div>
        </Card>
        <div>{c ? <ClientDetail c={c} /> : <Card className="fl-empty"><Ic n="users" size={28} /><div>Crea un cliente o carga la demostración Flipper Beta para comenzar.</div></Card>}</div>
      </div>
    </>
  );
}

function ClientDetail({ c }: { c: any }) {
  const F = useFlipper(); const S = F.S;
  const quotes = S.quotes.filter((q: any) => q.clientId === c.id);
  const dup = () => {
    const n = E.newClient({ ...c, name: `${c.name} (copia)`, brands: c.brands.map((b: any) => b.name) });
    n.brands.forEach((b: any, i: number) => { b.active = c.brands[i].active; });
    S.clients.push(n); F.ui.clientId = n.id; F.commit(); F.toast("Cliente duplicado con sus marcas.", "ok");
  };
  const del = async () => {
    const n = S.quotes.filter((q: any) => q.clientId === c.id).length; const draftHit = S.draft?.clientId === c.id;
    const ok = await F.confirm("Eliminar cliente", <>
      <p>Se eliminará <b>{c.name}</b> y sus {c.brands.length} marca(s).</p>
      {n > 0 && <p className="text-xs text-stone-500">{n} cotización(es) guardada(s) conservarán su copia histórica del cliente.</p>}
      {draftHit && <Alert kind="warn">La cotización en curso de este cliente se descartará.</Alert>}
    </>, { ok: "Eliminar cliente", danger: true });
    if (!ok) return;
    S.clients = S.clients.filter((x: any) => x.id !== c.id); if (S.activeClientId === c.id) S.activeClientId = null; if (draftHit) S.draft = null; F.ui.clientId = null;
    F.commit(); F.toast("Cliente eliminado.");
  };
  return (
    <>
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3"><span className="fl-avatar lg">{initials(c.name)}</span><div><h2 className="font-display text-xl font-semibold">{c.name}</h2><div className="text-xs text-stone-500">{c.legalName || "Sin razón social registrada"} · ID {c.id.slice(-8)}</div></div></div>
          <div className="flex flex-wrap gap-1.5">
            {c.id !== S.activeClientId ? <Btn size="sm" icon="check" onClick={() => { S.activeClientId = c.id; F.commit(); }}>Seleccionar como activo</Btn> : <Badge tone="v">Cliente activo</Badge>}
            <Btn size="sm" icon="edit" onClick={() => clientModal(F, c)}>Editar</Btn>
            <Btn size="sm" icon="copy" onClick={dup}>Duplicar</Btn>
            <Btn size="sm" kind="danger" icon="trash" title="Eliminar cliente" onClick={del} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[["Contacto", c.contact], ["Correo", c.email], ["Teléfono", c.phone], ["Marcas", c.brands.length]].map(([l, v]) => <div key={l}><div className="fl-upper">{l}</div><div className="mt-1 break-words">{v === "" || v === undefined ? "—" : v}</div></div>)}
        </div>
        {c.notes && F.isInternal && <div className="mt-3 text-sm"><div className="fl-upper">Observaciones comerciales</div><div className="mt-1">{c.notes}</div></div>}
        <div className="mt-4"><Btn kind="primary" icon="spark" onClick={() => { S.activeClientId = c.id; void startQuote(F, c.id); }}>Crear cotización</Btn></div>
      </Card>
      <Card className="mt-4">
        <CardHead title="Marcas" sub="Edita el nombre directamente. Las marcas inactivas no se ofrecen para nuevas propuestas." />
        <BrandsEditor c={c} />
      </Card>
      <Card className="mt-4">
        <CardHead title="Cotizaciones del cliente" />
        {quotes.length ? <table className="fl-tbl compact"><tbody>{quotes.map((q: any) => (
          <tr key={q.id}><td><div className="font-semibold">{q.number}</div><div className="text-[11px] text-stone-500">{q.name}</div></td><td><StatusBadge st={E.effectiveStatus(q)} /></td><td className="text-right tabular-nums">{money(E.computeTotals(q).net)}</td><td className="text-right"><Btn size="sm" onClick={() => openQuoteInEditor(F, q.id, 4)}>Abrir</Btn></td></tr>
        ))}</tbody></table> : <div className="text-xs text-stone-500">Sin cotizaciones.</div>}
      </Card>
    </>
  );
}

export function BrandsEditor({ c, draftMode }: { c: any; draftMode?: boolean }) {
  const F = useFlipper(); const q = F.S.draft;
  const [nb, setNb] = useState("");
  const add = () => { if (addBrand(F, c.id, nb)) { setNb(""); F.toast("Marca agregada.", "ok"); } };
  const toggleDraft = async (b: any, checked: boolean) => {
    if (checked) { if (!q.brandIds.includes(b.id)) q.brandIds.push(b.id); touch(F); F.commit(); return; }
    const fp = brandFootprint(q, b.id);
    if (fp.length && !(await F.confirm("Retirar marca de la propuesta", <><p>Al retirar <b>{b.name}</b> de la propuesta se eliminarán sus recursos asignados:</p><ul className="ml-5 list-disc">{fp.map((x, i) => <li key={i}>{x}</li>)}</ul></>, { ok: "Retirar marca y recursos", danger: true }))) { F.rerender(); return; }
    purgeBrandFromQuote(q, b.id); touch(F); F.commit();
  };
  return (
    <div className="flex flex-col gap-1.5">
      {c.brands.map((b: any, i: number) => {
        const inQ = draftMode && q.brandIds.includes(b.id);
        return (
          <div key={b.id} className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${inQ ? "border-[var(--ork-violet)]/40 bg-[var(--ork-violet)]/5" : "border-stone-200"} ${b.active ? "" : "opacity-60"}`}>
            {draftMode ? <input type="checkbox" className="fl-check" checked={!!inQ} disabled={!b.active} onChange={(e) => toggleDraft(b, e.target.checked)} aria-label={`Incluir ${b.name}`} /> : <span className="w-5 text-right text-[11px] text-stone-400">{i + 1}</span>}
            <TextIn className="sm grow" value={b.name} onCommit={(v) => renameBrand(F, c.id, b.id, v)} ariaLabel="Nombre de la marca" />
            {draftMode ? (!b.active && <Badge>Inactiva</Badge>) : <label className="flex items-center gap-1 text-xs"><input type="checkbox" className="fl-check" checked={b.active} onChange={() => toggleBrandActive(F, c.id, b.id)} /> Activa</label>}
            <Btn size="sm" kind="ghost" icon="trash" title="Eliminar marca" onClick={() => deleteBrand(F, c.id, b.id)} className="text-rose-600" />
          </div>
        );
      })}
      {!c.brands.length && <div className="text-xs text-stone-500">Sin marcas todavía.</div>}
      <div className="mt-2 flex gap-2">
        <input className="fl-in grow" placeholder={draftMode ? "Agregar una marca" : "Nombre de la nueva marca"} value={nb} onChange={(e) => setNb(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Btn icon="plus" onClick={add}>{draftMode ? "Agregar" : "Agregar marca"}</Btn>
      </div>
    </div>
  );
}

/* =====================================================================
   CATÁLOGO DE CAPACIDADES
   ===================================================================== */
export const capResources = (cap: any, qty = 1) => cap.resources.map((r: any) => <Badge key={r.key} tone="v">{fmtNum(r.perUnit * qty)} {r.label.toLowerCase()}</Badge>);
const UL = ({ items }: { items: string[] }) => <ul className="ml-4 list-disc space-y-0.5 text-[13px]">{items.map((x) => <li key={x}>{x}</li>)}</ul>;

export function CatalogView() {
  const F = useFlipper(); const S = F.S; const pr = S.settings.pricing;
  const quote = (capId: string, mode: "shared" | "exclusive") => {
    if (!S.draft) { S.draft = E.newQuote(S, activeClient(F) || null); S.draft._dirty = false; }
    if (!S.draft.client || !S.draft.brandIds.length) { F.ui.step = 1; F.commit(); F.go("quoter"); F.toast("Primero elige el cliente y sus marcas; luego agrega la capacidad.", "err"); return; }
    addLineToDraft(F, capId, mode); F.ui.step = 2; F.go("quoter");
  };
  return (
    <>
      <PageHead title="Catálogo de capacidades" sub="Capacidades empresariales modulares. Valores mensuales en COP antes de IVA.">
        {F.isAdmin && <Btn icon="edit" onClick={() => F.go("settings", { adminTab: "caps" })}>Administrar catálogo</Btn>}
        <Btn kind="primary" icon="spark" onClick={() => startQuote(F)}>Crear cotización</Btn>
      </PageHead>
      {pr.comboEnabled && (
        <div className="mb-4"><Alert kind="ok" icon="star"><b>Entre más capacidades combines, mayor el descuento:</b>{" "}
          {(pr.comboTiers || []).map((p: number, i: number) => ({ n: i + 1, p })).filter((x: any) => x.n >= 2).map((x: any) => `${x.n === pr.comboCapIds.length ? "paquete completo" : `${x.n} capacidades`} −${x.p}%`).join(" · ")}. Aplica a capacidades sin personalizar.</Alert></div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {S.catalog.map((cap: any) => (
          <div key={cap.id} className="fl-card fl-capcard" style={{ ["--c" as string]: cap.color, opacity: cap.active ? 1 : 0.55 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3"><span className="fl-capicon"><Ic n={cap.icon || "box"} size={20} /></span><div><div className="fl-code">{cap.code}</div><h2 className="font-display text-lg font-semibold">{cap.name}</h2><div className="text-xs text-stone-500">{cap.tagline}</div></div></div>
              <div className="text-right"><div className="font-display text-xl font-semibold tabular-nums">{money(cap.price)}</div><div className="text-[11px] text-stone-500">{cap.unitLabel} + IVA</div>{!cap.active && <Badge tone="warn">Inactiva</Badge>}</div>
            </div>
            <p className="text-sm">{cap.description}</p>
            <div className="flex flex-wrap gap-1.5">{capResources(cap)}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><div className="fl-upper mb-1.5">Incluye</div><UL items={cap.included} /></div>
              <div><div className="fl-upper mb-1.5">Límites operativos</div><UL items={cap.limits} /><div className="fl-upper mb-1.5 mt-3">No incluye</div><UL items={cap.exclusions} /></div>
            </div>
            {cap.engine === "requests" && <div><div className="fl-upper mb-1.5">Tipos de trabajo</div><div className="flex flex-wrap gap-1">{cap.workTypes.map((w: string) => <Badge key={w}>{w}</Badge>)}</div></div>}
            {cap.engine === "points" && <table className="fl-tbl compact"><thead><tr><th>Entregable</th><th>Especificación</th><th className="text-right">Puntos</th></tr></thead><tbody>{cap.deliverables.map((d: any) => <tr key={d.id}><td>{d.name}</td><td className="text-stone-500">{d.spec}</td><td className="text-right font-semibold">{d.points}</td></tr>)}</tbody></table>}
            {cap.conditions && <div className="text-xs text-stone-500">{cap.conditions}</div>}
            {cap.resources.some((r: any) => r.adjustable) && <div className="text-xs"><span className="fl-upper">Personalizable:</span> se pueden quitar elementos (se descuenta el {100 - pr.removalPenaltyPct}% de su valor) o agregar elementos (valor + {pr.additionSurchargePct}%). Valores de referencia: {cap.resources.filter((r: any) => r.adjustable && r.refValue).map((r: any) => `${r.short || r.label} ${money(r.refValue)}`).join(" · ")}.</div>}
            <div className="text-xs"><span className="fl-upper">Ampliaciones:</span> agregar unidades completas{cap.extras?.length ? ` o bloques: ${cap.extras.map((x: any) => `${x.name} (${x.price ? money(x.price) : "requiere cotización especial"})`).join(", ")}` : <> · bloques adicionales: <b>requiere cotización especial</b></>}</div>
            {cap.active && F.perms.write && <div className="flex flex-wrap gap-2 pt-1"><Btn size="sm" icon="plus" onClick={() => quote(cap.id, "shared")}>Cotizar compartida</Btn><Btn size="sm" icon="plus" onClick={() => quote(cap.id, "exclusive")}>Cotizar exclusiva</Btn></div>}
          </div>
        ))}
      </div>
    </>
  );
}
