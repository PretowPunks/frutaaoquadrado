CREATE OR REPLACE FUNCTION public.validate_representative_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  customer_owner uuid;
  product_is_central boolean;
BEGIN
  IF private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Somente a matriz pode alterar pedidos';
  END IF;

  IF NEW.owner_id IS DISTINCT FROM auth.uid()
     OR NEW.created_by IS DISTINCT FROM auth.uid()
     OR NEW.status IS DISTINCT FROM 'scheduled'::public.sale_status
     OR NEW.delivery_date IS NULL THEN
    RAISE EXCEPTION 'Representantes podem registrar apenas pedidos próprios com entrega agendada';
  END IF;

  SELECT c.owner_id INTO customer_owner
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  IF customer_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cliente fora da carteira do representante';
  END IF;

  SELECT p.owner_id IS NULL INTO product_is_central
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF product_is_central IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'O pedido deve usar um produto do catálogo da matriz';
  END IF;

  RETURN NEW;
END;
$$;