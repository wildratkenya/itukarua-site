-- Contact Access product window + GDPR consent + secure redemption.
--
-- Turns the ad-hoc "contact_access" payment into a real gated product:
--   - payments.access_expires_at  -> window end for the unlock
--   - profiles.allow_contact_display -> jobseeker GDPR/opt-in flag
--   - unique token index -> stable single token per payment
--   - SECURITY DEFINER RPCs -> server-enforced reveal + redemption
--   - RLS: payments readable only by the owner (or admins)

-- ── Columns ───────────────────────────────────────────────────────────────

ALTER TABLE "public"."payments"
  ADD COLUMN IF NOT EXISTS "access_expires_at" timestamp with time zone;

ALTER TABLE "public"."profiles"
  ADD COLUMN IF NOT EXISTS "allow_contact_display" boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_token_unique"
  ON "public"."payments" ("token")
  WHERE ("token" IS NOT NULL);

-- ── Grandfathering ─────────────────────────────────────────────────────────
-- Completed contact unlocks that predate the window model get a fresh 24h
-- window so nobody who already paid loses what they bought, but nothing stays
-- permanent after the switch.

UPDATE "public"."payments"
SET "access_expires_at" = now() + interval '24 hours'
WHERE "payment_type" = 'contact_access'
  AND "status" = 'completed'
  AND "access_expires_at" IS NULL;

-- ── Settings ───────────────────────────────────────────────────────────────

INSERT INTO "public"."platform_settings" ("key", "value", "updated_at")
VALUES ('contact_access_window_hours', 24, now())
ON CONFLICT ("key") DO NOTHING;

-- ── RLS: payments are private again ───────────────────────────────────────

DROP POLICY IF EXISTS "public_read_payments" ON "public"."payments";
DROP POLICY IF EXISTS "auth_read_payments" ON "public"."payments";

CREATE POLICY "auth_read_payments" ON "public"."payments"
  FOR SELECT
  USING (
    "user_id" = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p."id" = auth.uid() AND p."role" IN ('admin', 'super_admin')
    )
  );

-- ── RPC: reveal a profile's contact, server-enforced ─────────────────────

CREATE OR REPLACE FUNCTION "public"."get_profile_contact"(
  "p_profile_id" uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" = public
AS $$
DECLARE
  v_profile "public"."profiles"%ROWTYPE;
  v_user uuid := auth.uid();
  v_allowed boolean := false;
  v_expires timestamptz;
BEGIN
  IF "p_profile_id" IS NULL THEN
    RETURN '{"allowed":false,"reason":"missing"}'::json;
  END IF;

  SELECT * INTO v_profile FROM "public"."profiles" WHERE "id" = "p_profile_id";
  IF NOT FOUND THEN
    RETURN '{"allowed":false,"reason":"missing"}'::json;
  END IF;

  -- GDPR: the jobseeker must have opted in to contact sharing.
  IF v_profile."allow_contact_display" IS NOT TRUE THEN
    RETURN '{"allowed":false,"reason":"opted_out"}'::json;
  END IF;

  -- The profile owner always sees their own contact.
  IF v_user = v_profile."id" THEN
    v_allowed := true;
  END IF;

  -- Admins bypass.
  IF NOT v_allowed AND v_user IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p."id" = v_user AND p."role" IN ('admin', 'super_admin')
    ) INTO v_allowed;
  END IF;

  -- Windowed per-contact purchase.
  IF NOT v_allowed AND v_user IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM "public"."payments" pm
      WHERE pm."user_id" = v_user
        AND pm."payment_type" = 'contact_access'
        AND pm."related_profile_id" = v_profile."id"
        AND pm."status" = 'completed'
        AND pm."access_expires_at" IS NOT NULL
        AND pm."access_expires_at" > now()
    ) INTO v_allowed;
    IF v_allowed THEN
      SELECT max(pm."access_expires_at")
        INTO v_expires
        FROM "public"."payments" pm
        WHERE pm."user_id" = v_user
          AND pm."payment_type" = 'contact_access'
          AND pm."related_profile_id" = v_profile."id"
          AND pm."status" = 'completed'
          AND pm."access_expires_at" > now();
    END IF;
  END IF;

  -- Live Employer access (entitlement, falling back to the legacy profile mirror).
  IF NOT v_allowed AND v_user IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM "public"."profile_roles" pr
      WHERE pr."user_id" = v_user
        AND pr."paid"
        AND pr."role" = 'employer'
        AND pr."expires_at" IS NOT NULL
        AND pr."expires_at" > now()
    ) INTO v_allowed;
    IF v_allowed THEN
      SELECT max(pr."expires_at")
        INTO v_expires
        FROM "public"."profile_roles" pr
        WHERE pr."user_id" = v_user
          AND pr."paid"
          AND pr."role" = 'employer'
          AND pr."expires_at" > now();
    END IF;
  END IF;

  IF NOT v_allowed AND v_user IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p."id" = v_user
        AND p."registration_paid"
        AND p."role" IN ('employer', 'admin', 'super_admin')
        AND p."subscription_expires_at" IS NOT NULL
        AND p."subscription_expires_at" > now()
    ) INTO v_allowed;
    IF v_allowed THEN
      SELECT p."subscription_expires_at"
        INTO v_expires
        FROM "public"."profiles" p
        WHERE p."id" = v_user;
    END IF;
  END IF;

  -- A completed unlock that has lapsed is reported as expired, not generic locked.
  IF NOT v_allowed AND v_user IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM "public"."payments" pm
      WHERE pm."user_id" = v_user
        AND pm."payment_type" = 'contact_access'
        AND pm."related_profile_id" = v_profile."id"
        AND pm."status" = 'completed'
    ) THEN
      RETURN '{"allowed":false,"reason":"expired"}'::json;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RETURN '{"allowed":false,"reason":"locked"}'::json;
  END IF;

  RETURN json_build_object(
    'allowed', true,
    'expires_at', v_expires,
    'contact', json_build_object(
      'phone', v_profile."phone",
      'email', v_profile."email",
      'whatsapp', v_profile."whatsapp_number",
      'location', v_profile."location",
      'county', v_profile."county",
      'subcounty', v_profile."subcounty"
    ),
    'certificates', v_profile."certificates",
    'resume', v_profile."resume"
  );
END;
$$;

-- ── RPC: redeem a previously purchased contact token ──────────────────────

CREATE OR REPLACE FUNCTION "public"."redeem_contact_token"(
  "p_token" text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" = public
AS $$
DECLARE
  v_payment "public"."payments"%ROWTYPE;
  v_user uuid := auth.uid();
BEGIN
  IF "p_token" IS NULL OR btrim("p_token") = '' THEN
    RETURN '{"error":"missing"}'::json;
  END IF;

  SELECT * INTO v_payment
  FROM "public"."payments"
  WHERE "token" = btrim("p_token")
    AND "payment_type" = 'contact_access'
  LIMIT 1;

  IF NOT FOUND OR v_payment."status" <> 'completed' THEN
    RETURN '{"error":"invalid"}'::json;
  END IF;

  IF v_payment."access_expires_at" IS NULL OR v_payment."access_expires_at" <= now() THEN
    RETURN '{"error":"expired"}'::json;
  END IF;

  -- Bind an orphan guest purchase to whoever first redeems it so the window
  -- follows them across devices after they sign in.
  IF v_payment."user_id" IS NULL AND v_user IS NOT NULL THEN
    UPDATE "public"."payments"
    SET "user_id" = v_user
    WHERE "id" = v_payment."id";
  END IF;

  RETURN json_build_object(
    'profile_id', v_payment."related_profile_id",
    'expires_at', v_payment."access_expires_at",
    'allowed', true
  );
END;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION "public"."get_profile_contact"("p_profile_id" uuid) TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."redeem_contact_token"("p_token" text) TO "anon", "authenticated", "service_role";