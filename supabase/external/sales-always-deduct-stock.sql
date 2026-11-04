-- Apply to the owner's external database (SQL editor, as owner).
-- Every sale deducts stock on creation, regardless of delivery or payment
-- status. Edits adjust stock by the difference; deletes return the stock.
BEGIN;

CREATE OR REPLACE FUNCTION public.sale_commits_stock(_status public.sale_status, _order_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT true $$;

-- Neutralize the legacy per-event functions so stock is not moved twice.
CREATE OR REPLACE FUNCTION public.apply_sale() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.apply_sale_status_change() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.restore_sale_stock() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RETURN OLD; END $$;

CREATE OR REPLACE FUNCTION public.sync_sale_stock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.products SET stock_quantity = stock_quantity + OLD.quantity
    WHERE id = OLD.product_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE public.products SET stock_quantity = stock_quantity - NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS sales_sync_stock ON public.sales;
CREATE TRIGGER sales_sync_stock
AFTER INSERT OR DELETE OR UPDATE OF product_id, quantity ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.sync_sale_stock();

-- One-time catch-up: deduct sales that were never deducted before
-- (scheduled / not delivered). Run only once.
UPDATE public.products p
SET stock_quantity = p.stock_quantity - x.qty
FROM (
  SELECT product_id, sum(quantity) AS qty FROM public.sales
  WHERE status = 'scheduled' AND coalesce(order_status, '') <> 'delivered'
  GROUP BY product_id
) x
WHERE p.id = x.product_id;

COMMIT;
