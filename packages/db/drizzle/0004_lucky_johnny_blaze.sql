CREATE TYPE "public"."celebration_rank_enum" AS ENUM('SOLEMNITY', 'FEAST', 'MEMORIAL', 'OPTIONAL_MEMORIAL', 'COMMEMORATION');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"title" varchar(120),
	"feast_month" smallint NOT NULL,
	"feast_day" smallint NOT NULL,
	"rank" "celebration_rank_enum" NOT NULL,
	"summary" varchar(280) NOT NULL,
	"patronage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"born" varchar(60),
	"died" varchar(60),
	"biography" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" varchar(200),
	"image_key" text,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saints_slug_unique" UNIQUE("slug"),
	CONSTRAINT "saints_feast_chk" CHECK ("saints"."feast_month" BETWEEN 1 AND 12 AND "saints"."feast_day" BETWEEN 1 AND 31)
);
--> statement-breakpoint
ALTER TABLE "bible_translations" ADD COLUMN "psalm_numbering" varchar(8) DEFAULT 'HEBREW' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saints_feast_idx" ON "saints" USING btree ("feast_month","feast_day");
