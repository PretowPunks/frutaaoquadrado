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
import { Trash2, Search } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/vendas")({ component: VendasPage });

function VendasPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [qty, setQty] = useState(1);
  const [unitSale, setUnitSale] = useState(0);
  const [status, setStatus] = useState<"paid" | "unpaid" | "scheduled">("paid");
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [q, setQ] = useState("");

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
    if (status === "scheduled" && !deliveryDate) return toast.error("Informe a data de entrega");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("sales").insert({
      product_id: productId,
      customer_id: customerId || null,
      quantity: qty,
      unit_sale_price: unitSale,
      unit_cost: Number(p.cost_price),
      status,
      delivery_date: status === "scheduled" ? deliveryDate : null,
      created_by: u.user?.id,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Venda registrada");
    setQty(1); setDeliveryDate(""); load();
  };

  const setSaleStatus = async (s: any, next: "paid" | "unpaid" | "scheduled") => {
    const patch: any = { status: next };
    if (next !== "scheduled") patch.delivery_date = null;
    const { error } = await supabase.from("sales").update(patch).eq("id", s.id);
    if (error) return toast.error(error.message);
    load();
  };

  const removeSale = async (s: any) => {
    const { error } = await supabase.from("sales").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Venda excluída, estoque restaurado");
    load();
  };

  const supplierReturn = sales
    .filter((s) => s.status !== "scheduled")
    .reduce((acc, s) => acc + Number(s.unit_cost) * s.quantity, 0);
  const pending = sales.filter((s) => s.status === "unpaid").reduce((a, s) => a + Number(s.unit_sale_price) * s.quantity, 0);
  const scheduledCount = sales.filter((s) => s.status === "scheduled").length;

  const statusLabel = (s: any) =>
    s.status === "paid" ? "Pago" :
    s.status === "unpaid" ? "A Pagar" :
    `Agendada ${s.delivery_date ? new Date(s.delivery_date + "T00:00:00").toLocaleDateString("pt-BR") : ""}`;

  const filteredSales = sales.filter((s) => {
    const t = q.toLowerCase().trim();
    if (!t) return true;
    return [
      s.products?.name ?? "",
      s.customers?.name ?? "",
      String(s.quantity),
      fmtBRL(s.unit_sale_price),
      fmtBRL(Number(s.unit_sale_price) * s.quantity),
      statusLabel(s),
      new Date(s.created_at).toLocaleString("pt-BR"),
    ].some((v) => String(v).toLowerCase().includes(t));
  });

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
                <SelectItem value="scheduled">Agendada (entrega futura)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {status === "scheduled" && (
            <div>
              <Label>Data de entrega</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
          )}
          <div className="flex items-end"><Button onClick={submit} className="w-full">Registrar Venda</Button></div>
        </div>
        <p className="text-xs text-muted-foreground">
          Vendas agendadas dão baixa no estoque imediatamente. Clique na etiqueta para concluir como Pago / A Pagar, ou exclua para devolver ao estoque.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">A retornar ao fornecedor (todas as vendas)</p>
          <p className="text-2xl font-bold text-primary">{fmtBRL(supplierReturn)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Vendas A Pagar (pendentes)</p>
          <p className="text-2xl font-bold">{fmtBRL(pending)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Entregas agendadas</p>
          <p className="text-2xl font-bold">{scheduledCount}</p>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold">Histórico de Vendas</h3>
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar em todos os campos..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="text-left p-3">Data</th><th className="text-left p-3">Produto</th>
              <th className="text-left p-3">Cliente</th><th className="text-right p-3">Qtd</th>
              <th className="text-right p-3">Valor Un.</th><th className="text-right p-3">Total</th>
              <th className="text-center p-3">Status</th><th className="text-center p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3">{new Date(s.created_at).toLocaleString("pt-BR")}</td>
                <td className="p-3">{s.products?.name}</td>
                <td className="p-3">{s.customers?.name ?? "—"}</td>
                <td className="p-3 text-right">{s.quantity}</td>
                <td className="p-3 text-right">{fmtBRL(s.unit_sale_price)}</td>
                <td className="p-3 text-right font-semibold">{fmtBRL(Number(s.unit_sale_price) * s.quantity)}</td>
                <td className="p-3 text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button>
                        <Badge
                          variant={
                            s.status === "paid" ? "default" :
                            s.status === "scheduled" ? "secondary" : "destructive"
                          }
                        >
                          {s.status === "paid" && "Pago"}
                          {s.status === "unpaid" && "A Pagar"}
                          {s.status === "scheduled" && `Entrega ${s.delivery_date ? new Date(s.delivery_date + "T00:00:00").toLocaleDateString("pt-BR") : ""}`}
                        </Badge>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setSaleStatus(s, "paid")}>Marcar como Pago</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSaleStatus(s, "unpaid")}>Marcar como A Pagar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSaleStatus(s, "scheduled")}>Marcar como Agendada</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
                <td className="p-3 text-center">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir venda?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O produto voltará ao estoque automaticamente. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeSale(s)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}