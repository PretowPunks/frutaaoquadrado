-- 1. Ownership columns
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid();
ALTER TABLE public.stock_entries ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid();
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid();
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_products_owner ON public.products(owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_owner ON public.customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_owner ON public.stock_entries(owner_id);
CREATE INDEX IF NOT EXISTS idx_sales_owner ON public.sales(owner_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_owner ON public.supplier_payments(owner_id);

-- Existing 25 products stay as the matriz template (owner_id IS NULL)

-- 2. Shared updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

-- 3. Invites table
CREATE TABLE IF NOT EXISTS public.rep_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  invited_by uuid,
  accepted_at timestamp with time zone,
  accepted_user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_invites TO authenticated;
GRANT ALL ON public.rep_invites TO service_role;
ALTER TABLE public.rep_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all rep_invites" ON public.rep_invites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rep_invites_updated_at BEFORE UPDATE ON public.rep_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Owner policies (admin policies already exist and remain)
CREATE POLICY "own products" ON public.products FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own customers" ON public.customers FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own stock_entries" ON public.stock_entries FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own sales" ON public.sales FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own supplier_payments" ON public.supplier_payments FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own supplier_payment_items" ON public.supplier_payment_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.supplier_payments sp WHERE sp.id = payment_id AND sp.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.supplier_payments sp WHERE sp.id = payment_id AND sp.owner_id = auth.uid()));

-- 5. Catalog cloning
CREATE OR REPLACE FUNCTION public.clone_catalog_for(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.products (owner_id, name, cost_price, sale_price, low_stock_threshold, stock_quantity)
  SELECT _user_id, t.name, t.cost_price, t.sale_price, t.low_stock_threshold, 0
  FROM public.products t
  WHERE t.owner_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.products p WHERE p.owner_id = _user_id AND p.name = t.name
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.clone_catalog_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_catalog_for(uuid) TO authenticated, service_role;

-- 6. Invite-gated signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_invite public.rep_invites;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email = 'allissonfilo@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT * INTO v_invite FROM public.rep_invites WHERE lower(email) = lower(NEW.email) LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
    UPDATE public.rep_invites
      SET accepted_at = COALESCE(accepted_at, now()), accepted_user_id = NEW.id
      WHERE id = v_invite.id;
    PERFORM public.clone_catalog_for(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;