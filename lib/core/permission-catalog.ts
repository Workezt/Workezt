import { CORE_PERMISSIONS, RESTRICTIONS, SCOPES, hasPermission, isRestrictionKey, type PermissionDef } from "./permissions";
import { MODULES } from "@/lib/modules/registry";

/**
 * Catálogo de permisos para el editor de roles: cada app se presenta como "áreas" con nivel
 * (Sin acceso · Solo lectura · Edición) más permisos especiales. Se traduce a las mismas claves
 * que ya exige el código (`<área>.read`, `<área>.write`, `purchasing.approve`…), así nada cambia
 * en cómo se verifican los permisos.
 */
export type Level = "none" | "read" | "write";
export type Area = { prefix: string; label: string };
export type AppGroup = { key: string; name: string; areas: Area[]; extras: PermissionDef[] };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildCatalog(activeModules: Set<string>, customEntities: { key: string; labelPlural: string }[]): AppGroup[] {
  const groups: AppGroup[] = [];
  for (const m of MODULES.filter((x) => activeModules.has(x.key))) {
    const reads = m.permissions.filter((p) => p.key.endsWith(".read"));
    const areas = reads.filter((r) => m.permissions.some((p) => p.key === r.key.replace(/\.read$/, ".write")))
      .map((r) => ({ prefix: r.key.replace(/\.read$/, ""), label: cap(r.label.replace(/^Ver\s+/i, "")) }));
    const used = new Set(areas.flatMap((a) => [`${a.prefix}.read`, `${a.prefix}.write`]));
    groups.push({ key: m.key, name: APP_NAMES[m.key] ?? m.name, areas, extras: m.permissions.filter((p) => !used.has(p.key)) });
  }
  for (const custom of customEntities) {
    groups.push({ key: `x:${custom.key}`, name: custom.labelPlural, extras: [], areas: [{ prefix: `custom.${custom.key}`, label: "Registros" }] });
  }
  return groups;
}

/** Herramientas que históricamente están disponibles para todos los roles base. */
export function buildPersonalCatalog(activeModules: Set<string>, customEntities: { key: string; labelPlural: string }[]): AppGroup[] {
  return [
    { key: "dashboard", name: "Tableros", areas: [], extras: [{ key: "dashboard.read", label: "Ver tableros" }] },
    { key: "tasks", name: "Tareas", areas: [{ prefix: "tasks", label: "Tareas y seguimientos" }], extras: [] },
    { key: "approvals", name: "Aprobaciones", areas: [{ prefix: "approvals", label: "Aprobaciones del perfil base" }], extras: [] },
    ...buildCatalog(activeModules, customEntities),
  ];
}

/** Nombres en español para las apps (el registro usa nombres en inglés). */
export const APP_NAMES: Record<string, string> = {
  crm: "CRM", sales: "Ventas", products: "Productos", inventory: "Inventario", purchasing: "Compras", manufacturing: "Manufactura",
  quality: "Calidad", invoicing: "Facturación", knowledge: "Conocimiento", sonar: "Sonar", radar: "Radar", analytics: "Analytics",
  automations: "Automatizaciones", hr: "Talento humano", employee_portal: "Mi portal", accounting: "Contabilidad", documents: "Documentos",
  campaigns: "Campañas",
  maintenance: "Mantenimiento", logistics: "Logística",
  finance: "Finanzas", website: "Sitio web", flipper: "Flipper",
};

export function levelOf(granted: readonly string[], prefix: string): Level {
  return hasPermission(granted, `${prefix}.write`) ? "write" : hasPermission(granted, `${prefix}.read`) ? "read" : "none";
}

/** Traduce el formulario del editor a la lista de permisos del rol. */
export function permissionsFromForm(form: FormData, catalog: AppGroup[], previous: readonly string[]) {
  const shownPrefixes = new Set<string>(["org", "studio", "integrations", "audit", "import", "intelligence", "approvals"]);
  for (const g of catalog) { shownPrefixes.add(g.key); g.areas.forEach((a) => shownPrefixes.add(a.prefix.split(".")[0])); }
  // Se conservan los permisos de apps que no se muestran (p. ej. apps desactivadas) para no perderlos
  const kept = previous.filter((p) => !isRestrictionKey(p) && p !== "*" && !shownPrefixes.has(p.split(".")[0]));
  const out = new Set<string>(kept);
  for (const g of catalog) {
    for (const a of g.areas) {
      const lvl = String(form.get(`lvl:${a.prefix}`) ?? "none") as Level;
      if (lvl === "read" || lvl === "write") out.add(`${a.prefix}.read`);
      if (lvl === "write") out.add(`${a.prefix}.write`);
    }
  }
  const allowed = new Set([...catalog.flatMap((g) => g.extras.map((e) => e.key)), ...CORE_PERMISSIONS.map((p) => p.key), ...RESTRICTIONS.map((r) => r.key), ...SCOPES.map((s) => s.key)]);
  for (const p of form.getAll("permissions").map(String)) if (allowed.has(p)) out.add(p);
  return [...out];
}

/** Resumen legible de un rol: "Ventas: edición · Inventario: lectura · sin costos". */
export function summarize(granted: readonly string[], catalog: AppGroup[]) {
  const parts: string[] = granted.includes("*") ? ["Acceso total"] : [];
  for (const g of granted.includes("*") ? [] : catalog) {
    const lv = g.areas.map((a) => levelOf(granted, a.prefix));
    if (lv.some((l) => l !== "none")) parts.push(`${g.name}: ${lv.every((l) => l === "write") ? "edición" : lv.every((l) => l !== "write") ? "lectura" : "mixto"}`);
    for (const extra of g.extras) if (hasPermission(granted, extra.key)) parts.push(`${g.name}: ${extra.label}`);
  }
  if (!granted.includes("*")) for (const p of CORE_PERMISSIONS) if (hasPermission(granted, p.key)) parts.push(p.label);
  if (granted.includes("scope:own:sales")) parts.push("solo sus ventas");
  if (granted.includes("scope:own:campaigns")) parts.push("solo sus campañas");
  if (granted.includes("deny:costs")) parts.push("sin costos");
  if (granted.includes("deny:export")) parts.push("sin exportar");
  return parts.length ? parts : ["Sin acceso a apps"];
}

/** Conserva permisos ajenos al editor y convierte los comodines editables en permisos concretos. */
export function personalPermissionsFromForm(form: FormData, catalog: AppGroup[], previous: readonly string[], customKeys: readonly string[]) {
  const editable = new Set([
    ...catalog.flatMap((group) => [
      ...group.areas.flatMap(({ prefix }) => [`${prefix}.read`, `${prefix}.write`]),
      ...group.extras.map(({ key }) => key),
    ]),
    ...CORE_PERMISSIONS.map(({ key }) => key),
    ...RESTRICTIONS.map(({ key }) => key),
    ...SCOPES.map(({ key }) => key),
  ]);
  const known = [
    ...MODULES.flatMap(({ permissions }) => permissions.map(({ key }) => key)),
    ...customKeys.flatMap((key) => [`custom.${key}.read`, `custom.${key}.write`]),
  ];
  const editableKeys = [...editable];
  const preserved = previous.flatMap((permission) => {
    if (editable.has(permission)) return [];
    if (!editableKeys.some((key) => hasPermission([permission], key))) return [permission];
    return known.filter((key) => !editable.has(key) && hasPermission([permission], key));
  });
  const selected = permissionsFromForm(form, catalog, []).filter((key) => editable.has(key));
  return [...new Set([...preserved, ...selected])];
}
