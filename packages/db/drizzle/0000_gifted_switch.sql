CREATE TYPE "public"."accounting_entity_enum" AS ENUM('CATEGORY', 'ACCOUNT', 'TRANSACTION');--> statement-breakpoint
CREATE TYPE "public"."actor_type_enum" AS ENUM('USER', 'MEMBER', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."collection_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'SYNCED', 'SYNC_FAILED');--> statement-breakpoint
CREATE TYPE "public"."gender_enum" AS ENUM('MALE', 'FEMALE');--> statement-breakpoint
CREATE TYPE "public"."hierarchy_level_enum" AS ENUM('VATICAN', 'NUNCIATURE', 'PROVINCE', 'ARCHDIOCESE', 'DIOCESE', 'DEANERY', 'PARISH', 'OUTSTATION');--> statement-breakpoint
CREATE TYPE "public"."member_role_enum" AS ENUM('ADMINISTRATOR', 'MANAGER', 'SOCIETY_LEADER', 'PARISHIONER');--> statement-breakpoint
CREATE TYPE "public"."member_status_enum" AS ENUM('PENDING', 'ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."metropolitan_visibility_enum" AS ENUM('hidden', 'aggregates', 'detailed');--> statement-breakpoint
CREATE TYPE "public"."platform_privilege_enum" AS ENUM('POST_PODCASTS', 'AUTHOR_EXPLORE');--> statement-breakpoint
CREATE TYPE "public"."platform_role_enum" AS ENUM('SUPER_ADMIN', 'CREATOR');--> statement-breakpoint
CREATE TYPE "public"."subscription_status_enum" AS ENUM('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "currencies" (
	"code" char(3) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"minor_unit" smallint DEFAULT 2 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "icons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "icons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "languages" (
	"code" varchar(10) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "themes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"tokens" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "themes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "group_settings" (
	"group_id" uuid PRIMARY KEY NOT NULL,
	"metropolitan_visibility" "metropolitan_visibility_enum" DEFAULT 'aggregates' NOT NULL,
	"allow_manual_transaction_dates" boolean DEFAULT false NOT NULL,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_member_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_group_id" uuid,
	"level" "hierarchy_level_enum" NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(50),
	"path" text NOT NULL,
	"theme_id" integer,
	"currency_code" char(3),
	"language_code" varchar(10),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_code_unique" UNIQUE("code"),
	CONSTRAINT "groups_path_unique" UNIQUE("path"),
	CONSTRAINT "groups_root_levels_chk" CHECK ("groups"."parent_group_id" IS NOT NULL OR "groups"."level" IN ('VATICAN','NUNCIATURE','PROVINCE')),
	CONSTRAINT "groups_path_shape_chk" CHECK ("groups"."path" LIKE '/%/')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(100) NOT NULL,
	"module" varchar(50) NOT NULL,
	"description" text,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" "member_role_enum" NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"role_id" integer NOT NULL,
	"status" "member_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"other_names" varchar(100),
	"last_name" varchar(100) NOT NULL,
	"gender" "gender_enum",
	"date_of_birth" date,
	"email" varchar(254),
	"telephone" varchar(20),
	"address" text,
	"occupation" varchar(150),
	"photo_key" text,
	"is_baptised" boolean DEFAULT false NOT NULL,
	"baptism_date" date,
	"baptism_place" varchar(200),
	"is_communicant" boolean DEFAULT false NOT NULL,
	"first_communion_date" date,
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"confirmation_date" date,
	"is_deceased" boolean DEFAULT false NOT NULL,
	"deceased_on" date,
	"password_hash" text,
	"otp_hash" text,
	"otp_expires_at" timestamp with time zone,
	"otp_attempts" integer DEFAULT 0 NOT NULL,
	"temp_token_hash" text,
	"temp_token_expires_at" timestamp with time zone,
	"password_reset_token_hash" text,
	"password_reset_expires_at" timestamp with time zone,
	"refresh_token_hash" text,
	"refresh_token_expires_at" timestamp with time zone,
	"first_login" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_privileges" (
	"user_id" uuid NOT NULL,
	"privilege" "platform_privilege_enum" NOT NULL,
	"granted_by_user_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_privileges_user_id_privilege_pk" PRIMARY KEY("user_id","privilege")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"email" varchar(254),
	"telephone" varchar(20),
	"password_hash" text NOT NULL,
	"platform_role" "platform_role_enum" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"otp_hash" text,
	"otp_expires_at" timestamp with time zone,
	"otp_attempts" integer DEFAULT 0 NOT NULL,
	"temp_token_hash" text,
	"temp_token_expires_at" timestamp with time zone,
	"password_reset_token_hash" text,
	"password_reset_expires_at" timestamp with time zone,
	"refresh_token_hash" text,
	"refresh_token_expires_at" timestamp with time zone,
	"first_login" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "actor_type_enum" NOT NULL,
	"actor_id" uuid,
	"group_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"icon_id" integer,
	CONSTRAINT "notification_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_id" integer NOT NULL,
	"group_id" uuid,
	"recipient_member_id" uuid,
	"recipient_user_id" uuid,
	"title" varchar(200) NOT NULL,
	"body" text,
	"link" text,
	"seen_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_one_recipient_chk" CHECK (("notifications"."recipient_member_id" IS NULL) <> ("notifications"."recipient_user_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "societies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"is_committee" boolean DEFAULT false NOT NULL,
	"leader_member_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "society_members" (
	"society_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"position" varchar(100),
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "society_members_society_id_member_id_pk" PRIMARY KEY("society_id","member_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"currency_code" char(3) NOT NULL,
	"duration_days" integer NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"sms_included" integer DEFAULT 0 NOT NULL,
	"max_members" integer,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "subscription_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"subscription_type_id" integer NOT NULL,
	"status" "subscription_status_enum" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"sms_balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_period_chk" CHECK ("subscriptions"."expires_at" > "subscriptions"."starts_at"),
	CONSTRAINT "subscriptions_sms_chk" CHECK ("subscriptions"."sms_balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_accounting_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"entity_type" "accounting_entity_enum" NOT NULL,
	"local_ref" varchar(100) NOT NULL,
	"external_id" varchar(200) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"label" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pending_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"parish_group_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency_code" char(3) NOT NULL,
	"category_ref" varchar(100) NOT NULL,
	"collected_on" date NOT NULL,
	"note" text,
	"status" "collection_status_enum" DEFAULT 'PENDING' NOT NULL,
	"recorded_by_member_id" uuid NOT NULL,
	"reviewed_by_member_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"external_txn_id" varchar(200),
	"sync_attempts" integer DEFAULT 0 NOT NULL,
	"last_sync_error" text,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pc_amount_positive_chk" CHECK ("pending_collections"."amount" > 0),
	CONSTRAINT "pc_not_self_chk" CHECK ("pending_collections"."group_id" <> "pending_collections"."parish_group_id"),
	CONSTRAINT "pc_reviewed_chk" CHECK ("pending_collections"."status" = 'PENDING' OR ("pending_collections"."reviewed_by_member_id" IS NOT NULL AND "pending_collections"."reviewed_at" IS NOT NULL)),
	CONSTRAINT "pc_reject_note_chk" CHECK ("pending_collections"."status" <> 'REJECTED' OR length(trim(coalesce("pending_collections"."review_note", ''))) >= 3),
	CONSTRAINT "pc_synced_chk" CHECK ("pending_collections"."status" <> 'SYNCED' OR "pending_collections"."external_txn_id" IS NOT NULL)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_settings" ADD CONSTRAINT "group_settings_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "groups" ADD CONSTRAINT "groups_parent_group_id_groups_id_fk" FOREIGN KEY ("parent_group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "groups" ADD CONSTRAINT "groups_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "groups" ADD CONSTRAINT "groups_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "groups" ADD CONSTRAINT "groups_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."languages"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "members" ADD CONSTRAINT "members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "members" ADD CONSTRAINT "members_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_privileges" ADD CONSTRAINT "user_privileges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_privileges" ADD CONSTRAINT "user_privileges_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_types" ADD CONSTRAINT "notification_types_icon_id_icons_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."icons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_id_notification_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."notification_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_member_id_members_id_fk" FOREIGN KEY ("recipient_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "societies" ADD CONSTRAINT "societies_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "societies" ADD CONSTRAINT "societies_leader_member_id_members_id_fk" FOREIGN KEY ("leader_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "society_members" ADD CONSTRAINT "society_members_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "society_members" ADD CONSTRAINT "society_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_types" ADD CONSTRAINT "subscription_types_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscription_type_id_subscription_types_id_fk" FOREIGN KEY ("subscription_type_id") REFERENCES "public"."subscription_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_accounting_refs" ADD CONSTRAINT "external_accounting_refs_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_collections" ADD CONSTRAINT "pending_collections_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_collections" ADD CONSTRAINT "pending_collections_parish_group_id_groups_id_fk" FOREIGN KEY ("parish_group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_collections" ADD CONSTRAINT "pending_collections_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_collections" ADD CONSTRAINT "pending_collections_recorded_by_member_id_members_id_fk" FOREIGN KEY ("recorded_by_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_collections" ADD CONSTRAINT "pending_collections_reviewed_by_member_id_members_id_fk" FOREIGN KEY ("reviewed_by_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "groups_parent_idx" ON "groups" USING btree ("parent_group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "groups_level_idx" ON "groups" USING btree ("level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "groups_path_prefix_idx" ON "groups" USING btree ("path" text_pattern_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "members_group_idx" ON "members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "members_group_status_idx" ON "members" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "members_group_lastname_idx" ON "members" USING btree ("group_id","last_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "members_group_birthday_idx" ON "members" USING btree ("group_id",extract(month from "date_of_birth"),extract(day from "date_of_birth"));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "members_email_uq" ON "members" USING btree (lower("email")) WHERE "members"."email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "members_telephone_uq" ON "members" USING btree ("telephone") WHERE "members"."telephone" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uq" ON "users" USING btree (lower("email")) WHERE "users"."email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_telephone_uq" ON "users" USING btree ("telephone") WHERE "users"."telephone" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_group_time_idx" ON "audit_logs" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_member_unread_idx" ON "notifications" USING btree ("recipient_member_id","read_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_unread_idx" ON "notifications" USING btree ("recipient_user_id","read_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "societies_group_committee_idx" ON "societies" USING btree ("group_id","is_committee");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "societies_group_name_uq" ON "societies" USING btree ("group_id",lower("name"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "society_members_member_idx" ON "society_members" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_group_expiry_idx" ON "subscriptions" USING btree ("group_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_one_live_uq" ON "subscriptions" USING btree ("group_id") WHERE "subscriptions"."status" IN ('TRIAL','ACTIVE');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ext_refs_external_uq" ON "external_accounting_refs" USING btree ("provider","group_id","entity_type","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ext_refs_local_uq" ON "external_accounting_refs" USING btree ("provider","group_id","entity_type","local_ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_collections_queue_idx" ON "pending_collections" USING btree ("parish_group_id","status","collected_on");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_collections_group_idx" ON "pending_collections" USING btree ("group_id","collected_on");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pending_collections_ext_uq" ON "pending_collections" USING btree ("external_txn_id") WHERE "pending_collections"."external_txn_id" IS NOT NULL;
