CREATE TYPE "public"."message_channel_enum" AS ENUM('SMS', 'EMAIL', 'IN_APP');--> statement-breakpoint
CREATE TYPE "public"."message_recipient_status_enum" AS ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."message_status_enum" AS ENUM('QUEUED', 'SENDING', 'SENT', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."notification_channel_enum" AS ENUM('IN_APP', 'SMS', 'EMAIL', 'PUSH');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "digest_runs" (
	"kind" varchar(40) NOT NULL,
	"day" date NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "digest_runs_kind_day_pk" PRIMARY KEY("kind","day")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"member_id" uuid,
	"group_id" uuid,
	"name" varchar(210) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"destination" varchar(254),
	"status" "message_recipient_status_enum" DEFAULT 'PENDING' NOT NULL,
	"segments" integer DEFAULT 0 NOT NULL,
	"error" varchar(300),
	"provider_ref" varchar(120),
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"sender_member_id" uuid,
	"channel" "message_channel_enum" NOT NULL,
	"subject" varchar(150),
	"body" text NOT NULL,
	"audience" jsonb NOT NULL,
	"audience_label" varchar(200) NOT NULL,
	"is_broadcast" boolean DEFAULT false NOT NULL,
	"status" "message_status_enum" DEFAULT 'QUEUED' NOT NULL,
	"failure_reason" varchar(60),
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"subscription_id" uuid,
	"sms_charged" integer DEFAULT 0 NOT NULL,
	"sms_refunded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "messages_sms_chk" CHECK ("messages"."sms_refunded" <= "messages"."sms_charged")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"member_id" uuid NOT NULL,
	"type_id" integer NOT NULL,
	"channel" "notification_channel_enum" NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_member_id_type_id_channel_pk" PRIMARY KEY("member_id","type_id","channel")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_member_id_members_id_fk" FOREIGN KEY ("sender_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_type_id_notification_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."notification_types"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_recipients_message_status_idx" ON "message_recipients" USING btree ("message_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "message_recipients_message_member_uq" ON "message_recipients" USING btree ("message_id","member_id") WHERE "message_recipients"."member_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_group_time_idx" ON "messages" USING btree ("group_id","created_at");