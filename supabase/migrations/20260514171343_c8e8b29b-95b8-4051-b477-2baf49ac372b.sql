
-- Repasses ao fornecedor
CREATE TABLE public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  note TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all supplier_payments" ON public.supplier_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Backups automáticos (snapshots em JSON)
CREATE TABLE public.data_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL,
  row_counts JSONB NOT NULL
);
ALTER TABLE public.data_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read backups" ON public.data_backups
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Função que cria um snapshot completo
CREATE OR REPLACE FUNCTION public.create_data_backup()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_products jsonb;
  v_customers jsonb;
  v_stock_entries jsonb;
  v_sales jsonb;
  v_supplier_payments jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_products FROM public.products t;
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_customers FROM public.customers t;
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_stock_entries FROM public.stock_entries t;
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_sales FROM public.sales t;
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_supplier_payments FROM public.supplier_payments t;

  INSERT INTO public.data_backups (payload, row_counts)
  VALUES (
    jsonb_build_object(
      'products', v_products,
      'customers', v_customers,
      'stock_entries', v_stock_entries,
      'sales', v_sales,
      'supplier_payments', v_supplier_payments
    ),
    jsonb_build_object(
      'products', jsonb_array_length(v_products),
      'customers', jsonb_array_length(v_customers),
      'stock_entries', jsonb_array_length(v_stock_entries),
      'sales', jsonb_array_length(v_sales),
      'supplier_payments', jsonb_array_length(v_supplier_payments)
    )
  )
  RETURNING id INTO v_id;

  -- Mantém apenas os últimos 30 backups
  DELETE FROM public.data_backups
  WHERE id IN (
    SELECT id FROM public.data_backups
    ORDER BY created_at DESC OFFSET 30
  );

  RETURN v_id;
END;
$$;

-- Agendamento diário (03:00 UTC) — backup automático
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'daily-data-backup',
  '0 3 * * *',
  $$ SELECT public.create_data_backup(); $$
);
