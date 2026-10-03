CREATE TYPE "public"."episode_media_kind_enum" AS ENUM('AUDIO', 'YOUTUBE', 'VIDEO');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "podcast_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"label" varchar(80) NOT NULL,
	"object_key" text NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"bytes" integer,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "podcast_episodes" DROP CONSTRAINT "podcast_episodes_live_chk";--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD COLUMN "media_kind" "episode_media_kind_enum" DEFAULT 'AUDIO' NOT NULL;--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD COLUMN "youtube_id" varchar(11);--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD COLUMN "access" "media_access_enum" DEFAULT 'FREE' NOT NULL;--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD COLUMN "transcript" text DEFAULT '' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "podcast_attachments" ADD CONSTRAINT "podcast_attachments_episode_id_podcast_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."podcast_episodes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcast_attachments_episode_idx" ON "podcast_attachments" USING btree ("episode_id");--> statement-breakpoint
ALTER TABLE "podcast_episodes" ADD CONSTRAINT "podcast_episodes_live_chk" CHECK ("podcast_episodes"."status" = 'DRAFT' OR ("podcast_episodes"."published_at" IS NOT NULL AND (("podcast_episodes"."media_kind" = 'AUDIO' AND "podcast_episodes"."audio_key" IS NOT NULL) OR ("podcast_episodes"."media_kind" = 'YOUTUBE' AND "podcast_episodes"."youtube_id" IS NOT NULL))));
