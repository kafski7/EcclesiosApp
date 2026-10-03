CREATE TYPE "public"."news_category_enum" AS ENUM('ANNOUNCEMENT', 'UPDATE', 'NOTICE');--> statement-breakpoint
CREATE TYPE "public"."news_status_enum" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hymn_picks" (
	"date" date PRIMARY KEY NOT NULL,
	"hymn_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" varchar(140) NOT NULL,
	"summary" varchar(280) NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"category" "news_category_enum" DEFAULT 'ANNOUNCEMENT' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"link_url" varchar(500),
	"link_label" varchar(40),
	"cover_key" text,
	"status" "news_status_enum" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"author_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_slug_unique" UNIQUE("slug"),
	CONSTRAINT "news_live_chk" CHECK ("news"."status" = 'DRAFT' OR "news"."published_at" IS NOT NULL)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hymn_picks" ADD CONSTRAINT "hymn_picks_hymn_id_hymns_id_fk" FOREIGN KEY ("hymn_id") REFERENCES "public"."hymns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "news" ADD CONSTRAINT "news_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "news_live_idx" ON "news" USING btree ("status","published_at");
