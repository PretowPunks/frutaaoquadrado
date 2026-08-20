import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { useSort, SortHeader } from "@/hooks/use-sort";
import { PrintPortal } from "@/components/print-portal";
import { OrderCardDoc } from "@/components/print-docs";
import { Printer, Copy, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/clientes")({ component: ClientesPage });

function ClientesPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [address, setAddress] = useState("");
  const [order, setOrder] = useState<any | null>(null);

  const load = async () => {
    const { data } = await supabase.from("customers").select("*").order("name");
    setCustomers(data ?? []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected) { setHistory([]); return; }
    supabase.from("sales").select("*, products(name)").eq("customer_id", selected.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setHistory(data ?? []));
  }, [selected]);

  const histSort = useSort(history, {
    created_at: (h) => new Date(h.created_at).getTime(),
    product: (h) => h.products?.name ?? "",
    quantity: (h) => h.quantity,
    total: (h) => Number(h.unit_sale_price) * h.quantity,
    status: (h) => h.status,
  }, { key: "created_at", dir: "desc" });

  const create = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("customers").insert({ name, phone, address });
    if (error) return toast.error(error.message);
    toast.success("Cliente cadastrado");
    setName(""); setPhone(""); setAddress(""); setOpen(false); load();
  };

  // Agrupa as vendas do cliente em "pedidos" (itens lançados no mesmo momento)
  const orders = (() => {
    const map = new Map<string, any>();
    for (const h of history) {
      const key = new Date(h.created_at).toISOString().slice(0, 16);
      const cur = map.get(key) ?? { key, created_at: h.created_at, items: [] as any[], status: h.status, payment_method: h.payment_method, boleto_due_date: h.boleto_due_date };
      cur.items.push(h);
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map((o) => ({ ...o, total: o.items.reduce((a: number, i: any) => a + Number(i.unit_sale_price) * i.quantity, 0) }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  })();

  const orderStatusLabel = (o: any) =>
    o.payment_method === "boleto"
      ? `Boleto${o.boleto_due_date ? ` — vence ${new Date(o.boleto_due_date + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}`
      : o.status === "paid" ? "Pago"
      : o.status === "unpaid" ? "A pagar"
      : "Entrega agendada";

  const orderItems = (o: any) =>
    o.items.map((i: any) => ({
      product_name: i.products?.name ?? "—",
      quantity: i.quantity,
      unit_price: Number(i.unit_sale_price),
      total: Number(i.unit_sale_price) * i.quantity,
    }));

  const copyOrder = (o: any) => {
    const lines = [
      `*Fruta² — Pedido*`,
      `Cliente: ${selected?.name}`,
      `Data: ${new Date(o.created_at).toLocaleDateString("pt-BR")}`,
      "",
      ...orderItems(o).map((i: any) => `• ${i.product_name} — ${i.quantity} x ${fmtBRL(i.unit_price)} = ${fmtBRL(i.total)}`),
      "",
      `*Total: ${fmtBRL(o.total)}*`,
      orderStatusLabel(o),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Pedido copiado — cole no WhatsApp ou Instagram");
  };

  const createLegacy = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("customers").insert({ name, phone, address });
    if (error) return toast.error(error.message);
    toast.success("Cliente cadastrado");
    setName(""); setPhone(""); setAddress(""); setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover cliente?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const filtered = customers.filter((c) => {
    const t = search.toLowerCase().trim();
    if (!t) return true;
    return [c.name, c.phone ?? "", c.address ?? ""].some((v) => String(v).toLowerCase().includes(t));
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Clientes</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Cliente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div><Label>Endereço</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={create}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-4 space-y-3 lg:col-span-1">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome, telefone ou endereço..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <ul className="divide-y max-h-[60vh] overflow-auto">
            {filtered.map((c) => (
              <li key={c.id}
                onClick={() => setSelected(c)}
                className={"p-3 cursor-pointer hover:bg-muted/50 rounded " + (selected?.id === c.id ? "bg-muted" : "")}>
                <span className="font-medium">{c.name}</span>
                {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
              </li>
            ))}
            {filtered.length === 0 && <p className="text-sm text-muted-foreground p-3">Nenhum cliente.</p>}
          </ul>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <Card className="p-10 text-center text-muted-foreground">Selecione um cliente para ver os detalhes</Card>
          ) : (
            <>
              <Card className="p-5 space-y-2">
                <div className="flex justify-between">
                  <h3 className="text-xl font-bold">{selected.name}</h3>
                  <Button variant="ghost" size="sm" onClick={() => remove(selected.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <p className="text-sm"><strong>Telefone:</strong> {selected.phone || "—"}</p>
                <p className="text-sm"><strong>Endereço:</strong> {selected.address || "—"}</p>
              </Card>
              <Card className="p-0 overflow-hidden">
                <h4 className="p-4 font-semibold border-b">Histórico de Compras</h4>
                {history.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Nenhuma compra registrada.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-secondary-foreground">
                      <tr>
                        <th className="text-left p-3"><SortHeader label="Data" sortKey="created_at" currentKey={histSort.sortKey} dir={histSort.sortDir} onToggle={histSort.toggle} /></th>
                        <th className="text-left p-3"><SortHeader label="Produto" sortKey="product" currentKey={histSort.sortKey} dir={histSort.sortDir} onToggle={histSort.toggle} /></th>
                        <th className="text-right p-3"><SortHeader label="Qtd" sortKey="quantity" currentKey={histSort.sortKey} dir={histSort.sortDir} onToggle={histSort.toggle} /></th>
                        <th className="text-right p-3"><SortHeader label="Total" sortKey="total" currentKey={histSort.sortKey} dir={histSort.sortDir} onToggle={histSort.toggle} /></th>
                        <th className="text-center p-3"><SortHeader label="Status" sortKey="status" currentKey={histSort.sortKey} dir={histSort.sortDir} onToggle={histSort.toggle} /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {histSort.sorted.map((h) => (
                        <tr key={h.id} className="border-t">
                          <td className="p-3">{new Date(h.created_at).toLocaleDateString("pt-BR")}</td>
                          <td className="p-3">{h.products?.name}</td>
                          <td className="p-3 text-right">{h.quantity}</td>
                          <td className="p-3 text-right">{fmtBRL(Number(h.unit_sale_price) * h.quantity)}</td>
                          <td className="p-3 text-center">
                            <Badge variant={h.status === "paid" ? "default" : "destructive"}>
                              {h.status === "paid" ? "Pago" : "A Pagar"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}