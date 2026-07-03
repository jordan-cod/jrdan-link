CREATE TABLE "clicks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"link_id" text NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"referrer" text,
	"country" text,
	"device" text,
	"is_bot" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clicks_link_ts_idx" ON "clicks" USING btree ("link_id","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "clicks_ts_idx" ON "clicks" USING btree ("ts" DESC NULLS LAST);