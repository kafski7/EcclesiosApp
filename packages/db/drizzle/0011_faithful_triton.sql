CREATE TYPE "public"."engage_kind_enum" AS ENUM('POST', 'TEACHING', 'EPISODE', 'HYMN');--> statement-breakpoint
CREATE TYPE "public"."reaction_type_enum" AS ENUM('LIKE', 'SAVE');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reactions" (
	"member_id" uuid NOT NULL,
	"kind" "engage_kind_enum" NOT NULL,
	"item_id" uuid NOT NULL,
	"type" "reaction_type_enum" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_member_id_kind_item_id_type_pk" PRIMARY KEY("member_id","kind","item_id","type")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reactions" ADD CONSTRAINT "reactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_item_idx" ON "reactions" USING btree ("kind","item_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_member_saved_idx" ON "reactions" USING btree ("member_id","type","created_at");