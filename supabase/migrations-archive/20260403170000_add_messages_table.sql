-- Create messages table for admin to manage user messages/support tickets
CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid",
    "sender_name" "text",
    "sender_email" "text",
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" DEFAULT 'support'::"text", -- support, feedback, complaint, etc.
    "status" "text" DEFAULT 'unread'::"text", -- unread, read, replied, closed
    "priority" "text" DEFAULT 'normal'::"text", -- low, normal, high, urgent
    "admin_response" "text",
    "responded_by" "uuid",
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."messages" OWNER TO "postgres";

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert messages (for contact forms)
CREATE POLICY "allow_public_insert_messages" ON "public"."messages" FOR INSERT WITH CHECK (true);

-- Only admins can view and update messages
CREATE POLICY "allow_admin_read_messages" ON "public"."messages" FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM "public"."profiles"
        WHERE "profiles"."id" = auth.uid()
        AND "profiles"."role" = 'super_admin'
    )
);

CREATE POLICY "allow_admin_update_messages" ON "public"."messages" FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM "public"."profiles"
        WHERE "profiles"."id" = auth.uid()
        AND "profiles"."role" = 'super_admin'
    )
);