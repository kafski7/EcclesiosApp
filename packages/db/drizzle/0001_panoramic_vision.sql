CREATE TYPE "public"."home_transfer_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."membership_status_enum" AS ENUM('PENDING', 'ACTIVE', 'REJECTED', 'LEFT');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "follows" (
	"member_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_member_id_group_id_pk" PRIMARY KEY("member_id","group_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "home_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"from_group_id" uuid,
	"to_group_id" uuid NOT NULL,
	"status" "home_transfer_status_enum" DEFAULT 'PENDING' NOT NULL,
	"reason" text,
	"decided_by_member_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "home_transfers_not_same_chk" CHECK ("home_transfers"."from_group_id" IS DISTINCT FROM "home_transfers"."to_group_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_privileges" (
	"member_id" uuid NOT NULL,
	"privilege" "platform_privilege_enum" NOT NULL,
	"granted_by_user_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_privileges_member_id_privilege_pk" PRIMARY KEY("member_id","privilege")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"role_id" integer NOT NULL,
	"status" "membership_status_enum" DEFAULT 'PENDING' NOT NULL,
	"is_home" boolean DEFAULT false NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by_member_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_home_live_chk" CHECK (NOT "memberships"."is_home" OR "memberships"."status" IN ('PENDING','ACTIVE')),
	CONSTRAINT "memberships_decided_chk" CHECK ("memberships"."status" NOT IN ('ACTIVE','REJECTED') OR "memberships"."decided_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "members" DROP CONSTRAINT "members_group_id_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "members" DROP CONSTRAINT "members_role_id_roles_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "members_group_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "members_group_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "members_group_lastname_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "members_group_birthday_idx";--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follows" ADD CONSTRAINT "follows_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follows" ADD CONSTRAINT "follows_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "home_transfers" ADD CONSTRAINT "home_transfers_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "home_transfers" ADD CONSTRAINT "home_transfers_from_group_id_groups_id_fk" FOREIGN KEY ("from_group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "home_transfers" ADD CONSTRAINT "home_transfers_to_group_id_groups_id_fk" FOREIGN KEY ("to_group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "home_transfers" ADD CONSTRAINT "home_transfers_decided_by_member_id_members_id_fk" FOREIGN KEY ("decided_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_privileges" ADD CONSTRAINT "member_privileges_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_privileges" ADD CONSTRAINT "member_privileges_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_decided_by_member_id_members_id_fk" FOREIGN KEY ("decided_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follows_group_idx" ON "follows" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "home_transfers_one_open_uq" ON "home_transfers" USING btree ("member_id") WHERE "home_transfers"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "home_transfers_to_status_idx" ON "home_transfers" USING btree ("to_group_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_member_group_uq" ON "memberships" USING btree ("member_id","group_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_one_home_uq" ON "memberships" USING btree ("member_id") WHERE "memberships"."is_home";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_group_status_idx" ON "memberships" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_member_status_idx" ON "memberships" USING btree ("member_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "members_lastname_idx" ON "members" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "members_birthday_idx" ON "members" USING btree (extract(month from "date_of_birth"),extract(day from "date_of_birth"));--> statement-breakpoint
ALTER TABLE "members" DROP COLUMN IF EXISTS "group_id";--> statement-breakpoint
ALTER TABLE "members" DROP COLUMN IF EXISTS "role_id";--> statement-breakpoint
ALTER TABLE "members" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
DROP TYPE "public"."member_status_enum";
