CREATE OR REPLACE FUNCTION public.corporate_owner_update_account(
  p_account_id uuid,
  p_company_name text,
  p_contact_person text,
  p_contact_phone text,
  p_contact_email text,
  p_billing_email text
)
RETURNS public.corporate_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.corporate_accounts;
BEGIN
  IF NOT public.is_corporate_owner(p_account_id) THEN
    RAISE EXCEPTION 'Only the corporate account owner can edit billing information'
      USING errcode = '42501';
  END IF;

  UPDATE public.corporate_accounts
  SET company_name = NULLIF(trim(p_company_name), ''),
      contact_person = NULLIF(trim(p_contact_person), ''),
      contact_phone = NULLIF(trim(p_contact_phone), ''),
      contact_email = NULLIF(trim(p_contact_email), ''),
      billing_email = NULLIF(trim(p_billing_email), '')
  WHERE id = p_account_id
  RETURNING * INTO v_account;

  RETURN v_account;
END;
$$;

GRANT EXECUTE ON FUNCTION public.corporate_owner_update_account(uuid, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.corporate_owner_update_member_name(
  p_member_id uuid,
  p_full_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_account_id uuid;
BEGIN
  SELECT profile_id, account_id INTO v_profile_id, v_account_id
  FROM public.corporate_members WHERE id = p_member_id;
  IF v_profile_id IS NULL OR NOT public.is_corporate_owner(v_account_id) THEN
    RAISE EXCEPTION 'Only the corporate account owner can edit team members'
      USING errcode = '42501';
  END IF;
  UPDATE public.profiles SET full_name = NULLIF(trim(p_full_name), '') WHERE id = v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.corporate_owner_update_member_name(uuid, text) TO authenticated;
