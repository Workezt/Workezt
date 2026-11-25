"use client";

import { useFlipper } from "./store";
import { Ic } from "./kit";

/** Franja superior de Flipper: cliente activo, estado de guardado y modo interno / presentación. */
export function FlipperBar() {
  const F = useFlipper(); const S = F.S;
  const c = S.clients.find((x: { id: string }) => x.id === S.activeClientId) as { name: string } | undefined;
  const st = { ok: ["ok", "Guardado"], pending: ["pend", "Cambios por guardar…"], saving: ["pend", "Guardando…"], error: ["err", "Error al guardar"] }[F.status];
  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2 text-xs">
      {c && <button className="fl-chip on" onClick={() => F.go("clients")} title="Cliente activo"><Ic n="users" size={13} />{c.name}</button>}
      <span className={`fl-cloud ${st[0]}`}><i />{st[1]}</span>
      {!F.perms.write && <span className="fl-badge warn">Solo lectura</span>}
      <div className="fl-seg" role="group" aria-label="Modo">
        <button className={F.isInternal ? "on" : ""} onClick={() => F.setMode("internal")}><Ic n="lock" size={12} /> Interno</button>
        <button className={!F.isInternal ? "on" : ""} onClick={() => F.setMode("present")}><Ic n="eye" size={12} /> Presentación</button>
      </div>
    </div>
  );
}
