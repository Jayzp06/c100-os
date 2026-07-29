-- Chief of Staff workspace schema migration
-- Adds executive_tasks and executive_task_collaborators tables.
-- Idempotent: uses IF NOT EXISTS throughout.

CREATE TABLE IF NOT EXISTS "executive_tasks" (
  "id"                    serial PRIMARY KEY NOT NULL,
  "title"                 varchar(300) NOT NULL,
  "description"           text,
  "owner_id"              integer NOT NULL
                            REFERENCES "members"("id") ON DELETE RESTRICT,
  "priority"              varchar(16) NOT NULL DEFAULT 'medium',
  "status"                varchar(16) NOT NULL DEFAULT 'not_started',
  "due_date"              date,
  "completion_date"       timestamp with time zone,
  "related_workspace"     varchar(64),
  "related_source_record" varchar(200),
  "source_meeting_id"     integer
                            REFERENCES "executive_meetings"("id") ON DELETE SET NULL,
  "source_event_id"       integer
                            REFERENCES "events"("id") ON DELETE SET NULL,
  "notes"                 text,
  "created_by_id"         integer
                            REFERENCES "members"("id") ON DELETE SET NULL,
  "updated_by_id"         integer
                            REFERENCES "members"("id") ON DELETE SET NULL,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "executive_task_collaborators" (
  "id"          serial PRIMARY KEY NOT NULL,
  "task_id"     integer NOT NULL
                  REFERENCES "executive_tasks"("id") ON DELETE CASCADE,
  "member_id"   integer NOT NULL
                  REFERENCES "members"("id") ON DELETE CASCADE,
  "added_by_id" integer
                  REFERENCES "members"("id") ON DELETE SET NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "uq_task_collaborator" UNIQUE ("task_id", "member_id")
);
