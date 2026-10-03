CREATE TYPE "public"."episode_status_enum" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "podcast_episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"podcast_id" uuid NOT NULL,
	"number" smallint,
	"title" varchar(200) NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"audio_key" text,
	"content_type" varchar(100),
	"bytes" integer,
	"duration_sec" integer,
	"status" "episode_status_enum" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "podcast_episodes_live_chk" CHECK ("podcast_episodes"."status" = 'DRAFT' OR ("podcast_episodes"."audio_key" IS NOT NULL AND "podcast_episodes"."published_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "podcast_follows" (
	"member_id" uuid NOT NULL,
	"podcast_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "podcast_follows_member_id_podcast_id_pk" PRIMARY KEY("member_id","podcast_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "podcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" varchar(160) NOT NULL,
	"summary" varchar(280) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" varchar(40),
	"cover_key" text,
	"owner_user_id" uuid,
	"owner_member_id" uuid,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "podcasts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "podcasts_one_owner_chk" CHECK (("podcasts"."owner_user_id" IS NULL) <> ("podcasts"."owner_member_id" IS NULL))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "podcast_episodes" ADD CONSTRAINT "podcast_episodes_podcast_id_podcasts_id_fk" FOREIGN KEY ("podcast_id") REFERENCES "public"."podcasts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "podcast_follows" ADD CONSTRAINT "podcast_follows_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "podcast_follows" ADD CONSTRAINT "podcast_follows_podcast_id_podcasts_id_fk" FOREIGN KEY ("podcast_id") REFERENCES "public"."podcasts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "podcasts" ADD CONSTRAINT "podcasts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "podcasts" ADD CONSTRAINT "podcasts_owner_member_id_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcast_episodes_feed_idx" ON "podcast_episodes" USING btree ("podcast_id","status","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "podcast_episodes_number_uq" ON "podcast_episodes" USING btree ("podcast_id","number") WHERE "podcast_episodes"."number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcast_follows_podcast_idx" ON "podcast_follows" USING btree ("podcast_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcasts_owner_user_idx" ON "podcasts" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcasts_owner_member_idx" ON "podcasts" USING btree ("owner_member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcasts_fts_idx" ON "podcasts" USING gin (to_tsvector('english', "title" || ' ' || "summary" || ' ' || "description"));
