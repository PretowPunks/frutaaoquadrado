import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Play, Square, ShoppingCart, Snowflake, ShieldCheck, Search } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";

export const Route = createFileRoute("/_app/campo")({
  head: () => ({
    meta: [
      { title: "Expediente do Vendedor — Fruta²" },
      { name: "description", content: "Inicie o expediente, acompanhe seu estoque móvel e registre vendas na rua." },
      { property: "og:title", content: "Expediente do Vendedor — Fruta²" },
      { property: "og:description", content: "Jornada com rota por GPS, estoque móvel e venda rápida." },
    ],
  }),
  component: CampoPage,
});

const CONSENT_VERSION = "v1";
const MIN_INTERVAL_MS = 20000;

type Shift = { id: string; started_at: string; ended_at: string | null; start_city: string | null };
type Product = { id: string; name: string; sale_price: number; cost_price: number; stock_quantity: number };

function CampoPage() {
  const { user } = useAuth();
  const [consent, setConsent] = useState<boolean | null>(null);
  const [accept, setAccept] = useState(false);
  const [shift, setShift] = useState<Shift | null>(null);
  const [points, setPoints] = useState(0);
  const [city, setCity] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [q, setQ] = useState("");

  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [customerId, setCustomerId] = useState("none");
  const [status, setStatus] = useState<"paid" | "unpaid">("paid");
  const [saving, setSaving] = useState(false);

  const watchRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  const loadProducts = useCallback(async () => {
    if (!user) return;
    // A matriz vende direto do estoque da matriz (owner_id nulo); o representante, do estoque móvel dele.
    const base = supabase
      .from("products")
      .select("id, name, sale_price, cost_price, stock_quantity")
      .order("name");
    const { data } = await (isAdmin ? base.is("owner_id", null) : base.eq("owner_id", user.id));
    setProducts((data ?? []) as Product[]);
  }, [user, isAdmin]);


  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: c } = await supabase
        .from("privacy_consents")
        .select("id")
        .eq("user_id", user.id)
        .eq("version", CONSENT_VERSION)
        .maybeSingle();
      setConsent(!!c);

      const { data: s } = await supabase
        .from("work_shifts")
        .select("id, started_at, ended_at, start_city")
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setShift((s as Shift) ?? null);

      const { data: cust } = await supabase.from("customers").select("id, name").order("name");
      setCustomers((cust ?? []) as { id: string; name: string }[]);
    })();
    loadProducts();
  }, [user, loadProducts]);

  // Contagem de pontos da jornada atual
  useEffect(() => {
    if (!shift) return setPoints(0);
    supabase
      .from("shift_route_points")
      .select("id", { count: "exact", head: true })
      .eq("shift_id", shift.id)
      .then(({ count }) => setPoints(count ?? 0));
  }, [shift]);

  const stopWatch = useCallback(() => {
    if (watchRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  // Rastreio ativo SOMENTE enquanto há expediente aberto (LGPD)
  useEffect(() => {
    if (!shift || !consent) {
      stopWatch();
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Este dispositivo não fornece GPS.");
      return;
    }

    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastRef.current < MIN_INTERVAL_MS) return;
        lastRef.current = now;
        const { error } = await supabase.from("shift_route_points").insert({
          shift_id: shift.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        if (!error) setPoints((p) => p + 1);
      },
      (err) => toast.error(`GPS: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
    );

    return stopWatch;
  }, [shift, consent, stopWatch]);

  const acceptConsent = async () => {
    const { error } = await supabase.from("privacy_consents").insert({
      version: CONSENT_VERSION,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    if (error) return toast.error(error.message);
    setConsent(true);
    toast.success("Termo aceito. Você já pode iniciar o expediente.");
  };

  const startShift = async () => {
    const { data, error } = await supabase
      .from("work_shifts")
      .insert({ start_city: city.trim() || null })
      .select("id, started_at, ended_at, start_city")
      .single();
    if (error) return toast.error(error.message);
    lastRef.current = 0;
    setShift(data as Shift);
    toast.success("Expediente iniciado — rota sendo registrada.");
  };

  const endShift = async () => {
    if (!shift) return;
    stopWatch();
    const { error } = await supabase
      .from("work_shifts")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", shift.id);
    if (error) return toast.error(error.message);
    setShift(null);
    toast.success("Expediente encerrado — rastreamento interrompido.");
  };

  const selected = products.find((p) => p.id === productId);
  useEffect(() => {
    if (selected) setPrice(String(selected.sale_price));
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const registerSale = async () => {
    if (!selected) return toast.error("Selecione um produto");
    const quantity = Number(qty);
    const unit = Number(price);
    if (!Number.isFinite(quantity) || quantity <= 0) return toast.error("Quantidade inválida");
    if (!Number.isFinite(unit) || unit < 0) return toast.error("Valor inválido");
    if (quantity > selected.stock_quantity)
      return toast.error(`Estoque móvel insuficiente (${selected.stock_quantity} un.)`);

    setSaving(true);
    const { error } = await supabase.from("sales").insert({
      product_id: selected.id,
      customer_id: customerId === "none" ? null : customerId,
      quantity,
      unit_sale_price: unit,
      unit_cost: selected.cost_price,
      status,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Venda registrada");
    setQty("1");
    setProductId("");
    setCustomerId("none");
    loadProducts();
  };

  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase().trim()));
  const stockUnits = products.reduce((a, p) => a + p.stock_quantity, 0);

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-10">
      <div>
        <h2 className="text-2xl font-bold">Meu Expediente</h2>
        <p className="text-sm text-muted-foreground">Painel de rua — jornada, estoque móvel e venda rápida.</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <span className="font-semibold">Jornada</span>
          </div>
          {shift ? (
            <Badge>Em expediente</Badge>
          ) : (
            <Badge variant="secondary">Fora de expediente</Badge>
          )}
        </div>

        {shift ? (
          <>
            <p className="text-sm text-muted-foreground">
              Início: <strong className="text-foreground">{new Date(shift.started_at).toLocaleString("pt-BR")}</strong>
              {shift.start_city ? ` · ${shift.start_city}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              Pontos de rota gravados: <strong className="text-foreground">{points}</strong>
            </p>
            <Button variant="destructive" className="w-full h-12 text-base" onClick={endShift}>
              <Square className="h-5 w-5 mr-2" /> Encerrar Expediente
            </Button>
          </>
        ) : (
          <>
            <div>
              <Label>Município inicial (opcional)</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Feira de Santana" />
            </div>
            <Button className="w-full h-12 text-base" onClick={startShift} disabled={!consent}>
              <Play className="h-5 w-5 mr-2" /> Iniciar Expediente
            </Button>
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
              A localização é registrada apenas entre o início e o encerramento do expediente.
            </p>
          </>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-primary" />
            <span className="font-semibold">Estoque móvel</span>
          </div>
          <span className="text-sm text-muted-foreground">{stockUnits} un. no carro/freezer</span>
        </div>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar sabor..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="divide-y max-h-72 overflow-auto">
          {filtered.map((p) => (
            <li key={p.id} className="py-2 flex items-center justify-between text-sm">
              <span>{p.name}</span>
              <span className={p.stock_quantity > 0 ? "font-semibold" : "font-semibold text-destructive"}>
                {p.stock_quantity} un. · {fmtBRL(Number(p.sale_price))}
              </span>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">
              Nenhum item. Peça uma transferência de estoque à matriz.
            </li>
          )}
        </ul>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <span className="font-semibold">Venda rápida</span>
        </div>

        <div>
          <Label>Produto</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger><SelectValue placeholder="Selecione o sabor" /></SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id} disabled={p.stock_quantity <= 0}>
                  {p.name} ({p.stock_quantity} un.)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Quantidade</Label>
            <Input type="number" min="1" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <Label>Valor unitário</Label>
            <Input type="number" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Cliente (opcional)</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem cliente</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={status === "paid" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setStatus("paid")}
          >
            Pago
          </Button>
          <Button
            type="button"
            variant={status === "unpaid" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setStatus("unpaid")}
          >
            A pagar
          </Button>
        </div>

        {selected && (
          <p className="text-sm text-muted-foreground">
            Total: <strong className="text-foreground">{fmtBRL(Number(price || 0) * Number(qty || 0))}</strong>
          </p>
        )}

        <Button className="w-full h-12 text-base" onClick={registerSale} disabled={saving}>
          Registrar venda
        </Button>
      </Card>

      <Dialog open={consent === false}>
        <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Termo de Privacidade (LGPD)</DialogTitle>
            <DialogDescription>Leia e aceite para usar o painel de rua.</DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-2 max-h-64 overflow-auto text-muted-foreground">
            <p>
              A Fruta² coleta sua localização geográfica <strong>exclusivamente durante o expediente de trabalho</strong>,
              com a finalidade de registrar a rota de atendimento entre os municípios e permitir auditoria das visitas.
            </p>
            <p>
              O rastreamento começa quando você clica em <strong>Iniciar Expediente</strong> e é{" "}
              <strong>interrompido imediatamente</strong> ao clicar em <strong>Encerrar Expediente</strong>. Fora desse
              período nenhum dado de localização é coletado.
            </p>
            <p>
              Os dados são armazenados de forma segura, acessíveis apenas a você e à administração da empresa, e podem
              ser solicitados para consulta ou exclusão a qualquer momento, conforme a Lei nº 13.709/2018 (LGPD).
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={accept} onCheckedChange={(v) => setAccept(v === true)} />
            <span>Li e concordo com a coleta de localização durante o expediente.</span>
          </label>
          <DialogFooter>
            <Button disabled={!accept} onClick={acceptConsent}>Aceitar e continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
