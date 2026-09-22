ALTER TABLE public.rep_invites
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.rep_invites
  DROP CONSTRAINT IF EXISTS rep_invites_status_check;
ALTER TABLE public.rep_invites
  ADD CONSTRAINT rep_invites_status_check CHECK (status IN ('active', 'inactive'));

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS order_total numeric,
  ADD COLUMN IF NOT EXISTS order_status text,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS seller_type text;

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_order_status_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_order_status_check CHECK (order_status IS NULL OR order_status IN ('pending', 'scheduled', 'delivered'));
ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_payment_status_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_payment_status_check CHECK (payment_status IS NULL OR payment_status IN ('unpaid', 'boleto', 'paid'));
ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_seller_type_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_seller_type_check CHECK (seller_type IS NULL OR seller_type IN ('matrix', 'representative'));

CREATE INDEX IF NOT EXISTS idx_sales_order_id ON public.sales(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_status_date ON public.sales(order_status, delivery_date);
CREATE INDEX IF NOT EXISTS idx_sales_owner_created_at ON public.sales(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rep_invites_status ON public.rep_invites(status);

CREATE OR REPLACE FUNCTION public.sale_commits_stock(_status public.sale_status, _order_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN _order_status IS NOT NULL THEN _order_status = 'delivered'
    ELSE _status <> 'scheduled'::public.sale_status
  END
$$;

REVOKE ALL ON FUNCTION public.sale_commits_stock(public.sale_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sale_commits_stock(public.sale_status, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_sale()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF public.sale_commits_stock(NEW.status, NEW.order_status) THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity - NEW.quantity, updated_at = now()
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_sale_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  old_commits boolean := public.sale_commits_stock(OLD.status, OLD.order_status);
  new_commits boolean := public.sale_commits_stock(NEW.status, NEW.order_status);
BEGIN
  IF NOT old_commits AND new_commits THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity - NEW.quantity, updated_at = now()
    WHERE id = NEW.product_id;
  ELSIF old_commits AND NOT new_commits THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity + OLD.quantity, updated_at = now()
    WHERE id = OLD.product_id;
  ELSIF old_commits AND new_commits
        AND (OLD.product_id IS DISTINCT FROM NEW.product_id OR OLD.quantity IS DISTINCT FROM NEW.quantity) THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity + OLD.quantity, updated_at = now()
    WHERE id = OLD.product_id;
    UPDATE public.products
    SET stock_quantity = stock_quantity - NEW.quantity, updated_at = now()
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_sale_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF public.sale_commits_stock(OLD.status, OLD.order_status) THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity + OLD.quantity, updated_at = now()
    WHERE id = OLD.product_id;
  END IF;
  RETURN OLD;
END;
$$;