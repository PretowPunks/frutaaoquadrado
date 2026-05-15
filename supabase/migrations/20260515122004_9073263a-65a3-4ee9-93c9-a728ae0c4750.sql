
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS supplier_payment_id uuid REFERENCES public.supplier_payments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_supplier_payment_id ON public.sales(supplier_payment_id);

CREATE TABLE IF NOT EXISTS public.supplier_payment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.supplier_payments(id) ON DELETE CASCADE,
  product_id uuid,
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_cost numeric NOT NULL,
  total_cost numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spi_payment_id ON public.supplier_payment_items(payment_id);

ALTER TABLE public.supplier_payment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all supplier_payment_items"
ON public.supplier_payment_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
