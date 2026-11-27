import "dotenv/config";
import assert from "node:assert/strict";
import { canGrantPermissions, DEFAULT_SHARED_ACCESS, hasPermission, membershipPermissions } from "@/lib/core/permissions";
import { canReadResourceRow, listResource, positiveInteger, RESOURCES } from "@/lib/core/api-v1";
import type { ApiContext } from "@/lib/core/api-auth";
import { safeRedirectPath } from "@/lib/core/redirect-path";
import { buildPersonalCatalog, personalPermissionsFromForm, summarize } from "@/lib/core/permission-catalog";

async function main() {
  for (const path of ["https://external.invalid", "//external.invalid", "/\\external.invalid", "/\n/external.invalid"]) assert.equal(safeRedirectPath(path), "/");
  assert.equal(safeRedirectPath("/sales/quotes?q=test"), "/sales/quotes?q=test");
  assert.deepEqual(summarize(["*", "deny:costs", "scope:own:campaigns"], []), ["Acceso total", "solo sus campañas", "sin costos"]);
  assert.ok(summarize(["org.users.manage"], []).includes("Gestionar usuarios"));
  assert.equal(canGrantPermissions(["org.users.manage"], ["*"]), false);
  assert.equal(canGrantPermissions(["sales.*", "deny:costs"], ["sales.quotes.read"]), false);
  assert.equal(canGrantPermissions(["sales.*", "scope:own:sales"], ["sales.*"]), false);
  assert.equal(canGrantPermissions(["sales.*", "deny:costs"], ["sales.quotes.read", "deny:costs"]), true);
  assert.equal(canGrantPermissions(["*"], ["sales.*"]), true);
  const catalog = buildPersonalCatalog(new Set(["inventory"]), []);
  const form = new FormData();
  form.set("lvl:inventory", "read");
  form.set("lvl:tasks", "read");
  form.append("permissions", "scope:own:sales");
  form.append("permissions", "custom.hidden.write");
  const base = ["inventory.*", "custom.hidden.read", "scope:own:sales"];
  const personal = personalPermissionsFromForm(form, catalog, base, ["hidden"]);
  assert.equal(hasPermission(personal, "inventory.read"), true);
  assert.equal(hasPermission(personal, "inventory.write"), false);
  assert.equal(hasPermission(personal, "custom.hidden.read"), true);
  assert.equal(hasPermission(personal, "custom.hidden.write"), false);
  assert.ok(personal.includes("scope:own:sales"));
  assert.equal(hasPermission(personal, "tasks.read"), true);
  assert.equal(hasPermission(personal, "tasks.write"), false);
  assert.equal(hasPermission(personal, "dashboard.read"), false);
  assert.deepEqual(membershipPermissions({ permissionsOverride: [], role: { permissions: base } }), []);
  assert.deepEqual(membershipPermissions({ permissionsOverride: null, role: { permissions: base } }), [...base, ...DEFAULT_SHARED_ACCESS]);
  for (const value of ["Infinity", "NaN", "1.5", "-1", "0", null]) assert.equal(positiveInteger(value, 25, 100), 25);
  assert.equal(positiveInteger("200", 25, 100), 100);
  const calls: { where: { ownerId?: string; OR?: unknown[] }; take?: number }[] = [];
  const delegate = {
    findMany: async (args: (typeof calls)[number]) => { calls.push(args); return []; },
    count: async (args: (typeof calls)[number]) => { calls.push(args); return 0; },
  };
  const ctx = { actorId: "seller-a", permissions: ["sales.*", "scope:own:sales"], db: { quote: delegate, salesOrder: delegate } } as unknown as ApiContext;
  for (const resource of [RESOURCES.quotes, RESOURCES["sales-orders"]]) {
    assert.equal(canReadResourceRow(ctx, resource, { ownerId: "seller-a" }), true);
    assert.equal(canReadResourceRow(ctx, resource, { ownerId: "seller-b" }), false);
    assert.equal(canReadResourceRow(ctx, resource, { ownerId: null }), false);
    await listResource(ctx, resource, new URL("https://test.invalid/?q=PV&limit=Infinity&page=1.2"));
  }
  assert.equal(calls.length, 4);
  assert.ok(calls.every((call) => call.where.ownerId === "seller-a" && call.where.OR?.length));
  assert.equal(calls[0].take, 25);
  assert.equal(canReadResourceRow({ ...ctx, actorId: null }, RESOURCES.quotes, { ownerId: null }), false);
  console.log("Controles de delegación, restricciones, paginación y alcance de API: correctos");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
