ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS boleto_due_date date,
  ADD COLUMN IF NOT EXISTS boleto_paid_at timestamptz;

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_payment_method_check;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('direct','boleto'));