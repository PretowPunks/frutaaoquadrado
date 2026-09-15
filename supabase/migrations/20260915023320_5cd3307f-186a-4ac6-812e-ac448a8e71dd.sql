CREATE OR REPLACE FUNCTION public.protect_representative_product_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF private.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.owner_id IS DISTINCT FROM auth.uid() OR NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Produto fora do estoque do representante';
  END IF;

  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.cost_price IS DISTINCT FROM OLD.cost_price
     OR NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity
     OR NEW.low_stock_threshold IS DISTINCT FROM OLD.low_stock_threshold THEN
    RAISE EXCEPTION 'O representante pode alterar somente o preço de saída';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_representative_product_fields() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_protect_representative_product_fields
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.protect_representative_product_fields();

DROP POLICY IF EXISTS "own products" ON public.products;

CREATE POLICY "representatives read own products"
ON public.products FOR SELECT TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "representatives update own sale price"
ON public.products FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());