CREATE TYPE "public"."teaching_status_enum" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teaching_relations" (
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "teaching_relations_from_id_to_id_pk" PRIMARY KEY("from_id","to_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teaching_topic_links" (
	"teaching_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "teaching_topic_links_teaching_id_topic_id_pk" PRIMARY KEY("teaching_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teaching_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" varchar(400) DEFAULT '' NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teaching_topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teachings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" varchar(160) NOT NULL,
	"summary" varchar(300) NOT NULL,
	"body" text NOT NULL,
	"plain" text DEFAULT '' NOT NULL,
	"reading_minutes" smallint DEFAULT 1 NOT NULL,
	"reviewed_by" varchar(160),
	"source" varchar(200),
	"status" "teaching_status_enum" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teachings_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teaching_relations" ADD CONSTRAINT "teaching_relations_from_id_teachings_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."teachings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teaching_relations" ADD CONSTRAINT "teaching_relations_to_id_teachings_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."teachings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teaching_topic_links" ADD CONSTRAINT "teaching_topic_links_teaching_id_teachings_id_fk" FOREIGN KEY ("teaching_id") REFERENCES "public"."teachings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teaching_topic_links" ADD CONSTRAINT "teaching_topic_links_topic_id_teaching_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."teaching_topics"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teaching_topic_links_topic_idx" ON "teaching_topic_links" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teachings_status_idx" ON "teachings" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teachings_fts_idx" ON "teachings" USING gin ((setweight(to_tsvector('english', "title"), 'A') || setweight(to_tsvector('english', "summary"), 'B') || setweight(to_tsvector('english', "plain"), 'C')));
