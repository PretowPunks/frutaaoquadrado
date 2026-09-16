ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.rep_invites
  ADD COLUMN IF NOT EXISTS cities text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_customers_owner_city ON public.customers (owner_id, lower(city));
CREATE INDEX IF NOT EXISTS idx_rep_invites_accepted_user ON public.rep_invites (accepted_user_id);

CREATE OR REPLACE FUNCTION private.normalize_city(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT lower(trim(regexp_replace(coalesce(value, ''), '\s+', ' ', 'g')))
$$;

REVOKE ALL ON FUNCTION private.normalize_city(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.normalize_city(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.representative_has_city(_user_id uuid, _city text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rep_invites i
    CROSS JOIN LATERAL unnest(i.cities) AS assigned_city
    WHERE i.accepted_user_id = _user_id
      AND private.normalize_city(assigned_city) = private.normalize_city(_city)
  )
$$;

REVOKE ALL ON FUNCTION private.representative_has_city(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.representative_has_city(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_customer_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cliente fora da carteira do representante';
  END IF;

  IF NOT private.representative_has_city(auth.uid(), NEW.city) THEN
    RAISE EXCEPTION 'Cidade não atribuída a este representante';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_customer_scope() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_customer_scope ON public.customers;
CREATE TRIGGER trg_validate_customer_scope
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.validate_customer_scope();

CREATE OR REPLACE FUNCTION public.validate_representative_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  customer_owner uuid;
  product_is_central boolean;
BEGIN
  IF private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Somente a matriz pode alterar pedidos';
  END IF;

  IF NEW.owner_id IS DISTINCT FROM auth.uid()
     OR NEW.created_by IS DISTINCT FROM auth.uid()
     OR NEW.status IS DISTINCT FROM 'scheduled'::public.sale_status
     OR NEW.delivery_date IS NULL THEN
    RAISE EXCEPTION 'Representantes podem registrar apenas pedidos próprios com entrega agendada';
  END IF;

  SELECT c.owner_id INTO customer_owner
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  IF customer_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cliente fora da carteira do representante';
  END IF;

  SELECT p.owner_id IS NULL INTO product_is_central
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF product_is_central IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'O pedido deve usar um produto do catálogo da matriz';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_representative_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_representative_order ON public.sales;
CREATE TRIGGER trg_validate_representative_order
BEFORE INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.validate_representative_order();

CREATE OR REPLACE FUNCTION public.apply_sale()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status <> 'scheduled' THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity - NEW.quantity, updated_at = now()
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_sale_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status = 'scheduled' AND NEW.status <> 'scheduled' THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity - NEW.quantity, updated_at = now()
    WHERE id = NEW.product_id;
  ELSIF OLD.status <> 'scheduled' AND NEW.status = 'scheduled' THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity + OLD.quantity, updated_at = now()
    WHERE id = OLD.product_id;
  ELSIF OLD.status <> 'scheduled' AND NEW.status <> 'scheduled'
        AND (OLD.product_id IS DISTINCT FROM NEW.product_id OR OLD.quantity IS DISTINCT FROM NEW.quantity) THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity + OLD.quantity, updated_at = now()
    WHERE id = OLD.product_id;
    UPDATE public.products
    SET stock_quantity = stock_quantity - NEW.quantity, updated_at = now()
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_sale_status_change ON public.sales;
CREATE TRIGGER trg_apply_sale_status_change
AFTER UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.apply_sale_status_change();

CREATE OR REPLACE FUNCTION public.restore_sale_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status <> 'scheduled' THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity + OLD.quantity, updated_at = now()
    WHERE id = OLD.product_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP POLICY IF EXISTS "own customers" ON public.customers;
CREATE POLICY "representatives read own customers in assigned cities"
ON public.customers FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  AND private.representative_has_city(auth.uid(), city)
);
CREATE POLICY "representatives create customers in assigned cities"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND private.representative_has_city(auth.uid(), city)
);
CREATE POLICY "representatives update own customers in assigned cities"
ON public.customers FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  AND private.representative_has_city(auth.uid(), city)
)
WITH CHECK (
  owner_id = auth.uid()
  AND private.representative_has_city(auth.uid(), city)
);
CREATE POLICY "representatives delete own customers in assigned cities"
ON public.customers FOR DELETE TO authenticated
USING (
  owner_id = auth.uid()
  AND private.representative_has_city(auth.uid(), city)
);

DROP POLICY IF EXISTS "representatives read own products" ON public.products;
DROP POLICY IF EXISTS "representatives update own sale price" ON public.products;
CREATE POLICY "representatives read central catalog"
ON public.products FOR SELECT TO authenticated
USING (owner_id IS NULL AND NOT private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "own sales" ON public.sales;
CREATE POLICY "representatives read own orders"
ON public.sales FOR SELECT TO authenticated
USING (owner_id = auth.uid());
CREATE POLICY "representatives create scheduled orders"
ON public.sales FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND created_by = auth.uid()
  AND status = 'scheduled'::public.sale_status
  AND delivery_date IS NOT NULL
);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_new_required_fields
  CHECK (
    created_at < TIMESTAMPTZ '2026-09-16 17:20:00+00'
    OR (
      nullif(trim(phone), '') IS NOT NULL
      AND nullif(trim(document_number), '') IS NOT NULL
      AND nullif(trim(street), '') IS NOT NULL
      AND nullif(trim(address_number), '') IS NOT NULL
      AND nullif(trim(neighborhood), '') IS NOT NULL
      AND nullif(trim(city), '') IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE public.rep_invites
  ADD CONSTRAINT rep_invites_new_require_cities
  CHECK (
    created_at < TIMESTAMPTZ '2026-09-16 17:20:00+00'
    OR cardinality(cities) > 0
  ) NOT VALID;