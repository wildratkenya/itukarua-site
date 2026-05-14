-- Create service_ratings table for visitor star ratings
CREATE TABLE IF NOT EXISTS "public"."service_ratings" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "service_id" UUID NOT NULL REFERENCES "public"."service_ads"("id") ON DELETE CASCADE,
    "user_id" UUID NOT NULL REFERENCES "public"."profiles"("id"),
    "rating" INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    "created_at" TIMESTAMPTZ DEFAULT now(),
    UNIQUE(service_id, user_id)
);

-- RLS: allow authenticated users to insert/read
ALTER TABLE "public"."service_ratings" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read service_ratings" ON "public"."service_ratings";
CREATE POLICY "public read service_ratings" ON "public"."service_ratings"
FOR SELECT USING (true);

DROP POLICY IF EXISTS "authenticated insert service_ratings" ON "public"."service_ratings";
CREATE POLICY "authenticated insert service_ratings" ON "public"."service_ratings"
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Function to update aggregate rating on service_ads
CREATE OR REPLACE FUNCTION "public"."update_service_rating"()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE "public"."service_ads"
    SET 
        rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM "public"."service_ratings" WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)), 0),
        reviews_count = COALESCE((SELECT COUNT(*) FROM "public"."service_ratings" WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)), 0)
    WHERE id = COALESCE(NEW.service_id, OLD.service_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger after insert or delete on service_ratings
DROP TRIGGER IF EXISTS "trigger_update_service_rating" ON "public"."service_ratings";
CREATE TRIGGER "trigger_update_service_rating"
AFTER INSERT OR DELETE ON "public"."service_ratings"
FOR EACH ROW
EXECUTE FUNCTION "public"."update_service_rating"();
