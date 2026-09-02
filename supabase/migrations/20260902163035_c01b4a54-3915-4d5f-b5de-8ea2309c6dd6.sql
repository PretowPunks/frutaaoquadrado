-- =========================
-- 1. JORNADAS DE TRABALHO
-- =========================
CREATE TABLE public.work_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  start_city text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_shifts TO authenticated;
GRANT ALL ON public.work_shifts TO service_role;
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own work_shifts" ON public.work_shifts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin all work_shifts" ON public.work_shifts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_work_shifts_user ON public.work_shifts(user_id, started_at DESC);

CREATE TRIGGER update_work_shifts_updated_at BEFORE UPDATE ON public.work_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- 2. PONTOS DE ROTA (GPS)
-- =========================
CREATE TABLE public.shift_route_points (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id uuid NOT NULL REFERENCES public.work_shifts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.shift_route_points TO authenticated;
GRANT ALL ON public.shift_route_points TO service_role;
ALTER TABLE public.shift_route_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own route points" ON public.shift_route_points FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin all route points" ON public.shift_route_points FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_route_points_shift ON public.shift_route_points(shift_id, recorded_at);

-- =========================
-- 3. CONSENTIMENTO LGPD
-- =========================
CREATE TABLE public.privacy_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  version text NOT NULL DEFAULT 'v1',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, version)
);

GRANT SELECT, INSERT ON public.privacy_consents TO authenticated;
GRANT ALL ON public.privacy_consents TO service_role;
ALTER TABLE public.privacy_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own consent" ON public.privacy_consents FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin read consent" ON public.privacy_consents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- 4. TRANSFERÊNCIAS DE ESTOQUE (MATRIZ -> VENDEDOR)
-- =========================
CREATE TABLE public.stock_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  to_user_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost numeric NOT NULL DEFAULT 0,
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.stock_transfers TO authenticated;
GRANT ALL ON public.stock_transfers TO service_role;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all stock_transfers" ON public.stock_transfers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "rep reads own transfers" ON public.stock_transfers FOR SELECT TO authenticated
  USING (to_user_id = auth.uid());

CREATE INDEX idx_stock_transfers_user ON public.stock_transfers(to_user_id, created_at DESC);

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
  IF v_src.stock_quantity < NEW.quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente na matriz para %', v_src.name;
  END IF;

  UPDATE public.products SET stock_quantity = stock_quantity - NEW.quantity, updated_at = now()
    WHERE id = NEW.source_product_id;

  SELECT id INTO v_target FROM public.products
    WHERE owner_id = NEW.to_user_id AND name = v_src.name LIMIT 1;

  IF v_target IS NULL THEN
    INSERT INTO public.products (owner_id, name, cost_price, sale_price, low_stock_threshold, stock_quantity)
    VALUES (NEW.to_user_id, v_src.name, v_src.cost_price, v_src.sale_price, v_src.low_stock_threshold, NEW.quantity);
  ELSE
    UPDATE public.products SET stock_quantity = stock_quantity + NEW.quantity, updated_at = now()
      WHERE id = v_target;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.revert_stock_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_target uuid;
BEGIN
  UPDATE public.products SET stock_quantity = stock_quantity + OLD.quantity, updated_at = now()
    WHERE id = OLD.source_product_id;

  SELECT id INTO v_target FROM public.products
    WHERE owner_id = OLD.to_user_id AND name = OLD.product_name LIMIT 1;
  IF v_target IS NOT NULL THEN
    UPDATE public.products SET stock_quantity = GREATEST(stock_quantity - OLD.quantity, 0), updated_at = now()
      WHERE id = v_target;
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stock_transfer() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revert_stock_transfer() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_apply_stock_transfer AFTER INSERT ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_transfer();
CREATE TRIGGER trg_revert_stock_transfer BEFORE DELETE ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.revert_stock_transfer();

-- =========================
-- 5. TEMPO REAL
-- =========================
ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.work_shifts REPLICA IDENTITY FULL;
ALTER TABLE public.shift_route_points REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_route_points;