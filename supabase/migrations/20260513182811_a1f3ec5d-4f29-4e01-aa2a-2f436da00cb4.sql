
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Trigger to create profile + assign role on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email));

  IF NEW.email = 'allissonfilo@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock entries
CREATE TABLE public.stock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(10,2) NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales
CREATE TYPE public.sale_status AS ENUM ('paid', 'unpaid');

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  customer_id UUID REFERENCES public.customers(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_sale_price NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL,
  status public.sale_status NOT NULL DEFAULT 'paid',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers to update stock
CREATE OR REPLACE FUNCTION public.apply_stock_entry()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.products SET stock_quantity = stock_quantity + NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_apply_stock_entry AFTER INSERT ON public.stock_entries
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_entry();

CREATE OR REPLACE FUNCTION public.apply_sale()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.products SET stock_quantity = stock_quantity - NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_apply_sale AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.apply_sale();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Policies: any authenticated user can do everything in this internal app
CREATE POLICY "auth read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "self update profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "read own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "auth all products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all entries" ON public.stock_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all sales" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed products
INSERT INTO public.products (name, cost_price, sale_price) VALUES
('Abacaxi', 13.00, 18.00),
('Abacaxi com Hortelã', 14.00, 20.00),
('Acerola', 14.00, 20.00),
('Acerola com Laranja', 15.00, 21.00),
('Amora', 25.00, 35.00),
('Caju', 14.00, 20.00),
('Cupuaçú', 23.00, 30.00),
('Frutas Amarelas', 18.00, 25.00),
('Frutas Vermelhas', 25.00, 30.00),
('Goiaba', 12.00, 18.00),
('Graviola', 23.00, 30.00),
('Limão', 12.00, 18.00),
('Mamão com Laranja', 14.00, 20.00),
('Manga', 14.00, 20.00),
('Maracujá', 23.00, 30.00),
('Maracujá com Morango', 23.00, 30.00),
('Melancia', 12.00, 18.00),
('Melão', 15.00, 20.00),
('Morango', 18.00, 25.00),
('Tamarindo', 18.00, 25.00),
('Uva', 18.00, 25.00),
('Abacaxi Fruta', 13.00, 20.00),
('Maracujá com Semente', 23.00, 30.00),
('Morango Fruta', 15.00, 20.00),
('Pão de Queijo', 20.00, 25.00);
