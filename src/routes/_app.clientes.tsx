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
import { useScope } from "@/hooks/use-scope";
import { PrintPortal } from "@/components/print-portal";
import { OrderCardDoc } from "@/components/print-docs";
import { Printer, Copy, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_app/clientes")({ component: ClientesPage });

function ClientesPage() {
  const { ownerId, isViewingRep } = useScope();
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [address, setAddress] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reportOpen, setReportOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("customers").select("*").eq("owner_id", ownerId).order("name");
    setCustomers(data ?? []);
  };
  useEffect(() => { if (ownerId) { setSelected(null); load(); } }, [ownerId]);

  useEffect(() => {
    if (!selected) { setHistory([]); return; }
    setPicked(new Set());
    (supabase as any).from("sales").select("*, products(name)").eq("customer_id", selected.id)
      .order("created_at", { ascending: false })
      .then(({ data }: any) => setHistory(data ?? []));
  }, [selected]);

  const histSort = useSort(history, {
    created_at: (h) => new Date(h.created_at).getTime(),
    product: (h) => h.products?.name ?? "",
    quantity: (h) => h.quantity,
    total: (h) => Number(h.unit_sale_price) * h.quantity,
    status: (h) => h.status,
  }, { key: "created_at", dir: "desc" });

  const create = async () => {
    if (isViewingRep) return toast.error("Você está apenas consultando os dados do representante.");
    if (!name.trim()) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("customers").insert({ name, phone, address, owner_id: ownerId });
    if (error) return toast.error(error.message);
    toast.success("Cliente cadastrado");
    setName(""); setPhone(""); setAddress(""); setOpen(false); load();
  };

  // Itens selecionados no histórico → viram o relatório do pedido
  const pickedSales = history.filter((h) => picked.has(h.id));
  const allPicked = history.length > 0 && picked.size === history.length;
  const togglePick = (id: string) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  };
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(history.map((h) => h.id)));

  const statusLabel = (h: any) =>
    h.payment_method === "boleto"
      ? `Boleto${h.boleto_due_date ? ` — vence ${new Date(h.boleto_due_date + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}`
      : h.status === "paid" ? "Pago"
      : h.status === "unpaid" ? "A pagar"
      : "Entrega agendada";

  const reportItems = pickedSales.map((i: any) => ({
    product_name: i.products?.name ?? "—",
    quantity: i.quantity,
    unit_price: Number(i.unit_sale_price),
    total: Number(i.unit_sale_price) * i.quantity,
  }));
  const reportTotal = reportItems.reduce((a, i) => a + i.total, 0);
  const reportStatus = (() => {
    const labels = Array.from(new Set(pickedSales.map(statusLabel)));
    return labels.length === 1 ? labels[0]! : labels.join(" · ");
  })();

  const copyReport = () => {
    const lines = [
      `*Fruta² — Pedido*`,
      `Cliente: ${selected?.name}`,
      `Data: ${new Date().toLocaleDateString("pt-BR")}`,
      "",
      ...reportItems.map((i) => `• ${i.product_name} — ${i.quantity} x ${fmtBRL(i.unit_price)} = ${fmtBRL(i.total)}`),
      "",
      `*Total: ${fmtBRL(reportTotal)}*`,
      reportStatus,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Pedido copiado — cole no WhatsApp ou Instagram");
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
        {!isViewingRep && (
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
        )}
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
                <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
                  <h4 className="font-semibold">Histórico de Compras</h4>
                  <div className="flex items-center gap-3">
                    {picked.size > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {picked.size} selecionado(s) · <strong className="text-foreground">{fmtBRL(reportTotal)}</strong>
                      </span>
                    )}
                    <Button size="sm" variant="outline" disabled={picked.size === 0} onClick={() => setReportOpen(true)}>
                      <FileText className="h-4 w-4 mr-1" /> Gerar relatório
                    </Button>
                  </div>
                </div>
                {history.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Nenhuma compra registrada.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-secondary-foreground">
                      <tr>
                        <th className="p-3 w-10"><Checkbox checked={allPicked} onCheckedChange={toggleAll} /></th>
                        <th className="text-left p-3"><SortHeader label="Data" sortKey="created_at" currentKey={histSort.sortKey} dir={histSort.sortDir} onToggle={histSort.toggle} /></th>
                        <th className="text-left p-3"><SortHeader label="Produto" sortKey="product" currentKey={histSort.sortKey} dir={histSort.sortDir} onToggle={histSort.toggle} /></th>
                        <th className="text-right p-3"><SortHeader label="Qtd" sortKey="quantity" currentKey={histSort.sortKey} dir={histSort.sortDir} onToggle={histSort.toggle} /></th>
                        <th className="text-right p-3"><SortHeader label="Total" sortKey="total" currentKey={histSort.sortKey} dir={histSort.sortDir} onToggle={histSort.toggle} /></th>
                        <th className="text-center p-3"><SortHeader label="Status" sortKey="status" currentKey={histSort.sortKey} dir={histSort.sortDir} onToggle={histSort.toggle} /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {histSort.sorted.map((h) => (
                        <tr key={h.id} className={"border-t " + (picked.has(h.id) ? "bg-muted/50" : "")}>
                          <td className="p-3">
                            <Checkbox checked={picked.has(h.id)} onCheckedChange={() => togglePick(h.id)} />
                          </td>
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

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Pedido — conferência do cliente</DialogTitle></DialogHeader>
          {reportItems.length > 0 && selected && (
            <>
              <div className="max-h-[65vh] overflow-auto">
                <OrderCardDoc
                  customer={{ name: selected.name, phone: selected.phone }}
                  createdAt={new Date().toISOString()}
                  items={reportItems}
                  status={reportStatus}
                />
              </div>
              <PrintPortal>
                <OrderCardDoc
                  customer={{ name: selected.name, phone: selected.phone }}
                  createdAt={new Date().toISOString()}
                  items={reportItems}
                  status={reportStatus}
                />
              </PrintPortal>
            </>
          )}
          <DialogFooter className="print:hidden gap-2">
            <Button variant="outline" onClick={copyReport}>
              <Copy className="h-4 w-4 mr-2" /> Copiar texto
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}