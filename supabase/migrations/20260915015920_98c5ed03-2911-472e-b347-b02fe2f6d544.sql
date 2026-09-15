CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

ALTER POLICY "admin all customers" ON public.customers USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "admin read backups" ON public.data_backups USING (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "admin read consent" ON public.privacy_consents USING (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "admin all products" ON public.products USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Users can view own profile or admin can view all" ON public.profiles USING ((id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));
ALTER POLICY "admin all rep_invites" ON public.rep_invites USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "admin manages representative profit payments" ON public.representative_profit_payments
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    private.has_role(auth.uid(), 'admin')
    AND created_by = auth.uid()
    AND rep_user_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id
        AND s.owner_id = rep_user_id
        AND s.payment_method = 'boleto'
        AND s.boleto_paid_at IS NOT NULL
        AND s.status <> 'scheduled'
        AND gross_sale = s.unit_sale_price * s.quantity
        AND cost_total = s.unit_cost * s.quantity
        AND profit_amount = (s.unit_sale_price - s.unit_cost) * s.quantity
    )
  );
ALTER POLICY "admin all sales" ON public.sales USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "admin all route points" ON public.shift_route_points USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "admin all entries" ON public.stock_entries USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "admin all stock_transfers" ON public.stock_transfers USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "admin all supplier_payment_items" ON public.supplier_payment_items USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "admin all supplier_payments" ON public.supplier_payments USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "admin manage roles" ON public.user_roles USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "read own role" ON public.user_roles USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));
ALTER POLICY "admin all work_shifts" ON public.work_shifts USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;