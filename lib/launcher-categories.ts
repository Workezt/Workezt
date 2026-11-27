export const CATEGORIES = [
  { key: "administracion", name: "Administración", icon: "settings", palette: { light: "#8d9bb0", base: "#61708a", dark: "#434f66" }, apps: ["hr", "employee_portal", "tasks", "automations", "studio", "import", "apps", "settings"] },
  { key: "operaciones", name: "Operaciones", icon: "manufacturing", palette: { light: "#34cdc6", base: "#0f9ea3", dark: "#0a6a72" }, apps: ["products", "inventory", "purchasing", "manufacturing", "maintenance", "logistics", "x:visita"] },
  { key: "comercial", name: "Comercial", icon: "sales", palette: { light: "#ffb457", base: "#f57c1f", dark: "#d4520c" }, apps: ["crm", "sales", "campaigns", "website", "flipper"] },
  { key: "gerencia", name: "Gerencia", icon: "dashboard", palette: { light: "#a978ff", base: "#7c3aed", dark: "#5317c4" }, apps: ["dashboard", "ask", "approvals", "radar", "analytics"] },
  { key: "finanzas", name: "Finanzas", icon: "finance", palette: { light: "#4aa3ff", base: "#1a6fe6", dark: "#0b4bb3" }, apps: ["finance", "accounting", "invoicing"] },
  { key: "calidad", name: "Gestión de Calidad", icon: "quality", palette: { light: "#86d45c", base: "#429e2e", dark: "#24631b" }, apps: ["quality", "documents", "knowledge", "sonar"] },
] as const;

type Category = (typeof CATEGORIES)[number];
export const categoryByApp = new Map<string, Category["key"]>(
  CATEGORIES.flatMap(({ key, apps }) => apps.map((app) => [app, key] as const)),
);
