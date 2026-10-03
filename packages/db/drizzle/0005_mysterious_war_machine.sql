CREATE TYPE "public"."media_access_enum" AS ENUM('FREE', 'SUBSCRIBER');--> statement-breakpoint
CREATE TYPE "public"."media_kind_enum" AS ENUM('AUDIO', 'MIDI', 'STAFF_PDF', 'SOLFA_PDF', 'YOUTUBE');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hymn_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" varchar(200) NOT NULL,
	"country" char(2),
	"publisher" varchar(200),
	"sort_order" smallint DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hymn_books_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hymn_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tune_id" uuid NOT NULL,
	"kind" "media_kind_enum" NOT NULL,
	"label" varchar(60) NOT NULL,
	"access" "media_access_enum" NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"object_key" text,
	"content_type" varchar(100),
	"bytes" integer,
	"duration_sec" integer,
	"youtube_id" varchar(11),
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hymn_media_source_chk" CHECK (("hymn_media"."kind" = 'YOUTUBE') = ("hymn_media"."youtube_id" IS NOT NULL) AND ("hymn_media"."kind" = 'YOUTUBE') = ("hymn_media"."object_key" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hymn_numbers" (
	"hymn_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"number" varchar(8) NOT NULL,
	"sort_key" integer NOT NULL,
	CONSTRAINT "hymn_numbers_hymn_id_book_id_pk" PRIMARY KEY("hymn_id","book_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hymn_tags" (
	"hymn_id" uuid NOT NULL,
	"tag" varchar(50) NOT NULL,
	CONSTRAINT "hymn_tags_hymn_id_tag_pk" PRIMARY KEY("hymn_id","tag")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hymn_tunes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hymn_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"composer" varchar(200),
	"meter" varchar(40),
	"is_default" boolean DEFAULT false NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hymns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" varchar(200),
	"first_line" varchar(300) NOT NULL,
	"author" varchar(200),
	"verses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" varchar(200),
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hymns_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hymn_media" ADD CONSTRAINT "hymn_media_tune_id_hymn_tunes_id_fk" FOREIGN KEY ("tune_id") REFERENCES "public"."hymn_tunes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hymn_numbers" ADD CONSTRAINT "hymn_numbers_hymn_id_hymns_id_fk" FOREIGN KEY ("hymn_id") REFERENCES "public"."hymns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hymn_numbers" ADD CONSTRAINT "hymn_numbers_book_id_hymn_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."hymn_books"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hymn_tags" ADD CONSTRAINT "hymn_tags_hymn_id_hymns_id_fk" FOREIGN KEY ("hymn_id") REFERENCES "public"."hymns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hymn_tunes" ADD CONSTRAINT "hymn_tunes_hymn_id_hymns_id_fk" FOREIGN KEY ("hymn_id") REFERENCES "public"."hymns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hymn_media_tune_idx" ON "hymn_media" USING btree ("tune_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hymn_media_one_default_audio_uq" ON "hymn_media" USING btree ("tune_id") WHERE "hymn_media"."is_default" AND "hymn_media"."kind" = 'AUDIO';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hymn_numbers_book_number_uq" ON "hymn_numbers" USING btree ("book_id","number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hymn_numbers_number_idx" ON "hymn_numbers" USING btree ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hymn_tags_tag_idx" ON "hymn_tags" USING btree ("tag");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hymn_tunes_hymn_idx" ON "hymn_tunes" USING btree ("hymn_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hymn_tunes_one_default_uq" ON "hymn_tunes" USING btree ("hymn_id") WHERE "hymn_tunes"."is_default";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hymns_fts_idx" ON "hymns" USING gin (to_tsvector('english', coalesce("title", '') || ' ' || "first_line" || ' ' || "verses"::text));