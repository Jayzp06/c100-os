/**
 * Treasurer workspace routes — dues ledger, transactions, and receipts.
 * All routes require manage_finances permission.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  duesLedgerTable,
  financialTransactionsTable,
  receiptAttachmentsTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requirePermGroup, writeAuditLog } from "../lib/c100";
import { ObjectStorageService } from "../lib/objectStorage";
import { buildFilenameBase, isExportFormat, sendCsv, sendXlsx, sendPdf, type ReportColumn } from "../lib/export";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const CreateDuesLedgerBody = z.object({
  memberId: z.number().int().positive(),
  semesterLabel: z.string().min(1).max(24),
  amountCents: z.number().int().nonnegative(),
  paymentMethod: z.string().max(50).optional(),
  referenceNumber: z.string().max(100).optional(),
  paidAt: z.string().optional(),
  status: z.enum(["Outstanding", "Paid", "Waived"]).default("Outstanding"),
  notes: z.string().optional(),
});

const UpdateDuesLedgerBody = CreateDuesLedgerBody.partial();

const CreateTransactionBody = z.object({
  accountId: z.number().int().positive(),
  categoryId: z.number().int().optional(),
  transactionType: z.enum(["Income", "Expense"]),
  amountCents: z.number().int(),
  description: z.string().default(""),
  transactionDate: z.string().min(1),
  relatedEventId: z.number().int().optional(),
  paymentMethod: z.string().max(50).optional(),
  referenceNumber: z.string().max(100).optional(),
});

const UpdateTransactionBody = CreateTransactionBody.partial().extend({
  txnStatus: z.enum(["Pending", "Cleared", "Voided"]).optional(),
});

// ── Transactions ──────────────────────────────────────────────────────────

router.get(
  "/treasurer/transactions",
  requirePermGroup("manage_finances")(async (req, res) => {
    const rows = await db
      .select()
      .from(financialTransactionsTable)
      .orderBy(desc(financialTransactionsTable.transactionDate));
    res.json(rows);
  }),
);

router.post(
  "/treasurer/transactions",
  requirePermGroup("manage_finances")(async (req, res) => {
    const parsed = CreateTransactionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .insert(financialTransactionsTable)
      .values({ ...parsed.data, recordedBy: (req as any).member.id })
      .returning();
    await writeAuditLog({ action: "transaction.create", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: row.id, after: { amountCents: row.amountCents } });
    res.status(201).json(row);
  }),
);

router.get(
  "/treasurer/transactions/:id",
  requirePermGroup("manage_finances")(async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db.select().from(financialTransactionsTable).where(eq(financialTransactionsTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  }),
);

router.patch(
  "/treasurer/transactions/:id",
  requirePermGroup("manage_finances")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = UpdateTransactionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .update(financialTransactionsTable)
      .set(parsed.data)
      .where(eq(financialTransactionsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "transaction.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

router.put(
  "/treasurer/transactions/:id",
  requirePermGroup("manage_finances")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = UpdateTransactionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const [row] = await db
      .update(financialTransactionsTable)
      .set(parsed.data)
      .where(eq(financialTransactionsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "transaction.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

// ── Dues Ledger ────────────────────────────────────────────────────────────

router.get(
  "/treasurer/dues",
  requirePermGroup("manage_finances")(async (req, res) => {
    const rows = await db
      .select()
      .from(duesLedgerTable)
      .orderBy(desc(duesLedgerTable.createdAt));
    res.json(rows);
  }),
);

router.post(
  "/treasurer/dues",
  requirePermGroup("manage_finances")(async (req, res) => {
    const parsed = CreateDuesLedgerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const data = {
      ...parsed.data,
      paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : undefined,
      recordedById: (req as any).member.id,
    };
    const [row] = await db.insert(duesLedgerTable).values(data).returning();
    await writeAuditLog({ action: "dues.create", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: row.id, after: { memberId: row.memberId, amountCents: row.amountCents } });
    res.status(201).json(row);
  }),
);

router.get(
  "/treasurer/dues/:id",
  requirePermGroup("manage_finances")(async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db.select().from(duesLedgerTable).where(eq(duesLedgerTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  }),
);

router.patch(
  "/treasurer/dues/:id",
  requirePermGroup("manage_finances")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = UpdateDuesLedgerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.paidAt) data.paidAt = new Date(parsed.data.paidAt);
    const [row] = await db
      .update(duesLedgerTable)
      .set(data)
      .where(eq(duesLedgerTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "dues.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

router.put(
  "/treasurer/dues/:id",
  requirePermGroup("manage_finances")(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = UpdateDuesLedgerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.paidAt) data.paidAt = new Date(parsed.data.paidAt);
    const [row] = await db
      .update(duesLedgerTable)
      .set(data)
      .where(eq(duesLedgerTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await writeAuditLog({ action: "dues.update", targetType: "officer_workspace", actorId: (req as any).member.id, targetId: id, after: parsed.data });
    res.json(row);
  }),
);

// GET /treasurer/summary — aggregate totals
router.get(
  "/treasurer/summary",
  requirePermGroup("manage_finances")(async (req, res) => {
    const [txnSummary] = await db
      .select({
        totalIncomeCents: sql<number>`COALESCE(SUM(CASE WHEN transaction_type = 'Income' THEN amount_cents ELSE 0 END), 0)`,
        totalExpenseCents: sql<number>`COALESCE(SUM(CASE WHEN transaction_type = 'Expense' THEN amount_cents ELSE 0 END), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(financialTransactionsTable);

    const [duesSummary] = await db
      .select({
        totalOutstandingCents: sql<number>`COALESCE(SUM(CASE WHEN status = 'Outstanding' THEN amount_cents ELSE 0 END), 0)`,
        totalPaidCents: sql<number>`COALESCE(SUM(CASE WHEN status = 'Paid' THEN amount_cents ELSE 0 END), 0)`,
        totalWaivedCents: sql<number>`COALESCE(SUM(CASE WHEN status = 'Waived' THEN amount_cents ELSE 0 END), 0)`,
        duesCount: sql<number>`COUNT(*)`,
      })
      .from(duesLedgerTable);

    res.json({ transactions: txnSummary, dues: duesSummary });
  }),
);

// GET /treasurer/dues/export?format=csv|xlsx|pdf
router.get(
  "/treasurer/dues/export",
  requirePermGroup("manage_finances")(async (req, res) => {
    const format = req.query.format;
    if (!isExportFormat(format)) {
      res.status(400).json({ error: "format must be csv, xlsx, or pdf" });
      return;
    }
    const rows = await db
      .select()
      .from(duesLedgerTable)
      .orderBy(desc(duesLedgerTable.createdAt));

    type Row = (typeof rows)[number];
    const meta = { title: "Dues Ledger", filenameBase: buildFilenameBase("Dues Ledger") };
    const columns: ReportColumn<Row>[] = [
      { header: "Member ID",      key: "memberId",       value: (r) => r.memberId,                             width: 12 },
      { header: "Semester",       key: "semesterLabel",  value: (r) => r.semesterLabel,                        width: 18 },
      { header: "Amount ($)",     key: "amount",         value: (r) => (r.amountCents / 100).toFixed(2),       width: 14 },
      { header: "Status",         key: "status",         value: (r) => r.status,                               width: 14 },
      { header: "Payment Method", key: "paymentMethod",  value: (r) => r.paymentMethod ?? "",                  width: 18 },
      { header: "Reference",      key: "referenceNumber",value: (r) => r.referenceNumber ?? "",                width: 18 },
      { header: "Notes",          key: "notes",          value: (r) => r.notes ?? "",                          width: 30 },
    ];
    if (format === "csv")  return sendCsv(res, meta, columns, rows);
    if (format === "xlsx") return sendXlsx(res, meta, [{ name: "Dues Ledger", columns, rows }]);
    return sendPdf(res, meta, columns, rows);
  }),
);

// GET /treasurer/transactions/export?format=csv|xlsx|pdf
router.get(
  "/treasurer/transactions/export",
  requirePermGroup("manage_finances")(async (req, res) => {
    const format = req.query.format;
    if (!isExportFormat(format)) {
      res.status(400).json({ error: "format must be csv, xlsx, or pdf" });
      return;
    }
    const rows = await db
      .select()
      .from(financialTransactionsTable)
      .orderBy(desc(financialTransactionsTable.transactionDate));

    type Row = (typeof rows)[number];
    const meta = { title: "Financial Transactions", filenameBase: buildFilenameBase("Financial Transactions") };
    const columns: ReportColumn<Row>[] = [
      { header: "Date",           key: "transactionDate", value: (r) => String(r.transactionDate),            width: 14 },
      { header: "Type",           key: "transactionType", value: (r) => r.transactionType,                   width: 10 },
      { header: "Amount ($)",     key: "amount",          value: (r) => (r.amountCents / 100).toFixed(2),    width: 14 },
      { header: "Description",    key: "description",     value: (r) => r.description,                       width: 40 },
      { header: "Payment Method", key: "paymentMethod",   value: (r) => (r as any).paymentMethod ?? "",      width: 18 },
      { header: "Reference",      key: "referenceNumber", value: (r) => (r as any).referenceNumber ?? "",    width: 18 },
      { header: "Status",         key: "txnStatus",       value: (r) => (r as any).txnStatus ?? "",          width: 12 },
    ];
    if (format === "csv")  return sendCsv(res, meta, columns, rows);
    if (format === "xlsx") return sendXlsx(res, meta, [{ name: "Transactions", columns, rows }]);
    return sendPdf(res, meta, columns, rows);
  }),
);

// POST /treasurer/receipts/request-url — presigned URL for receipt upload
router.post(
  "/treasurer/receipts/request-url",
  requirePermGroup("manage_finances")(async (req, res) => {
    const parsed = z.object({
      name: z.string().min(1).max(300),
      size: z.number().int().positive().max(20 * 1024 * 1024),
      contentType: z.string().min(1),
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL("finances");
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath, metadata: parsed.data });
    } catch (err) {
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  }),
);

export default router;
