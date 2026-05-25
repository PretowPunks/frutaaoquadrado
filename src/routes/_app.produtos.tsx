import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Download, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";
import { useSort, SortHeader } from "@/hooks/use-sort";

export const Route = createFileRoute("/_app/produtos")({ component: ProdutosPage });

type Product = {
  id: string;
  name: string;
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
};

function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [salesByProduct, setSalesByProduct] = useState<Record<string, number>>({});
  const [windowDays, setWindowDays] = useState(30);
  const [coverDays, setCoverDays] = useState(7);
  const [openReplenish, setOpenReplenish] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("products").select("*").order("name");
    setProducts((data ?? []) as Product[]);
    const since = new Date(Date.now() - windowDays * 86400000).toISOString();
    const { data: s } = await supabase
      .from("sales")
      .select("product_id, quantity, created_at")
      .gte("created_at", since);
    const map: Record<string, number> = {};
    for (const r of (s ?? []) as any[]) {
      map[r.product_id] = (map[r.product_id] ?? 0) + Number(r.quantity);
    }
    setSalesByProduct(map);
  };
  useEffect(() => { load(); }, [windowDays]);

  const save = async (form: Omit<Product, "id" | "stock_quantity"> & { id?: string }) => {
    if (form.id) {
      const { error } = await supabase.from("products").update({
        name: form.name, cost_price: form.cost_price, sale_price: form.sale_price,
        low_stock_threshold: form.low_stock_threshold,
      }).eq("id", form.id);
      if (error) return toast.error(error.message);
      toast.success("Produto atualizado");
    } else {
      const { error } = await supabase.from("products").insert({
        name: form.name, cost_price: form.cost_price, sale_price: form.sale_price,
        low_stock_threshold: form.low_stock_threshold,
      });
      if (error) return toast.error(error.message);
      toast.success("Produto cadastrado");
    }
    setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido"); load();
  };

  const exportStock = () => {
    const items = products.filter((p) => p.stock_quantity > 0);
    if (items.length === 0) return toast.error("Nenhum item com estoque para exportar");
    const header = ["Produto", "Estoque", "Valor Entrada", "Valor Saida", "Valor Total Estoque"];
    const rows = items.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      p.stock_quantity,
      Number(p.cost_price).toFixed(2).replace(".", ","),
      Number(p.sale_price).toFixed(2).replace(".", ","),
      (Number(p.cost_price) * p.stock_quantity).toFixed(2).replace(".", ","),
    ]);
    const totalQt = items.reduce((a, p) => a + p.stock_quantity, 0);
    const totalVal = items.reduce((a, p) => a + Number(p.cost_price) * p.stock_quantity, 0);
    rows.push(["TOTAL", totalQt, "", "", totalVal.toFixed(2).replace(".", ",")]);
    const csv = "\uFEFF" + [header, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estoque-fruta2-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${items.length} itens exportados`);
  };

  const filtered = products.filter((p) => {
    const t = q.toLowerCase().trim();
    if (!t) return true;
    return [
      p.name,
      String(p.cost_price),
      String(p.sale_price),
      String(p.stock_quantity),
      String(p.low_stock_threshold),
      fmtBRL(p.cost_price),
      fmtBRL(p.sale_price),
    ].some((v) => v.toLowerCase().includes(t));
  });

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, {
    name: (p) => p.name,
    cost_price: (p) => Number(p.cost_price),
    sale_price: (p) => Number(p.sale_price),
    stock_quantity: (p) => p.stock_quantity,
    low_stock_threshold: (p) => p.low_stock_threshold,
  }, { key: "name", dir: "asc" });

  const replenish = products
    .map((p) => {
      const sold = salesByProduct[p.id] ?? 0;
      const perDay = sold / windowDays;
      const recommended = Math.ceil(perDay * coverDays);
      const suggest = Math.max(0, recommended - p.stock_quantity);
      return { p, sold, perDay, recommended, suggest };
    })
    .filter((r) => r.suggest > 0 || r.p.stock_quantity <= r.p.low_stock_threshold)
    .sort((a, b) => b.suggest - a.suggest);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Produtos</h2>
        <div className="flex gap-2">
        <Button variant="outline" onClick={() => setOpenReplenish(true)}><Sparkles className="h-4 w-4 mr-2" /> Reposição Inteligente</Button>
        <Button variant="outline" onClick={exportStock}><Download className="h-4 w-4 mr-2" /> Exportar Estoque</Button>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo Produto</Button>
          </DialogTrigger>
          <ProductDialog initial={editing} onSave={save} />
        </Dialog>
        </div>
      </div>
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar em todos os campos..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="text-left p-3"><SortHeader label="Produto" sortKey="name" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-right p-3"><SortHeader label="Valor Entrada" sortKey="cost_price" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-right p-3"><SortHeader label="Valor Saída" sortKey="sale_price" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-right p-3"><SortHeader label="Estoque" sortKey="stock_quantity" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-right p-3"><SortHeader label="Alerta <=" sortKey="low_stock_threshold" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-right p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 text-right">{fmtBRL(p.cost_price)}</td>
                <td className="p-3 text-right">{fmtBRL(p.sale_price)}</td>
                <td className={"p-3 text-right font-semibold " + (p.stock_quantity <= p.low_stock_threshold ? "text-destructive" : "")}>{p.stock_quantity}</td>
                <td className="p-3 text-right">{p.low_stock_threshold}</td>
                <td className="p-3 text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={openReplenish} onOpenChange={setOpenReplenish}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Proposta de Reposição</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Período analisado (dias)</Label>
              <Input type="number" min={1} value={windowDays} onChange={(e) => setWindowDays(Math.max(1, Number(e.target.value)))} />
            </div>
            <div>
              <Label>Cobertura desejada (dias)</Label>
              <Input type="number" min={1} value={coverDays} onChange={(e) => setCoverDays(Math.max(1, Number(e.target.value)))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Calculado a partir das vendas dos últimos {windowDays} dias. A sugestão cobre {coverDays} dias de venda média.
          </p>
          <div className="max-h-[50vh] overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground sticky top-0">
                <tr>
                  <th className="text-left p-2">Produto</th>
                  <th className="text-right p-2">Vendido ({windowDays}d)</th>
                  <th className="text-right p-2">Média/dia</th>
                  <th className="text-right p-2">Estoque atual</th>
                  <th className="text-right p-2">Sugestão de compra</th>
                </tr>
              </thead>
              <tbody>
                {replenish.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhuma reposição necessária no momento.</td></tr>
                ) : replenish.map(({ p, sold, perDay, suggest }) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2 font-medium">{p.name}</td>
                    <td className="p-2 text-right">{sold}</td>
                    <td className="p-2 text-right">{perDay.toFixed(2)}</td>
                    <td className={"p-2 text-right " + (p.stock_quantity <= p.low_stock_threshold ? "text-destructive font-semibold" : "")}>{p.stock_quantity}</td>
                    <td className="p-2 text-right font-bold text-primary">{suggest > 0 ? `+${suggest}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenReplenish(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductDialog({
  initial,
  onSave,
}: {
  initial: Product | null;
  onSave: (p: any) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [cost, setCost] = useState(initial?.cost_price ?? 0);
  const [sale, setSale] = useState(initial?.sale_price ?? 0);
  const [low, setLow] = useState(initial?.low_stock_threshold ?? 5);

  useEffect(() => {
    setName(initial?.name ?? "");
    setCost(initial?.cost_price ?? 0);
    setSale(initial?.sale_price ?? 0);
    setLow(initial?.low_stock_threshold ?? 5);
  }, [initial]);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "Editar Produto" : "Novo Produto"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Valor de Entrada</Label><Input type="number" step="0.01" value={cost} onChange={(e) => setCost(Number(e.target.value))} /></div>
          <div><Label>Valor de Saída</Label><Input type="number" step="0.01" value={sale} onChange={(e) => setSale(Number(e.target.value))} /></div>
        </div>
        <div><Label>Alerta de baixo estoque (un.)</Label><Input type="number" value={low} onChange={(e) => setLow(Number(e.target.value))} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave({ id: initial?.id, name, cost_price: cost, sale_price: sale, low_stock_threshold: low })}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}