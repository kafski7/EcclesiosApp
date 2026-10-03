CREATE TYPE "public"."liturgical_color_enum" AS ENUM('GREEN', 'VIOLET', 'WHITE', 'RED', 'ROSE', 'BLACK');--> statement-breakpoint
CREATE TYPE "public"."reading_kind_enum" AS ENUM('FIRST', 'PSALM', 'SECOND', 'ALLELUIA', 'GOSPEL');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reading_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"celebration" varchar(200),
	"color" "liturgical_color_enum",
	"source" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_days_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reading_day_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"kind" "reading_kind_enum" NOT NULL,
	"citation" varchar(120) NOT NULL,
	"response" text,
	"text" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readings_position_chk" CHECK ("readings"."position" BETWEEN 0 AND 20)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "readings" ADD CONSTRAINT "readings_reading_day_id_reading_days_id_fk" FOREIGN KEY ("reading_day_id") REFERENCES "public"."reading_days"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "readings_day_position_uq" ON "readings" USING btree ("reading_day_id","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "readings_day_idx" ON "readings" USING btree ("reading_day_id");
