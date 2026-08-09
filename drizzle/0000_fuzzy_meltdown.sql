CREATE TABLE "guest_meals" (
	"guest_id" uuid PRIMARY KEY NOT NULL,
	"main" text,
	"dietary" text[],
	"kitchen_note" text
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_child" boolean DEFAULT false NOT NULL,
	"plus_one_of" uuid,
	"table_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_sessions" (
	"token" text NOT NULL,
	"household_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "household_sessions_token_pk" PRIMARY KEY("token")
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"label" text NOT NULL,
	"phone" text,
	"invite_sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"household_id" uuid,
	"drive_file_id" text NOT NULL,
	"taken_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"neighborhood" text,
	"walk" text,
	"blurb" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pledges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"item" text NOT NULL,
	"amount_cents" integer,
	"paid" boolean DEFAULT false NOT NULL,
	"address" text,
	"thanked" boolean DEFAULT false NOT NULL,
	"thanked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reserved_slugs" (
	"slug" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rsvps" (
	"household_id" uuid PRIMARY KEY NOT NULL,
	"reply" text,
	"attending_count" integer,
	"note" text,
	"shuttle" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "song_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"title" text NOT NULL,
	"artist" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_sub" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"refresh_token_encrypted" text,
	"refresh_token_updated_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"owner_google_sub" text NOT NULL,
	"name_one" text,
	"name_two" text,
	"date" timestamp with time zone,
	"venue" text,
	"guest_estimate" integer,
	"layout" text DEFAULT 'classic' NOT NULL,
	"palette" text DEFAULT 'brass' NOT NULL,
	"accent" text,
	"sections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"partner_email" text,
	"custom_domain" text,
	"drive_folder_id" text,
	"sheet_id" text,
	"provisioning_step" integer DEFAULT 0 NOT NULL,
	"provisioning_error" text,
	"published_at" timestamp with time zone,
	"intake_step" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guest_meals" ADD CONSTRAINT "guest_meals_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_sessions" ADD CONSTRAINT "household_sessions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pledges" ADD CONSTRAINT "pledges_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_requests" ADD CONSTRAINT "song_requests_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guests_household_idx" ON "guests" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "household_sessions_household_idx" ON "household_sessions" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "households_wedding_idx" ON "households" USING btree ("wedding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "photos_drive_file_idx" ON "photos" USING btree ("drive_file_id");--> statement-breakpoint
CREATE INDEX "photos_wedding_idx" ON "photos" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "photos_household_idx" ON "photos" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "places_wedding_idx" ON "places" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "pledges_household_idx" ON "pledges" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "song_requests_household_idx" ON "song_requests" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_sub_idx" ON "users" USING btree ("google_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "weddings_slug_idx" ON "weddings" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "weddings_custom_domain_idx" ON "weddings" USING btree ("custom_domain");--> statement-breakpoint
CREATE INDEX "weddings_owner_idx" ON "weddings" USING btree ("owner_google_sub");