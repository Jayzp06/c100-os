CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"short_name" varchar(64),
	"logo_url" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "desktop_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" varchar(32) NOT NULL,
	"version" varchar(32) NOT NULL,
	"release_notes" text,
	"pub_date" timestamp with time zone NOT NULL,
	"platforms" text NOT NULL,
	"published_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_org_roles" (
	"member_id" integer NOT NULL,
	"org_role_id" integer NOT NULL,
	"granted_by" integer,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "member_org_roles_member_id_org_role_id_pk" PRIMARY KEY("member_id","org_role_id")
);
--> statement-breakpoint
CREATE TABLE "member_system_roles" (
	"member_id" integer NOT NULL,
	"system_role_id" integer NOT NULL,
	"granted_by" integer,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_system_roles_member_id_system_role_id_pk" PRIMARY KEY("member_id","system_role_id")
);
--> statement-breakpoint
CREATE TABLE "org_role_permissions" (
	"org_role_id" integer NOT NULL,
	"perm_group_id" integer NOT NULL,
	CONSTRAINT "org_role_permissions_org_role_id_perm_group_id_pk" PRIMARY KEY("org_role_id","perm_group_id")
);
--> statement-breakpoint
CREATE TABLE "org_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"tier" varchar(48) NOT NULL,
	"description" text,
	"is_builtin" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"scope" varchar(16) DEFAULT 'org' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permission_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"group_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "role_incompatibilities" (
	"org_role_a_id" integer NOT NULL,
	"org_role_b_id" integer NOT NULL,
	CONSTRAINT "role_incompatibilities_org_role_a_id_org_role_b_id_pk" PRIMARY KEY("org_role_a_id","org_role_b_id")
);
--> statement-breakpoint
CREATE TABLE "sync_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_type" varchar(64) NOT NULL,
	"resource_id" integer NOT NULL,
	"action" varchar(32) NOT NULL,
	"payload" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_role_permissions" (
	"system_role_id" integer NOT NULL,
	"perm_group_id" integer NOT NULL,
	CONSTRAINT "system_role_permissions_system_role_id_perm_group_id_pk" PRIMARY KEY("system_role_id","perm_group_id")
);
--> statement-breakpoint
CREATE TABLE "system_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"is_builtin" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "org_settings" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "desktop_releases" ADD CONSTRAINT "desktop_releases_published_by_members_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_org_roles" ADD CONSTRAINT "member_org_roles_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_org_roles" ADD CONSTRAINT "member_org_roles_org_role_id_org_roles_id_fk" FOREIGN KEY ("org_role_id") REFERENCES "public"."org_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_org_roles" ADD CONSTRAINT "member_org_roles_granted_by_members_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_system_roles" ADD CONSTRAINT "member_system_roles_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_system_roles" ADD CONSTRAINT "member_system_roles_system_role_id_system_roles_id_fk" FOREIGN KEY ("system_role_id") REFERENCES "public"."system_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_system_roles" ADD CONSTRAINT "member_system_roles_granted_by_members_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_role_permissions" ADD CONSTRAINT "org_role_permissions_org_role_id_org_roles_id_fk" FOREIGN KEY ("org_role_id") REFERENCES "public"."org_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_role_permissions" ADD CONSTRAINT "org_role_permissions_perm_group_id_permission_groups_id_fk" FOREIGN KEY ("perm_group_id") REFERENCES "public"."permission_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_roles" ADD CONSTRAINT "org_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_group_id_permission_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."permission_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_incompatibilities" ADD CONSTRAINT "role_incompatibilities_org_role_a_id_org_roles_id_fk" FOREIGN KEY ("org_role_a_id") REFERENCES "public"."org_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_incompatibilities" ADD CONSTRAINT "role_incompatibilities_org_role_b_id_org_roles_id_fk" FOREIGN KEY ("org_role_b_id") REFERENCES "public"."org_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_role_permissions" ADD CONSTRAINT "system_role_permissions_system_role_id_system_roles_id_fk" FOREIGN KEY ("system_role_id") REFERENCES "public"."system_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_role_permissions" ADD CONSTRAINT "system_role_permissions_perm_group_id_permission_groups_id_fk" FOREIGN KEY ("perm_group_id") REFERENCES "public"."permission_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;