CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"check_in_time" timestamp with time zone DEFAULT now() NOT NULL,
	"method" varchar(16) DEFAULT 'QrScan' NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"correction_reason" text,
	"corrected_by" integer,
	"semester" varchar(24) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"target_type" varchar(40) NOT NULL,
	"target_id" integer NOT NULL,
	"action" varchar(80) NOT NULL,
	"before" text,
	"after" text,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "committee_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"committee_id" integer NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"assigned_at" date NOT NULL,
	"unassigned_at" date,
	"assigned_by" integer,
	"semester_label" varchar(24),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "committees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"four_for_future_alignment" varchar(80) DEFAULT '' NOT NULL,
	"chair_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "committees_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"event_type" varchar(32) NOT NULL,
	"committee_id" integer,
	"created_by" integer NOT NULL,
	"date" date NOT NULL,
	"start_time" varchar(8) NOT NULL,
	"end_time" varchar(8) NOT NULL,
	"location" varchar(200) NOT NULL,
	"point_value" integer DEFAULT 10 NOT NULL,
	"impact_multiplier" numeric(4, 2) DEFAULT '1.00' NOT NULL,
	"qr_active" boolean DEFAULT false NOT NULL,
	"check_in_window_minutes" integer DEFAULT 30 NOT NULL,
	"current_qr_token" varchar(80),
	"current_qr_expires_at" timestamp with time zone,
	"status" varchar(16) DEFAULT 'Upcoming' NOT NULL,
	"semester" varchar(24) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"auth_id" varchar NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"email" varchar(200) NOT NULL,
	"phone" varchar(32),
	"student_id" varchar(32),
	"gpa" numeric(4, 2),
	"graduation_year" integer,
	"role" varchar(32) DEFAULT 'Member' NOT NULL,
	"committee_id" integer,
	"membership_status" varchar(32) DEFAULT 'Active' NOT NULL,
	"dues_paid" boolean DEFAULT false NOT NULL,
	"date_joined" timestamp with time zone DEFAULT now() NOT NULL,
	"nudge_status" varchar(16) DEFAULT 'Active' NOT NULL,
	"streak_count" integer DEFAULT 0 NOT NULL,
	"account_active" boolean DEFAULT true NOT NULL,
	"last_login" timestamp with time zone,
	"profile_image_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_auth_id_unique" UNIQUE("auth_id")
);
--> statement-breakpoint
CREATE TABLE "nudge_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"nudge_type" varchar(40) NOT NULL,
	"message_content" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivery_channel" varchar(16) DEFAULT 'InApp' NOT NULL,
	"trigger_reason" text DEFAULT '' NOT NULL,
	"member_status_at_send" varchar(16) DEFAULT 'Active' NOT NULL,
	"response_action" text,
	"read" boolean DEFAULT false NOT NULL,
	"semester" varchar(24) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "officer_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"position" varchar(80) NOT NULL,
	"position_type" varchar(20) DEFAULT 'elected' NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"semester_label" varchar(24),
	"appointed_by" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"university_name" varchar(120) NOT NULL,
	"chapter_name" varchar(120) NOT NULL,
	"chapter_identifier" varchar(60) NOT NULL,
	"motto" varchar(200),
	"primary_color" varchar(40) DEFAULT 'hsl(221 100% 31%)' NOT NULL,
	"secondary_color" varchar(40) DEFAULT '#C9A227' NOT NULL,
	"logo_url" varchar(512),
	"participation_goal_pct" numeric(5, 2) DEFAULT '75.00' NOT NULL,
	"scholarship_min_pct" numeric(5, 2) DEFAULT '80.00' NOT NULL,
	"conference_min_pct" numeric(5, 2) DEFAULT '85.00' NOT NULL,
	"awards_min_pct" numeric(5, 2) DEFAULT '90.00' NOT NULL,
	"dues_amount_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semester_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"semester" varchar(24) NOT NULL,
	"participation_threshold" numeric(4, 2) DEFAULT '75.00' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "semester_config_semester_unique" UNIQUE("semester")
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_corrected_by_members_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_members_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_assignments" ADD CONSTRAINT "committee_assignments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_assignments" ADD CONSTRAINT "committee_assignments_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_assignments" ADD CONSTRAINT "committee_assignments_assigned_by_members_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_auth_id_users_id_fk" FOREIGN KEY ("auth_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nudge_logs" ADD CONSTRAINT "nudge_logs_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officer_terms" ADD CONSTRAINT "officer_terms_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officer_terms" ADD CONSTRAINT "officer_terms_appointed_by_members_id_fk" FOREIGN KEY ("appointed_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "attendance_user_idx" ON "attendance" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attendance_event_idx" ON "attendance" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "comm_assign_member_idx" ON "committee_assignments" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "comm_assign_committee_idx" ON "committee_assignments" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_committee_idx" ON "events" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "members_committee_idx" ON "members" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX "nudge_logs_user_idx" ON "nudge_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nudge_logs_sent_idx" ON "nudge_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "officer_terms_member_idx" ON "officer_terms" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "officer_terms_ended_idx" ON "officer_terms" USING btree ("ended_at");