"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/immutability -- Flipper muta su estado (F.S, F.ui) y luego llama a commit(), igual que el original; no hay React Compiler. */
import { useState } from "react";
import { E, P } from "@/lib/apps/flipper/engine";
import type { Flipper } from "./store";
import { Alert, Btn, Ic, brandName, fmtNum, money } from "./kit";

/** Operaciones de dominio de Flipper (marcas, borrador, guardado y control de capacidad). */

export const client = (F: Flipper, id: string | null | undefined) => F.S.clients.find((c: any) => c.id === id);
export const activeClient = (F: Flipper) => client(F, F.S.activeClientId);
export const capById = (F: Flipper, id: string) => F.S.catalog.find((c: any) => c.id === id);
export const lineByUid = (F: Flipper, uid: string) => F.S.draft?.lines.find((l: any) => l.uid === uid);
export const touch = (F: Flipper) => { if (F.S.draft) { F.S.draft._dirty = true; F.S.draft.updatedAt = new Date().toISOString(); } };
const List = ({ items }: { items: React.ReactNode[] }) => <ul className="ml-5 list-disc space-y-0.5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;

/* ---------- marcas ---------- */
export function brandFootprint(q: any, brandId: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  if (!q) return out;
  q.lines.forEach((l: any) => {
    const cap = E.capOf(q, l); const desc = E.describeUsage(q, l, brandId);
    if (desc.length) out.push(<><b>{cap.name}:</b> {desc.join("; ")}</>);
    else if (l.brandIds.includes(brandId) && l.mode === "exclusive") out.push(<><b>{cap.name}:</b> capacidad exclusiva de esta marca (la línea quedará sin beneficiaria)</>);
  });
  const ad = q.adBudget[brandId];
  if (ad && (ad.meta || ad.google || ad.other)) out.push(<><b>Pauta:</b> {money((ad.meta || 0) + (ad.google || 0) + (ad.other || 0))} de presupuesto publicitario</>);
  return out;
}
export function purgeBrandFromQuote(q: any, brandId: string, { keepParticipation = false } = {}) {
  if (!keepParticipation) q.brandIds = q.brandIds.filter((b: string) => b !== brandId);
  q.lines.forEach((l: any) => {
    l.brandIds = l.brandIds.filter((b: string) => b !== brandId);
    l.items = l.items.filter((i: any) => i.brandId !== brandId);
    l.requests = l.requests.filter((r: any) => r.brandId !== brandId);
    delete l.alloc[brandId]; delete l.manualShares[brandId];
  });
  delete q.adBudget[brandId];
}
export function syncDraftClient(F: Flipper, c: any) {
  const q = F.S.draft; if (!q || q.clientId !== c.id) return;
  q.client = E.snapshotClient(c);
  q.brandIds = q.brandIds.filter((b: string) => c.brands.some((x: any) => x.id === b));
}
export async function deleteBrand(F: Flipper, clientId: string, brandId: string) {
  const S = F.S; const c = client(F, clientId); const b = c?.brands.find((x: any) => x.id === brandId); if (!b) return;
  const fp = S.draft && S.draft.clientId === clientId ? brandFootprint(S.draft, brandId) : [];
  const saved = S.quotes.filter((q: any) => q.clientId === clientId && q.brandIds.includes(brandId)).length;
  const ok = await F.confirm("Eliminar marca", <>
    <p>Se eliminará la marca <b>{b.name}</b> del cliente {c.name}.</p>
    {fp.length > 0 && <Alert kind="warn">La cotización en curso tiene recursos asignados a esta marca. Al confirmar se retirarán:<List items={fp} /></Alert>}
    {saved > 0 && <p className="text-xs text-stone-500">{saved} cotización(es) guardada(s) incluyen esta marca y conservarán su copia histórica sin cambios.</p>}
  </>, { ok: fp.length ? "Eliminar y retirar recursos" : "Eliminar marca", danger: true });
  if (!ok) return;
  c.brands = c.brands.filter((x: any) => x.id !== brandId);
  if (S.draft && S.draft.clientId === clientId) { purgeBrandFromQuote(S.draft, brandId); syncDraftClient(F, c); touch(F); }
  F.commit(); F.toast("Marca eliminada.");
}
export function addBrand(F: Flipper, clientId: string, nameRaw: string) {
  const S = F.S; const c = client(F, clientId); const name = String(nameRaw || "").trim();
  if (!name) { F.toast("La marca necesita un nombre.", "err"); return false; }
  if (c.brands.some((b: any) => b.name.toLowerCase() === name.toLowerCase())) { F.toast("Ya existe una marca con ese nombre en este cliente.", "err"); return false; }
  const b = { id: E.uid("brd"), name, active: true }; c.brands.push(b);
  if (S.draft && S.draft.clientId === clientId) { syncDraftClient(F, c); S.draft.brandIds.push(b.id); touch(F); }
  F.commit(); return true;
}
export function renameBrand(F: Flipper, clientId: string, brandId: string, nameRaw: string) {
  const c = client(F, clientId); const b = c.brands.find((x: any) => x.id === brandId); const name = String(nameRaw || "").trim();
  if (!name) { F.toast("El nombre de la marca no puede quedar vacío.", "err"); F.rerender(); return; }
  if (c.brands.some((x: any) => x.id !== brandId && x.name.toLowerCase() === name.toLowerCase())) { F.toast("Ya existe otra marca con ese nombre.", "err"); F.rerender(); return; }
  b.name = name; syncDraftClient(F, c); if (F.S.draft?.clientId === clientId) touch(F); F.commit();
}
export function toggleBrandActive(F: Flipper, clientId: string, brandId: string) {
  const S = F.S; const c = client(F, clientId); const b = c.brands.find((x: any) => x.id === brandId);
  if (b.active && S.draft && S.draft.clientId === clientId) {
    const fp = brandFootprint(S.draft, brandId);
    if (fp.length) { F.info("Marca con recursos asignados", <><p>No es posible desactivar <b>{b.name}</b> mientras tenga recursos en la cotización en curso. Reasígnalos o retíralos primero:</p><List items={fp} /></>); F.rerender(); return; }
    purgeBrandFromQuote(S.draft, brandId);
  }
  b.active = !b.active; syncDraftClient(F, c); if (S.draft?.clientId === clientId) touch(F); F.commit();
}

/* ---------- clientes ---------- */
function ClientForm({ F, c, onDone }: { F: Flipper; c?: any; onDone: () => void }) {
  const [d, setD] = useState({ name: c?.name ?? "", legalName: c?.legalName ?? "", contact: c?.contact ?? "", email: c?.email ?? "", phone: c?.phone ?? "", notes: c?.notes ?? "", brands: "" });
  const [errs, setErrs] = useState<string[]>([]);
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });
  const save = () => {
    const data = { name: d.name.trim(), legalName: d.legalName.trim(), contact: d.contact.trim(), email: d.email.trim(), phone: d.phone.trim(), notes: d.notes.trim() };
    const e: string[] = [];
    if (!data.name) e.push("El nombre comercial es obligatorio.");
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) e.push("El correo electrónico no tiene un formato válido.");
    const brands = d.brands.split("\n").map((s) => s.trim()).filter(Boolean);
    if (new Set(brands.map((b) => b.toLowerCase())).size !== brands.length) e.push("Hay marcas repetidas en la lista.");
    if (e.length) { setErrs(e); return; }
    if (c) {
      Object.assign(c, data); syncDraftClient(F, c); if (F.S.draft?.clientId === c.id) touch(F);
      F.commit(); F.toast("Cliente actualizado.", "ok");
    } else {
      const n = E.newClient({ ...data, brands }); F.S.clients.push(n); F.S.activeClientId = n.id; F.ui.clientId = n.id;
      F.commit(); F.toast("Cliente creado.", "ok");
    }
    onDone();
  };
  const f = (k: keyof typeof d, l: string, type = "text", ph = "") => (
    <label className="block"><span className="mb-1 block text-xs font-medium text-stone-600">{l}</span><input className={`fl-in ${k === "name" && errs.length && !d.name.trim() ? "invalid" : ""}`} type={type} value={d[k]} placeholder={ph} onChange={set(k)} autoFocus={k === "name"} /></label>
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">{f("name", "Nombre comercial *", "text", "Ej. OR-K")}{f("legalName", "Razón social")}{f("contact", "Persona de contacto")}{f("email", "Correo electrónico", "email")}{f("phone", "Teléfono", "tel")}</div>
      <label className="block"><span className="mb-1 block text-xs font-medium text-stone-600">Observaciones comerciales</span><textarea className="fl-in" value={d.notes} onChange={set("notes")} /></label>
      {!c && <label className="block"><span className="mb-1 block text-xs font-medium text-stone-600">Marcas (una por línea)</span><textarea className="fl-in" value={d.brands} onChange={set("brands")} placeholder={"Marca 1\nMarca 2"} /><span className="mt-1 block text-[11px] text-stone-400">Puedes agregar o editar marcas después.</span></label>}
      {errs.length > 0 && <Alert kind="err">{errs.map((x) => <div key={x}>{x}</div>)}</Alert>}
      <div className="flex justify-end gap-2 border-t border-stone-200 pt-3">
        <Btn onClick={onDone}>Cancelar</Btn><Btn kind="primary" onClick={save}>{c ? "Guardar cambios" : "Crear cliente"}</Btn>
      </div>
    </div>
  );
}
export function clientModal(F: Flipper, c?: any) {
  void F.openModal({ title: c ? "Editar cliente" : "Nuevo cliente", body: () => <ClientForm F={F} c={c} onDone={() => F.closeModal()} /> });
}

/* ---------- borrador de cotización ---------- */
export async function startQuote(F: Flipper, clientId?: string) {
  const S = F.S;
  if (S.draft && S.draft._dirty) {
    const keep = await F.openModal({
      title: "Hay una cotización en curso",
      body: () => <p className="text-sm">«{S.draft.name}» tiene cambios sin guardar.</p>,
      footer: (close) => (<><Btn onClick={() => close(false)}>Cancelar</Btn><Btn onClick={() => close("discard")}>Descartar y crear nueva</Btn><Btn kind="primary" onClick={() => close("keep")}>Continuar la actual</Btn></>),
    });
    if (!keep) return;
    if (keep === "keep") { F.go("quoter"); return; }
  }
  const c = client(F, clientId || S.activeClientId);
  S.draft = E.newQuote(S, c || null); S.draft._dirty = false;
  if (c) S.activeClientId = c.id;
  F.ui.step = 1; F.commit(); F.go("quoter");
}
export function openQuoteInEditor(F: Flipper, id: string, step = 1) {
  const S = F.S; const q = S.quotes.find((x: any) => x.id === id); if (!q) return;
  const go2 = () => { S.draft = E.clone(q); S.draft._sourceId = q.id; S.draft._dirty = false; F.ui.step = step; F.commit(); F.go("quoter"); };
  if (S.draft && S.draft._dirty && S.draft._sourceId !== id) {
    void F.confirm("Cambios sin guardar", <p>La cotización en curso «{S.draft.name}» tiene cambios sin guardar. ¿Descartarlos y abrir {q.number}?</p>, { ok: "Descartar y abrir", danger: true }).then((ok) => ok && go2());
  } else go2();
}
export function persistDraft(F: Flipper, { silent = false, asNew = false } = {}) {
  const S = F.S; const q = S.draft; if (!q) return null;
  if (!F.perms.write) { F.toast("Tu rol solo puede ver Flipper: no puede guardar cotizaciones.", "err"); return null; }
  const v = E.validateQuote(q);
  if (!v.ok) {
    F.info("No es posible guardar todavía", <><p>Corrige lo siguiente antes de guardar:</p><List items={v.errors.map((e: any) => e.msg)} /></>);
    return null;
  }
  if (asNew || !q.number) q.number = E.nextQuoteNumber(S);
  const copy = E.clone(q); delete copy._sourceId; delete copy._dirty;
  const idx = S.quotes.findIndex((x: any) => x.id === q.id);
  if (idx >= 0) S.quotes[idx] = copy; else S.quotes.unshift(copy);
  q._sourceId = q.id; q._dirty = false;
  F.commit(); if (!silent) F.toast(`Cotización ${q.number} guardada.`, "ok");
  return copy;
}

/* ---------- asignaciones con control de capacidad ---------- */
export function overResources(q: any, line: any) {
  const capy = E.lineCapacity(q, line); const used = E.lineUsage(q, line).total;
  return E.capOf(q, line).resources.filter((r: any) => (used[r.key] || 0) > capy[r.key]).map((r: any) => ({ r, used: used[r.key] || 0, cap: capy[r.key] }));
}
/** Aplica una mutación sobre una línea; si aumenta un exceso de capacidad la revierte y propone ampliaciones. */
export function guarded(F: Flipper, line: any, mutate: (l: any) => void): boolean {
  const q = F.S.draft; const before = E.lineUsage(q, line).total; const snap = E.clone(line);
  mutate(line);
  const capy = E.lineCapacity(q, line); const after = E.lineUsage(q, line).total;
  const bad = E.capOf(q, line).resources.filter((r: any) => (after[r.key] || 0) > capy[r.key] && (after[r.key] || 0) > (before[r.key] || 0));
  if (!bad.length) { touch(F); F.commit(); return true; }
  Object.keys(line).forEach((k) => delete line[k]); Object.assign(line, snap);
  showOverModal(F, line, bad.map((r: any) => ({ r, used: after[r.key], cap: capy[r.key] })), mutate);
  F.rerender();
  return false;
}
function showOverModal(F: Flipper, line: any, list: any[], mutate: (l: any) => void) {
  const q = F.S.draft; const cap = E.capOf(q, line);
  const extras = (cap.extras || []).filter((x: any) => list.some((o) => o.r.key === x.resourceKey));
  const overUnit = () => { F.closeModal(); const l = lineByUid(F, line.uid); if (!l) return; l.qty += 1; touch(F); guarded(F, l, mutate); F.toast("Se agregó 1 unidad y se aplicó la asignación.", "ok"); };
  const overExtra = (ex: any) => {
    const l = lineByUid(F, line.uid); if (!l) { F.closeModal(); return; }
    if (!ex.price) { F.toast("Este bloque requiere cotización especial: registra la tarifa en Configuración.", "err"); return; }
    F.closeModal(); l.extras[ex.id] = (l.extras[ex.id] || 0) + 1; touch(F); guarded(F, l, mutate);
  };
  void F.openModal({
    title: "Capacidad insuficiente",
    body: () => (<div className="space-y-3 text-sm">
      <Alert kind="err"><b>La asignación supera la capacidad contratada de {cap.name}.</b><ul className="ml-5 list-disc">{list.map((o) => <li key={o.r.key}>{o.r.label}: se requieren {fmtNum(o.used)} y hay {fmtNum(o.cap)} disponibles.</li>)}</ul></Alert>
      <p>Para continuar puedes contratar una ampliación:</p>
      <div className="flex flex-col gap-2">
        <Btn icon="plus" onClick={overUnit} className="justify-between">Agregar 1 unidad de {cap.name} <span className="ml-auto text-stone-500 tabular-nums">+{money(cap.price)} / mes</span></Btn>
        {extras.map((x: any) => (
          <Btn key={x.id} icon="plus" onClick={() => overExtra(x)}>Bloque adicional: {x.name} (+{fmtNum(x.amount)} {cap.resources.find((r: any) => r.key === x.resourceKey)?.label.toLowerCase() || ""}) <span className="ml-auto text-stone-500">{x.price ? `+${money(x.price)}` : "Requiere cotización especial"}</span></Btn>
        ))}
        {!extras.length && <div className="text-xs text-stone-500">Bloque o entregable adicional con precio específico: <b>Requiere cotización especial</b> (no hay tarifa adicional configurada).</div>}
      </div>
    </div>),
    footer: (close) => <Btn onClick={() => close()}>No asignar</Btn>,
  });
}

export function addLineToDraft(F: Flipper, capId: string, mode: "shared" | "exclusive") {
  const q = F.S.draft; const cap = capById(F, capId); let brandIds: string[] = [];
  if (mode === "exclusive") {
    const used = new Set(q.lines.filter((l: any) => l.capId === capId && l.mode === "exclusive").flatMap((l: any) => l.brandIds));
    const b = q.brandIds.find((x: string) => !used.has(x));
    if (!b) { F.toast("Todas las marcas participantes ya tienen esta capacidad exclusiva.", "err"); return; }
    brandIds = [b];
  } else brandIds = q.brandIds.slice();
  E.newLine(q, cap, { mode, brandIds }); touch(F); F.commit();
  F.toast(`${cap.name} agregada como capacidad ${mode === "exclusive" ? "exclusiva" : "compartida"}.`, "ok");
}

/* ---------- demostración ---------- */
export function loadDemo(F: Flipper) {
  const S = F.S;
  const proceed = () => {
    const c = E.demoClient(); S.clients.push(c); S.activeClientId = c.id;
    const q = E.newQuote(S, c); q.name = "Demostración Flipper Beta — Modalidad mixta"; q.scenarioName = "Escenario B — Crecimiento";
    const B: Record<string, string> = Object.fromEntries(c.brands.map((b: any) => [b.name, b.id]));
    const cap = (id: string) => capById(F, id);
    const com = E.newLine(q, cap("cap_community"), { mode: "exclusive", brandIds: [B["Beta Energy"]] }); com.alloc = { [B["Beta Energy"]]: { posts: 8, reels: 4, stories: 8 } };
    const des = E.newLine(q, cap("cap_design"), { mode: "shared", brandIds: c.brands.map((b: any) => b.id) });
    des.alloc = { [B["Beta Energy"]]: { catalog: 1, pieces: 2 }, [B["Beta Plastic"]]: { pieces: 4 }, [B["Beta Import"]]: { pieces: 2 }, [B["Beta Industrial"]]: { pieces: 2 } };
    const dev = E.newLine(q, cap("cap_tech"), { mode: "shared", brandIds: [B["Beta Industrial"], B["Beta Plastic"]] });
    dev.requests = [
      { id: E.uid("rq"), name: "Formulario de cotización web", brandId: B["Beta Industrial"], workType: "Formularios y validaciones", description: "Formulario con validaciones y envío a correo comercial.", estHours: 12, priority: "Alta", status: "Aprobada", approvedHours: 12, consumedHours: 0 },
      { id: E.uid("rq"), name: "Reporte de solicitudes comerciales", brandId: B["Beta Plastic"], workType: "Reportes", description: "Reporte mensual descargable.", estHours: 8, priority: "Media", status: "Aprobada", approvedHours: 8, consumedHours: 0 },
      { id: E.uid("rq"), name: "Ajustes de interfaz del catálogo", brandId: B["Beta Plastic"], workType: "Ajustes de interfaz", description: "", estHours: 6, priority: "Baja", status: "Estimada", approvedHours: 0, consumedHours: 0 },
    ];
    const mk = E.newLine(q, cap("cap_marketing"), { mode: "exclusive", brandIds: [B["Beta Structure"]] }); mk.alloc = { [B["Beta Structure"]]: { meta: 2, google: 1 } }; mk.kpis = ["Leads", "Costo por lead", "Solicitudes de cotización"];
    q.adBudget[B["Beta Structure"]] = { meta: 2000000, google: 1500000, other: 0 };
    q.number = E.nextQuoteNumber(S); S.quotes.unshift(q);
    F.ui.clientId = c.id;
    F.commit(); F.toast("Demostración Flipper Beta cargada: cliente con 5 marcas y una cotización mixta de ejemplo.", "ok");
  };
  if (S.clients.some((c: any) => c.name === "Flipper Beta")) void F.confirm("Demostración Flipper Beta", <p>Ya existe un cliente llamado Flipper Beta. ¿Crear otra copia de demostración?</p>, { ok: "Crear copia" }).then((ok) => ok && proceed());
  else proceed();
}

/* ---------- propuesta: imprimir y exportar ---------- */
function guardPrintable(F: Flipper, q: any) {
  const v = E.validateQuote(q);
  if (!v.ok) { F.info("Propuesta con ajustes pendientes", <><p>Corrige lo siguiente antes de imprimir o exportar:</p><List items={v.errors.map((e: any) => e.msg)} /></>); return false; }
  if (!q.lines.length) { F.toast("La propuesta no tiene capacidades.", "err"); return false; }
  return true;
}
export function printQuote(F: Flipper, q: any) {
  if (!guardPrintable(F, q)) return;
  const w = window.open("", "_blank");
  if (!w) { F.toast("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.", "err"); return; }
  w.document.open(); w.document.write(P.standalone(q, F.S.settings)); w.document.close();
  w.onload = () => setTimeout(() => w.print(), 150);
}
export function exportClientHTML(F: Flipper, q: any) {
  if (!guardPrintable(F, q)) return;
  const name = `Propuesta_${(q.number || "borrador").replace(/[^\w-]/g, "")}_${q.client.name.replace(/[^\w]+/g, "_")}.html`;
  download(name, P.standalone(q, F.S.settings), "text/html");
  F.toast("Propuesta exportada. El archivo no contiene costos, márgenes ni notas privadas.", "ok");
}
export function download(name: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}
export function nextScenarioName(F: Flipper, groupId: string) {
  const names = F.S.quotes.filter((x: any) => x.groupId === groupId).map((x: any) => x.scenarioName);
  const sug = ["Escenario A — Esencial", "Escenario B — Crecimiento", "Escenario C — Integral"];
  return sug.find((s) => !names.includes(s)) || `Escenario ${String.fromCharCode(65 + names.length)}`;
}
export const capIcon = (cap: any) => cap?.icon || "box";
export { Ic, brandName };
