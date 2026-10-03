CREATE TYPE "public"."comment_status_enum" AS ENUM('VISIBLE', 'HIDDEN');--> statement-breakpoint
CREATE TYPE "public"."post_kind_enum" AS ENUM('ARTICLE', 'EVENT');--> statement-breakpoint
CREATE TYPE "public"."post_status_enum" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'REMOVED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "church_profiles" (
	"group_id" uuid PRIMARY KEY NOT NULL,
	"about" text DEFAULT '' NOT NULL,
	"address" varchar(300),
	"mass_times" varchar(1000),
	"phone" varchar(40),
	"website" varchar(300),
	"cover_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comment_reports" (
	"comment_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reports_comment_id_member_id_pk" PRIMARY KEY("comment_id","member_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"body" varchar(2000) NOT NULL,
	"status" "comment_status_enum" DEFAULT 'VISIBLE' NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "post_kind_enum" NOT NULL,
	"status" "post_status_enum" DEFAULT 'DRAFT' NOT NULL,
	"author_user_id" uuid,
	"author_member_id" uuid,
	"church_id" uuid,
	"title" varchar(160) NOT NULL,
	"summary" varchar(280) DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"cover_key" text,
	"youtube_id" varchar(20),
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"place" varchar(200),
	"online_url" text,
	"submitted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_one_author_chk" CHECK (("posts"."author_user_id" IS NULL) <> ("posts"."author_member_id" IS NULL)),
	CONSTRAINT "posts_event_chk" CHECK ("posts"."kind" <> 'EVENT' OR "posts"."status" IN ('DRAFT','REJECTED') OR "posts"."starts_at" IS NOT NULL),
	CONSTRAINT "posts_live_chk" CHECK ("posts"."status" <> 'APPROVED' OR "posts"."published_at" IS NOT NULL)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "church_profiles" ADD CONSTRAINT "church_profiles_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_comment_id_post_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."post_comments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_author_member_id_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_church_id_groups_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_comments_post_idx" ON "post_comments" USING btree ("post_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_comments_reports_idx" ON "post_comments" USING btree ("report_count");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_feed_idx" ON "posts" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_events_idx" ON "posts" USING btree ("status","kind","starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_church_idx" ON "posts" USING btree ("church_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_author_member_idx" ON "posts" USING btree ("author_member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_author_user_idx" ON "posts" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_queue_idx" ON "posts" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_fts_idx" ON "posts" USING gin (to_tsvector('english', "title" || ' ' || "summary" || ' ' || "body"));
