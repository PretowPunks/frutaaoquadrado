
CREATE OR REPLACE FUNCTION public.revert_stock_entry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = GREATEST(stock_quantity - OLD.quantity, 0), updated_at = now()
  WHERE id = OLD.product_id;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_revert_stock_entry ON public.stock_entries;
CREATE TRIGGER trg_revert_stock_entry
BEFORE DELETE ON public.stock_entries
FOR EACH ROW EXECUTE FUNCTION public.revert_stock_entry();

DROP TRIGGER IF EXISTS trg_apply_stock_entry ON public.stock_entries;
CREATE TRIGGER trg_apply_stock_entry
AFTER INSERT ON public.stock_entries
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_entry();
