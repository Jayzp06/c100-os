-- Migration 0004: Officer Workspaces Foundation
-- Creates tables for the six officer workspace domains:
-- Governance (Bylaws), Secretary, Treasurer (extend), Historian,
-- Sergeant-at-Arms, and Parliamentarian.

CREATE TABLE "governance_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar(200) NOT NULL,
  "category" varchar(32) DEFAULT 'Other' NOT NULL,
  "version_label" varchar(50) DEFAULT '1.0' NOT NULL,
  "effective_date" varchar(20) NOT NULL,
  "approval_date" varchar(20),
  "status" varchar(16) DEFAULT 'draft' NOT NULL,
  "notes" text,
  "original_filename" varchar(300),
  "mime_type" varchar(100),
  "file_size_bytes" integer,
  "storage_key" varchar(500),
  "uploaded_by" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "created_by" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "updated_by" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "meeting_type" varchar(32) NOT NULL,
  "title" varchar(200) NOT NULL,
  "meeting_date" varchar(20) NOT NULL,
  "status" varchar(16) DEFAULT 'draft' NOT NULL,
  "agenda_text" text,
  "notes" text,
  "prepared_by" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "approved_by" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_record_revisions" (
  "id" serial PRIMARY KEY NOT NULL,
  "meeting_record_id" integer NOT NULL REFERENCES "meeting_records"("id") ON DELETE CASCADE,
  "revision_number" integer DEFAULT 1 NOT NULL,
  "reason" text DEFAULT '' NOT NULL,
  "snapshot" text DEFAULT '{}' NOT NULL,
  "revised_by" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "revised_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "correspondence_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "direction" varchar(16) NOT NULL,
  "correspondent" varchar(200) NOT NULL,
  "subject" varchar(300) NOT NULL,
  "date_sent" varchar(20) NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "attachment_storage_key" varchar(500),
  "created_by" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dues_ledger" (
  "id" serial PRIMARY KEY NOT NULL,
  "member_id" integer NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "semester_label" varchar(24) NOT NULL,
  "amount_cents" integer NOT NULL,
  "payment_method" varchar(50),
  "reference_number" varchar(100),
  "paid_at" timestamp with time zone,
  "status" varchar(16) DEFAULT 'Outstanding' NOT NULL,
  "notes" text,
  "recorded_by" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_transactions"
  ADD COLUMN IF NOT EXISTS "payment_method" varchar(50),
  ADD COLUMN IF NOT EXISTS "reference_number" varchar(100),
  ADD COLUMN IF NOT EXISTS "txn_status" varchar(16) DEFAULT 'Cleared';
--> statement-breakpoint
CREATE TABLE "receipt_attachments" (
  "id" serial PRIMARY KEY NOT NULL,
  "transaction_id" integer NOT NULL REFERENCES "financial_transactions"("id") ON DELETE CASCADE,
  "storage_key" varchar(500) NOT NULL,
  "original_filename" varchar(300) NOT NULL,
  "file_size_bytes" integer,
  "uploaded_by" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "archive_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "event_date" varchar(20) NOT NULL,
  "category" varchar(32) DEFAULT 'Other' NOT NULL,
  "people_text" text,
  "member_refs" text DEFAULT '[]' NOT NULL,
  "storage_key" varchar(500),
  "original_filename" varchar(300),
  "visibility" varchar(16) DEFAULT 'Officers' NOT NULL,
  "tags" text DEFAULT '[]' NOT NULL,
  "created_by" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conduct_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "record_type" varchar(32) NOT NULL,
  "report_date" varchar(20) NOT NULL,
  "member_id" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "event_id" integer REFERENCES "events"("id") ON DELETE SET NULL,
  "summary" text NOT NULL,
  "private_details" text DEFAULT '' NOT NULL,
  "status" varchar(16) DEFAULT 'Open' NOT NULL,
  "resolution" text,
  "reporter_id" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "motions" (
  "id" serial PRIMARY KEY NOT NULL,
  "motion_text" text NOT NULL,
  "meeting_record_id" integer REFERENCES "meeting_records"("id") ON DELETE SET NULL,
  "mover_id" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "seconder_id" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "result" varchar(16) DEFAULT 'Other' NOT NULL,
  "vote_yes" integer DEFAULT 0 NOT NULL,
  "vote_no" integer DEFAULT 0 NOT NULL,
  "vote_abstain" integer DEFAULT 0 NOT NULL,
  "governance_doc_id" integer REFERENCES "governance_documents"("id") ON DELETE SET NULL,
  "governance_ref" varchar(200),
  "notes" text,
  "created_by" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parliamentary_rulings" (
  "id" serial PRIMARY KEY NOT NULL,
  "ruling_text" text NOT NULL,
  "authority_source" varchar(300) NOT NULL,
  "meeting_record_id" integer REFERENCES "meeting_records"("id") ON DELETE SET NULL,
  "governance_doc_id" integer REFERENCES "governance_documents"("id") ON DELETE SET NULL,
  "governance_ref" varchar(200),
  "created_by" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quorum_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "meeting_record_id" integer REFERENCES "meeting_records"("id") ON DELETE SET NULL,
  "total_membership" integer NOT NULL,
  "quorum_threshold" integer NOT NULL,
  "members_present" integer NOT NULL,
  "quorum_met" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "created_by" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
