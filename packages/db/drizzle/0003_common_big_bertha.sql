CREATE TABLE IF NOT EXISTS "bible_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" varchar(120) NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"attribution" text NOT NULL,
	"licence" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"offline_allowed" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bible_translations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bible_verses" (
	"translation_id" integer NOT NULL,
	"book" varchar(3) NOT NULL,
	"chapter" smallint NOT NULL,
	"verse" smallint NOT NULL,
	"text" text NOT NULL,
	"woj" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bible_verses" ADD CONSTRAINT "bible_verses_translation_id_bible_translations_id_fk" FOREIGN KEY ("translation_id") REFERENCES "public"."bible_translations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bible_translations_one_default_uq" ON "bible_translations" USING btree ("is_default") WHERE "bible_translations"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bible_verses_ref_uq" ON "bible_verses" USING btree ("translation_id","book","chapter","verse");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bible_verses_fts_idx" ON "bible_verses" USING gin (to_tsvector('english', "text"));
