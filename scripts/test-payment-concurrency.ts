import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "@/lib/core/prisma";
import { tenantDb } from "@/lib/core/db";
import { creditNote, ensureAccountingDefaults, registerPayment } from "@/lib/apps/invoicing";
import { decideApproval } from "@/lib/core/approvals";
import type { OrgContext } from "@/lib/core/context";

async function main() {
  const org = await prisma.organization.create({ data: { name: "Payment race test", slug: `test-payment-${Date.now()}` } });
  const ctx = { orgId: org.id, db: tenantDb(org.id), actorId: null };
  try {
    await ensureAccountingDefaults(ctx);
    const customer = await ctx.db.customer.create({ data: { organizationId: org.id, name: "Test customer" } });
    const invoice = await ctx.db.invoice.create({ data: { organizationId: org.id, number: "TEST-1", customerId: customer.id, total: 100, subtotal: 100, balance: 100, dueDate: new Date() } });
    const results = await Promise.allSettled([
      registerPayment(ctx, { invoiceId: invoice.id, amount: 100 }),
      registerPayment(ctx, { invoiceId: invoice.id, amount: 100 }),
      creditNote(ctx, invoice.id, 100),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const payments = await ctx.db.payment.aggregate({ where: { invoiceId: invoice.id }, _sum: { amount: true } });
    const credits = await ctx.db.invoice.aggregate({ where: { refundOfId: invoice.id }, _sum: { total: true } });
    assert.equal(Number(payments._sum.amount ?? 0) + Number(credits._sum.total ?? 0), 100);
    assert.equal(Number((await ctx.db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).balance), 0);
    await assert.rejects(() => registerPayment(ctx, { invoiceId: invoice.id, amount: Infinity }), /Valor inválido/);
    await assert.rejects(() => registerPayment(ctx, { invoiceId: invoice.id, billId: "both", amount: 1 }), /una sola/);
    console.log("Pagos y nota crédito simultáneos: un solo movimiento, saldo correcto, sin duplicados");
    const approval = await ctx.db.approval.create({ data: { organizationId: org.id, entityType: "invoice", entityId: invoice.id, reason: "Concurrency test", requiredRoleKey: "REVIEWER" } });
    const reviewer = { ...ctx, role: { key: "REVIEWER" }, user: { id: "test-reviewer", name: "Reviewer" }, can: () => false } as unknown as OrgContext;
    const decisions = await Promise.allSettled([decideApproval(reviewer, approval.id, true), decideApproval(reviewer, approval.id, false)]);
    assert.equal(decisions.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await ctx.db.domainEvent.count({ where: { entityId: approval.id, type: "ApprovalDecided" } }), 1);
    console.log("Aprobaciones simultáneas: una sola decisión y un solo evento");
  } finally {
    await ctx.db.payment.deleteMany({});
    await ctx.db.invoice.deleteMany({});
    await ctx.db.customer.deleteMany({});
    await ctx.db.journal.deleteMany({});
    await ctx.db.tax.deleteMany({});
    await ctx.db.sequence.deleteMany({});
    await ctx.db.auditLog.deleteMany({});
    await ctx.db.approval.deleteMany({});
    await ctx.db.activity.deleteMany({});
    await ctx.db.domainEvent.deleteMany({});
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
