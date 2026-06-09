
-- 1) Replace overly-permissive RLS policies with admin-only access
DROP POLICY IF EXISTS "auth all customers" ON public.customers;
CREATE POLICY "admin all customers" ON public.customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all sales" ON public.sales;
CREATE POLICY "admin all sales" ON public.sales FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all entries" ON public.stock_entries;
CREATE POLICY "admin all entries" ON public.stock_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all products" ON public.products;
CREATE POLICY "admin all products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all supplier_payments" ON public.supplier_payments;
CREATE POLICY "admin all supplier_payments" ON public.supplier_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all supplier_payment_items" ON public.supplier_payment_items;
CREATE POLICY "admin all supplier_payment_items" ON public.supplier_payment_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Add SET search_path to trigger functions
CREATE OR REPLACE FUNCTION public.apply_sale()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.products SET stock_quantity = stock_quantity - NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.apply_stock_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.products SET stock_quantity = stock_quantity + NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.restore_sale_stock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.products SET stock_quantity = stock_quantity + OLD.quantity, updated_at = now() WHERE id = OLD.product_id;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.revert_stock_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.products SET stock_quantity = GREATEST(stock_quantity - OLD.quantity, 0), updated_at = now() WHERE id = OLD.product_id;
  RETURN OLD;
END; $$;

-- 3) Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.create_data_backup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_data_backup() TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- authenticated retains execute (needed in RLS policy evaluation by callers)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
