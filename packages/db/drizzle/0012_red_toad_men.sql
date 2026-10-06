CREATE TYPE "public"."book_category_enum" AS ENUM('SPIRITUALITY', 'PRAYER', 'THEOLOGY', 'SCRIPTURE', 'CATECHESIS', 'SAINTS', 'CHURCH_HISTORY', 'FAMILY', 'YOUTH', 'CHILDREN', 'FICTION', 'CLASSICS');--> statement-breakpoint
CREATE TYPE "public"."book_format_enum" AS ENUM('EPUB', 'PDF');--> statement-breakpoint
CREATE TYPE "public"."book_status_enum" AS ENUM('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'UNLISTED');--> statement-breakpoint
CREATE TYPE "public"."order_status_enum" AS ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."refund_status_enum" AS ENUM('REQUESTED', 'APPROVED', 'DECLINED');--> statement-breakpoint
ALTER TYPE "public"."engage_kind_enum" ADD VALUE 'BOOK';--> statement-breakpoint
ALTER TYPE "public"."platform_privilege_enum" ADD VALUE 'SELL_BOOKS';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "book_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'GHS' NOT NULL,
	"commission_bps" integer NOT NULL,
	"platform_minor" integer NOT NULL,
	"author_minor" integer NOT NULL,
	"status" "order_status_enum" DEFAULT 'PENDING' NOT NULL,
	"gateway" varchar(20) NOT NULL,
	"client_reference" varchar(40) NOT NULL,
	"gateway_ref" varchar(120),
	"checkout_url" text,
	"gateway_payload" jsonb,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_orders_client_reference_unique" UNIQUE("client_reference"),
	CONSTRAINT "book_orders_split_chk" CHECK ("book_orders"."platform_minor" + "book_orders"."author_minor" = "book_orders"."amount_minor")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "book_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_user_id" uuid,
	"seller_member_id" uuid,
	"amount_minor" integer NOT NULL,
	"reference" varchar(120) NOT NULL,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "book_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status_enum" DEFAULT 'REQUESTED' NOT NULL,
	"percent_read" smallint DEFAULT 0 NOT NULL,
	"note" text,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "book_sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_user_id" uuid,
	"seller_member_id" uuid,
	"commission_bps" integer,
	"payout_to" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_sellers_one_chk" CHECK (("book_sellers"."seller_user_id" IS NULL) <> ("book_sellers"."seller_member_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"title" varchar(200) NOT NULL,
	"subtitle" varchar(200),
	"author_name" varchar(160) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"about_author" text DEFAULT '' NOT NULL,
	"category" "book_category_enum" NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"pages" smallint,
	"isbn" varchar(20),
	"approbation" varchar(300),
	"format" "book_format_enum",
	"file_key" text,
	"file_bytes" integer,
	"preview_key" text,
	"cover_key" text,
	"price_minor" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'GHS' NOT NULL,
	"rights_confirmed" boolean DEFAULT false NOT NULL,
	"seller_user_id" uuid,
	"seller_member_id" uuid,
	"status" "book_status_enum" DEFAULT 'DRAFT' NOT NULL,
	"review_note" text,
	"reviewed_by_user_id" uuid,
	"submitted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_slug_unique" UNIQUE("slug"),
	CONSTRAINT "books_one_seller_chk" CHECK (("books"."seller_user_id" IS NULL) <> ("books"."seller_member_id" IS NULL)),
	CONSTRAINT "books_price_chk" CHECK ("books"."price_minor" = 0 OR "books"."price_minor" >= 100),
	CONSTRAINT "books_live_chk" CHECK ("books"."status" <> 'PUBLISHED' OR ("books"."file_key" IS NOT NULL AND "books"."published_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_items" (
	"member_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"order_id" uuid,
	"locator" varchar(500),
	"percent" smallint DEFAULT 0 NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_at" timestamp with time zone,
	CONSTRAINT "library_items_member_id_book_id_pk" PRIMARY KEY("member_id","book_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_settings" (
	"key" varchar(60) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_orders" ADD CONSTRAINT "book_orders_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_orders" ADD CONSTRAINT "book_orders_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_payouts" ADD CONSTRAINT "book_payouts_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_payouts" ADD CONSTRAINT "book_payouts_seller_member_id_members_id_fk" FOREIGN KEY ("seller_member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_payouts" ADD CONSTRAINT "book_payouts_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_refunds" ADD CONSTRAINT "book_refunds_order_id_book_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."book_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_refunds" ADD CONSTRAINT "book_refunds_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_sellers" ADD CONSTRAINT "book_sellers_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_sellers" ADD CONSTRAINT "book_sellers_seller_member_id_members_id_fk" FOREIGN KEY ("seller_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "books" ADD CONSTRAINT "books_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "books" ADD CONSTRAINT "books_seller_member_id_members_id_fk" FOREIGN KEY ("seller_member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "books" ADD CONSTRAINT "books_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_items" ADD CONSTRAINT "library_items_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_items" ADD CONSTRAINT "library_items_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_items" ADD CONSTRAINT "library_items_order_id_book_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."book_orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "book_orders_member_idx" ON "book_orders" USING btree ("member_id","book_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "book_orders_book_idx" ON "book_orders" USING btree ("book_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "book_refunds_status_idx" ON "book_refunds" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "book_refunds_open_uq" ON "book_refunds" USING btree ("order_id") WHERE "book_refunds"."status" = 'REQUESTED';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "book_sellers_user_uq" ON "book_sellers" USING btree ("seller_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "book_sellers_member_uq" ON "book_sellers" USING btree ("seller_member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "books_shelf_idx" ON "books" USING btree ("status","category","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "books_seller_user_idx" ON "books" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "books_seller_member_idx" ON "books" USING btree ("seller_member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "books_fts_idx" ON "books" USING gin (to_tsvector('english', "title" || ' ' || coalesce("subtitle", '') || ' ' || "author_name" || ' ' || "description"));