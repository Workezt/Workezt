"use client";

import { useState } from "react";
import { Field, input } from "./ui-base";

export function RolePicker({ roles }: { roles: { id: string; name: string; description: string | null; summary: string[] }[] }) {
  const [id, setId] = useState("");
  const selected = roles.find((role) => role.id === id);
  return (
    <div className="space-y-3">
      <Field label="Perfil de acceso *">
        <select name="roleId" required value={id} onChange={(event) => setId(event.target.value)} className={input} aria-describedby="role-preview">
          <option value="" disabled>Selecciona el acceso que necesita</option>
          {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </Field>
      <div id="role-preview" aria-live="polite" className="rounded-xl border border-[var(--ork-rule)] bg-slate-50 p-3 text-sm">
        {selected ? <>
          <p className="font-medium">{selected.name}</p>
          {selected.description && <p className="mt-1 text-xs text-slate-600">{selected.description}</p>}
          <ul className="mt-2 space-y-1 text-xs text-slate-600">{selected.summary.map((item) => <li key={item}>{item}</li>)}</ul>
        </> : <p className="text-xs text-slate-500">Elige un perfil para revisar sus permisos antes de dar acceso.</p>}
      </div>
    </div>
  );
}
