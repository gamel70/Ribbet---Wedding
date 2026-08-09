CREATE TABLE "guest_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"household_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rsvp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"household_id" uuid,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "invite_token" text;--> statement-breakpoint
UPDATE "households" SET "invite_token" = replace(gen_random_uuid()::text, '-', '') WHERE "invite_token" IS NULL;--> statement-breakpoint
ALTER TABLE "households" ALTER COLUMN "invite_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_events" ADD CONSTRAINT "rsvp_events_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_events" ADD CONSTRAINT "rsvp_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_requests_wedding_idx" ON "guest_requests" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "rsvp_events_wedding_idx" ON "rsvp_events" USING btree ("wedding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "households_invite_token_idx" ON "households" USING btree ("invite_token");