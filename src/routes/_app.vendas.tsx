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
import { Trash2, Search, Plus, X } from "lucide-react";
import { useSort, SortHeader } from "@/hooks/use-sort";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/vendas")({ component: VendasPage });

type CartItem = { product_id: string; quantity: number; unit_sale_price: number };

function VendasPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState<"paid" | "unpaid" | "scheduled">("paid");
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([{ product_id: "", quantity: 1, unit_sale_price: 0 }]);
  const [q, setQ] = useState("");
  const [periodMonth, setPeriodMonth] = useState<string>(""); // formato YYYY-MM
  const [filterProductId, setFilterProductId] = useState<string>("all");

  const load = async () => {
    const [{ data: p }, { data: c }, { data: s }] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("customers").select("*").order("name"),
      supabase.from("sales").select("*, products(name), customers(name)").order("created_at", { ascending: false }).limit(500),
    ]);
    setProducts(p ?? []); setCustomers(c ?? []); setSales(s ?? []);
  };
  useEffect(() => { load(); }, []);

  const updateItem = (idx: number, patch: Partial<CartItem>) => {
    setCart((c) => c.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      if (patch.product_id) {
        const p = products.find((x) => x.id === patch.product_id);
        if (p) next.unit_sale_price = Number(p.sale_price);
      }
      return next;
    }));
  };
  const addRow = () => setCart((c) => [...c, { product_id: "", quantity: 1, unit_sale_price: 0 }]);
  const removeRow = (idx: number) => setCart((c) => c.length === 1 ? c : c.filter((_, i) => i !== idx));
  const cartTotal = cart.reduce((a, it) => a + Number(it.unit_sale_price) * Number(it.quantity), 0);

  const submit = async () => {
    if (status === "scheduled" && !deliveryDate) return toast.error("Informe a data de entrega");
    if (cart.length === 0) return toast.error("Adicione ao menos um produto");
    const rows: any[] = [];
    for (const [i, it] of cart.entries()) {
      const p = products.find((x) => x.id === it.product_id);
      if (!p) return toast.error(`Linha ${i + 1}: selecione um produto`);
      if (it.quantity < 1) return toast.error(`Linha ${i + 1}: quantidade inválida`);
      if (it.quantity > p.stock_quantity) return toast.error(`${p.name}: estoque insuficiente (${p.stock_quantity})`);
      rows.push({
        product_id: p.id,
        quantity: it.quantity,
        unit_sale_price: it.unit_sale_price,
        unit_cost: Number(p.cost_price),
      });
    }
    const { data: u } = await supabase.auth.getUser();
    const payload = rows.map((r) => ({
      ...r,
      customer_id: customerId || null,
      status,
      delivery_date: status === "scheduled" ? deliveryDate : null,
      created_by: u.user?.id,
    }));
    const { error } = await supabase.from("sales").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} item(ns) registrado(s)`);
    setCart([{ product_id: "", quantity: 1, unit_sale_price: 0 }]);
    setDeliveryDate("");
    load();
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

  const inPeriod = (s: any) => {
    if (!periodMonth) return true;
    const d = new Date(s.created_at);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return ym === periodMonth;
  };
  const matchesProductFilter = (s: any) => filterProductId === "all" || s.product_id === filterProductId;

  const periodSales = sales.filter((s) => inPeriod(s) && matchesProductFilter(s));
  const periodItems = periodSales.reduce((a, s) => a + Number(s.quantity), 0);
  const periodValue = periodSales.reduce((a, s) => a + Number(s.unit_sale_price) * Number(s.quantity), 0);

  const filteredSales = periodSales.filter((s) => {
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

  const { sorted, sortKey, sortDir, toggle } = useSort(filteredSales, {
    created_at: (s) => new Date(s.created_at).getTime(),
    product: (s) => s.products?.name ?? "",
    customer: (s) => s.customers?.name ?? "",
    quantity: (s) => s.quantity,
    unit_sale_price: (s) => Number(s.unit_sale_price),
    total: (s) => Number(s.unit_sale_price) * s.quantity,
    status: (s) => statusLabel(s),
  }, { key: "created_at", dir: "desc" });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Vendas / Saídas</h2>
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <Label>Cliente</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Produtos da venda</Label>
            <Button type="button" size="sm" variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar produto
            </Button>
          </div>
          <div className="space-y-2">
            {cart.map((it, idx) => {
              const p = products.find((x) => x.id === it.product_id);
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded p-2">
                  <div className="col-span-12 md:col-span-6">
                    <Label className="text-xs">Produto</Label>
                    <Select value={it.product_id} onValueChange={(v) => updateItem(idx, { product_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {products.map((pp) => <SelectItem key={pp.id} value={pp.id}>{pp.name} (estq: {pp.stock_quantity})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-xs">Qtd</Label>
                    <Input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <Label className="text-xs">Valor un.</Label>
                    <Input type="number" step="0.01" value={it.unit_sale_price} onChange={(e) => updateItem(idx, { unit_sale_price: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-2 md:col-span-1 flex justify-end">
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeRow(idx)} disabled={cart.length === 1}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {p && (
                    <div className="col-span-12 text-xs text-muted-foreground">
                      Subtotal: <span className="font-semibold text-foreground">{fmtBRL(Number(it.unit_sale_price) * Number(it.quantity))}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">Total da venda</span>
            <span className="text-lg font-bold">{fmtBRL(cartTotal)}</span>
          </div>
          <Button onClick={submit} className="w-full">Registrar Venda</Button>
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

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Consulta de itens vendidos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Mês</Label>
            <Input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
          </div>
          <div>
            <Label>Produto</Label>
            <Select value={filterProductId} onValueChange={setFilterProductId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os produtos</SelectItem>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={() => { setPeriodMonth(""); setFilterProductId("all"); }}>
              Limpar filtros
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="rounded border p-3">
            <p className="text-xs text-muted-foreground">Itens vendidos no período</p>
            <p className="text-2xl font-bold">{periodItems}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-xs text-muted-foreground">Valor total no período</p>
            <p className="text-2xl font-bold text-primary">{fmtBRL(periodValue)}</p>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold">Histórico de Vendas {periodMonth && <span className="text-xs text-muted-foreground">(filtrado)</span>}</h3>
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar em todos os campos..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="text-left p-3"><SortHeader label="Data" sortKey="created_at" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-left p-3"><SortHeader label="Produto" sortKey="product" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-left p-3"><SortHeader label="Cliente" sortKey="customer" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-right p-3"><SortHeader label="Qtd" sortKey="quantity" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-right p-3"><SortHeader label="Valor Un." sortKey="unit_sale_price" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-right p-3"><SortHeader label="Total" sortKey="total" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-center p-3"><SortHeader label="Status" sortKey="status" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-center p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
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