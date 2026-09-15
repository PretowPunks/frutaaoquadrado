CREATE TABLE public.representative_profit_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL UNIQUE REFERENCES public.sales(id) ON DELETE RESTRICT,
  gross_sale numeric NOT NULL CHECK (gross_sale >= 0),
  cost_total numeric NOT NULL CHECK (cost_total >= 0),
  profit_amount numeric NOT NULL CHECK (profit_amount >= 0),
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.representative_profit_payments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.representative_profit_payments TO authenticated;
GRANT ALL ON public.representative_profit_payments TO service_role;

ALTER TABLE public.representative_profit_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages representative profit payments"
ON public.representative_profit_payments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
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

CREATE POLICY "representatives read own profit payments"
ON public.representative_profit_payments
FOR SELECT TO authenticated
USING (rep_user_id = auth.uid());

CREATE INDEX representative_profit_payments_rep_paid_idx
ON public.representative_profit_payments (rep_user_id, paid_at DESC);