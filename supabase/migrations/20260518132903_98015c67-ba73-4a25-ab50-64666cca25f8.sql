ALTER TYPE public.sale_status ADD VALUE IF NOT EXISTS 'scheduled';

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS delivery_date date;

CREATE OR REPLACE FUNCTION public.restore_sale_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity + OLD.quantity, updated_at = now()
  WHERE id = OLD.product_id;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_restore_sale_stock ON public.sales;
CREATE TRIGGER trg_restore_sale_stock
AFTER DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.restore_sale_stock();