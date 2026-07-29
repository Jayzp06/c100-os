import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { membersTable } from "./c100";
import { organizationsTable } from "./orgs";

// ─── Treasurer financial system ────────────────────────────────────────────
// Schema groundwork for the Treasurer workspace (Phase 10). Kept additive and
// isolated in its own file so financial data has no coupling to the core
// membership/event tables beyond simple references.

export const FINANCIAL_ACCOUNT_TYPE_VALUES = [
  "Checking",
  "Savings",
  "CashBox",
  "Other",
] as const;
export type FinancialAccountType =
  (typeof FINANCIAL_ACCOUNT_TYPE_VALUES)[number];

export const financialAccountsTable = pgTable("financial_accounts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(
    () => organizationsTable.id,
    { onDelete: "set null" },
  ),
  name: varchar("name", { length: 120 }).notNull(),
  accountType: varchar("account_type", { length: 24 })
    .notNull()
    .default("Checking"),
  balanceCents: integer("balance_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FinancialAccount = typeof financialAccountsTable.$inferSelect;

export const budgetCategoriesTable = pgTable("budget_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  semesterLabel: varchar("semester_label", { length: 24 }).notNull(),
  allocatedCents: integer("allocated_cents").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BudgetCategory = typeof budgetCategoriesTable.$inferSelect;

export const TRANSACTION_TYPE_VALUES = ["Income", "Expense"] as const;
export type TransactionType = (typeof TRANSACTION_TYPE_VALUES)[number];

export const financialTransactionsTable = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .notNull()
    .references(() => financialAccountsTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(
    () => budgetCategoriesTable.id,
    { onDelete: "set null" },
  ),
  transactionType: varchar("transaction_type", { length: 16 }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  description: text("description").notNull().default(""),
  transactionDate: date("transaction_date").notNull(),
  relatedEventId: integer("related_event_id"),
  receiptUrl: varchar("receipt_url", { length: 500 }),
  recordedBy: integer("recorded_by").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FinancialTransaction =
  typeof financialTransactionsTable.$inferSelect;

export const REIMBURSEMENT_STATUS_VALUES = [
  "Pending",
  "Approved",
  "Denied",
  "Paid",
] as const;
export type ReimbursementStatus =
  (typeof REIMBURSEMENT_STATUS_VALUES)[number];

export const reimbursementRequestsTable = pgTable("reimbursement_requests", {
  id: serial("id").primaryKey(),
  requestedBy: integer("requested_by")
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(
    () => budgetCategoriesTable.id,
    { onDelete: "set null" },
  ),
  amountCents: integer("amount_cents").notNull(),
  description: text("description").notNull().default(""),
  receiptUrl: varchar("receipt_url", { length: 500 }),
  status: varchar("status", { length: 16 }).notNull().default("Pending"),
  approvedBy: integer("approved_by").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionNotes: text("decision_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ReimbursementRequest =
  typeof reimbursementRequestsTable.$inferSelect;

// ─── Dues ledger (Treasurer workspace) ─────────────────────────────────────

export const DUES_LEDGER_STATUS_VALUES = [
  "Outstanding",
  "Paid",
  "Waived",
] as const;
export type DuesLedgerStatus = (typeof DUES_LEDGER_STATUS_VALUES)[number];

export const duesLedgerTable = pgTable("dues_ledger", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id")
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  semesterLabel: varchar("semester_label", { length: 24 }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }),
  referenceNumber: varchar("reference_number", { length: 100 }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  status: varchar("status", { length: 16 }).notNull().default("Outstanding"),
  notes: text("notes"),
  recordedById: integer("recorded_by").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type DuesLedger = typeof duesLedgerTable.$inferSelect;

// ─── Receipt attachments (Treasurer workspace) ──────────────────────────────

export const receiptAttachmentsTable = pgTable("receipt_attachments", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id")
    .notNull()
    .references(() => financialTransactionsTable.id, { onDelete: "cascade" }),
  storageKey: varchar("storage_key", { length: 500 }).notNull(),
  originalFilename: varchar("original_filename", { length: 300 }).notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  uploadedById: integer("uploaded_by").references(() => membersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ReceiptAttachment = typeof receiptAttachmentsTable.$inferSelect;
