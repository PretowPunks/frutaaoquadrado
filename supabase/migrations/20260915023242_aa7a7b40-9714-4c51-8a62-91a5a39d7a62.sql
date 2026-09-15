ALTER TABLE public.stock_transfers
  ADD COLUMN unit_sale_price numeric NOT NULL DEFAULT 0 CHECK (unit_sale_price >= 0);

UPDATE public.stock_transfers st
SET unit_sale_price = p.sale_price
FROM public.products p
WHERE p.id = st.source_product_id
  AND st.unit_sale_price = 0;

CREATE OR REPLACE FUNCTION public.apply_stock_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_target uuid; v_src public.products;
BEGIN
  SELECT * INTO v_src FROM public.products WHERE id = NEW.source_product_id;
  IF v_src.id IS NULL THEN RAISE EXCEPTION 'Produto de origem inexistente'; END IF;
  IF v_src.owner_id IS NOT NULL THEN RAISE EXCEPTION 'A origem deve ser um produto da matriz'; END IF;
  IF v_src.stock_quantity < NEW.quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente na matriz para %', v_src.name;
  END IF;

  UPDATE public.products SET stock_quantity = stock_quantity - NEW.quantity, updated_at = now()
    WHERE id = NEW.source_product_id;

  SELECT id INTO v_target FROM public.products
    WHERE owner_id = NEW.to_user_id AND name = v_src.name LIMIT 1;

  IF v_target IS NULL THEN
    INSERT INTO public.products (owner_id, name, cost_price, sale_price, low_stock_threshold, stock_quantity)
    VALUES (NEW.to_user_id, v_src.name, NEW.unit_sale_price, NEW.unit_sale_price, v_src.low_stock_threshold, NEW.quantity);
  ELSE
    UPDATE public.products
      SET stock_quantity = stock_quantity + NEW.quantity,
          cost_price = NEW.unit_sale_price,
          updated_at = now()
      WHERE id = v_target;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stock_transfer() FROM PUBLIC, anon, authenticated;