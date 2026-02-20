CREATE TABLE IF NOT EXISTS "checkpoints" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"cursor" text,
	"events_ingested" bigint DEFAULT 0,
	"started_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text,
	"session_id" text,
	"user_id" text,
	"name" text,
	"timestamp" timestamp with time zone NOT NULL,
	"raw" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now()
);
