ALTER TABLE "weddings" ADD COLUMN "section_meta" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "schedule" jsonb DEFAULT '[]'::jsonb NOT NULL;