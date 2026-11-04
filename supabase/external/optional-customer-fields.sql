-- Apply only to the owner's external database. This script was not applied
-- by Lovable's managed database tools, which target a different database.
-- Existing customer records are preserved. Run as the database owner.
BEGIN;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_new_required_fields;

-- NOT VALID preserves historical records but enforces a nonblank name for
-- every new/updated customer. Re-running this script is safe.
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_name_required;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_name_required
  CHECK (name IS NOT NULL AND nullif(trim(name), '') IS NOT NULL) NOT VALID;

-- Existing customer RLS and the scope trigger continue enforcing ownership.
-- A missing city is allowed; supplied cities must still be assigned to the rep.
CREATE OR REPLACE FUNCTION private.representative_has_city(_user_id uuid, _city text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT nullif(trim(_city), '') IS NULL OR EXISTS (
    SELECT 1
    FROM public.rep_invites i
    CROSS JOIN LATERAL unnest(i.cities) AS assigned_city
    WHERE i.accepted_user_id = _user_id
      AND private.normalize_city(assigned_city) = private.normalize_city(_city)
  )
$$;

REVOKE ALL ON FUNCTION private.representative_has_city(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.representative_has_city(uuid, text) TO authenticated, service_role;

COMMIT;