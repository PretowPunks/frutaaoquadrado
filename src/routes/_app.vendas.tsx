import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/vendas")({ component: VendasPage });

function VendasPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [qty, setQty] = useState(1);
  const [unitSale, setUnitSale] = useState(0);
  const [status, setStatus] = useState<"paid" | "unpaid">("paid");

  const load = async () => {
    const [{ data: p }, { data: c }, { data: s }] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("customers").select("*").order("name"),
      supabase.from("sales").select("*, products(name), customers(name)").order("created_at", { ascending: false }).limit(100),
    ]);
    setProducts(p ?? []); setCustomers(c ?? []); setSales(s ?? []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const p = products.find((x) => x.id === productId);
    if (p) setUnitSale(Number(p.sale_price));
  }, [productId, products]);

  const submit = async () => {
    const p = products.find((x) => x.id === productId);
    if (!p) return toast.error("Selecione um produto");
    if (qty < 1) return toast.error("Quantidade inválida");
    if (qty > p.stock_quantity) return toast.error("Estoque insuficiente");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("sales").insert({
      product_id: productId,
      customer_id: customerId || null,
      quantity: qty,
      unit_sale_price: unitSale,
      unit_cost: Number(p.cost_price),
      status,
      created_by: u.user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Venda registrada");
    setQty(1); load();
  };

  const togglePaid = async (s: any) => {
    const { error } = await supabase.from("sales").update({ status: s.status === "paid" ? "unpaid" : "paid" }).eq("id", s.id);
    if (error) return toast.error(error.message);
    load();
  };

  const supplierReturn = sales.reduce((acc, s) => acc + Number(s.unit_cost) * s.quantity, 0);
  const pending = sales.filter((s) => s.status === "unpaid").reduce((a, s) => a + Number(s.unit_sale_price) * s.quantity, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Vendas / Saídas</h2>
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} (estq: {p.stock_quantity})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cliente</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Quantidade</Label><Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
          <div>
            <Label>Valor de Saída (un.)</Label>
            <Input type="number" step="0.01" value={unitSale} onChange={(e) => setUnitSale(Number(e.target.value))} />
            <p className="text-xs text-muted-foreground mt-1">Preenchido automaticamente — edite para descontos.</p>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="unpaid">A Pagar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end"><Button onClick={submit} className="w-full">Registrar Venda</Button></div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">A retornar ao fornecedor (todas as vendas)</p>
          <p className="text-2xl font-bold text-primary">{fmtBRL(supplierReturn)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Vendas A Pagar (pendentes)</p>
          <p className="text-2xl font-bold">{fmtBRL(pending)}</p>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <h3 className="p-4 font-semibold border-b">Histórico de Vendas</h3>
        <table className="w-full text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="text-left p-3">Data</th><th className="text-left p-3">Produto</th>
              <th className="text-left p-3">Cliente</th><th className="text-right p-3">Qtd</th>
              <th className="text-right p-3">Valor Un.</th><th className="text-right p-3">Total</th>
              <th className="text-center p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3">{new Date(s.created_at).toLocaleString("pt-BR")}</td>
                <td className="p-3">{s.products?.name}</td>
                <td className="p-3">{s.customers?.name ?? "—"}</td>
                <td className="p-3 text-right">{s.quantity}</td>
                <td className="p-3 text-right">{fmtBRL(s.unit_sale_price)}</td>
                <td className="p-3 text-right font-semibold">{fmtBRL(Number(s.unit_sale_price) * s.quantity)}</td>
                <td className="p-3 text-center">
                  <button onClick={() => togglePaid(s)}>
                    <Badge variant={s.status === "paid" ? "default" : "destructive"}>
                      {s.status === "paid" ? "Pago" : "A Pagar"}
                    </Badge>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}