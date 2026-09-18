import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/mock-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Download, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";
import { useSort, SortHeader } from "@/hooks/use-sort";
import { useScope, scopeProducts } from "@/hooks/use-scope";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/produtos")({
  head: () => ({
    meta: [
      { title: "Estoque | Fruta²" },
      { name: "description", content: "Catálogo, saldos e entradas de estoque da Fruta²." },
      { property: "og:title", content: "Estoque | Fruta²" },
      {
        property: "og:description",
        content: "Catálogo, saldos e entradas de estoque da Fruta².",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProdutosPage,
});

type Product = {
  id: string;
  name: string;
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
};

type LotItem = { product_id: string; quantity: number; unit_cost: number };

const emptyLotItem = (): LotItem => ({ product_id: "", quantity: 1, unit_cost: 0 });

function ProdutosPage() {
  const { ownerId } = useScope();
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [salesByProduct, setSalesByProduct] = useState<Record<string, number>>({});
  const [windowDays, setWindowDays] = useState(30);
  const [coverDays, setCoverDays] = useState(7);
  const [openReplenish, setOpenReplenish] = useState(false);
  const [openLot, setOpenLot] = useState(false);
  const [lotItems, setLotItems] = useState<LotItem[]>([emptyLotItem()]);

  const load = async () => {
    // Representantes consultam o catálogo central; somente a matriz o administra.
    const { data } = await scopeProducts(
      supabase.from("products").select("*").order("name") as any,
      null,
    );
    setProducts((data ?? []) as Product[]);
    const since = new Date(Date.now() - windowDays * 86400000).toISOString();
    const { data: s } = await supabase
      .from("sales")
      .select("product_id, quantity, created_at")
      .eq("owner_id", ownerId)
      .gte("created_at", since);
    const map: Record<string, number> = {};
    for (const r of (s ?? []) as any[]) {
      map[r.product_id] = (map[r.product_id] ?? 0) + Number(r.quantity);
    }
    setSalesByProduct(map);
  };
  useEffect(() => {
    if (ownerId) load();
  }, [windowDays, ownerId]);

  const save = async (form: Omit<Product, "id" | "stock_quantity"> & { id?: string }) => {
    if (!isAdmin) return toast.error("O catálogo é administrado pela matriz.");
    if (form.id) {
      const { error } = await supabase
        .from("products")
        .update({
          name: form.name,
          cost_price: form.cost_price,
          sale_price: form.sale_price,
          low_stock_threshold: form.low_stock_threshold,
        })
        .eq("id", form.id);
      if (error) return toast.error(error.message);
      toast.success("Produto atualizado");
    } else {
      const { error } = await supabase.from("products").insert({
        name: form.name,
        cost_price: form.cost_price,
        sale_price: form.sale_price,
        low_stock_threshold: form.low_stock_threshold,
        owner_id: null,
      });
      if (error) return toast.error(error.message);
      toast.success("Produto cadastrado");
    }
    setOpen(false);
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    load();
  };

  const updateLotItem = (index: number, patch: Partial<LotItem>) => {
    setLotItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        if (patch.product_id) {
          const product = products.find((candidate) => candidate.id === patch.product_id);
          if (product) next.unit_cost = Number(product.cost_price);
        }
        return next;
      }),
    );
  };

  const closeLotDialog = () => {
    setOpenLot(false);
    setLotItems([emptyLotItem()]);
  };

  const registerLot = async () => {
    if (!isAdmin) return toast.error("Apenas a matriz pode registrar entradas.");
    try {
      const rows = lotItems.map((item, index) => {
        const product = products.find((candidate) => candidate.id === item.product_id);
        if (!product) throw new Error(`Linha ${index + 1}: selecione um produto.`);
        if (!Number.isFinite(item.quantity) || item.quantity < 1)
          throw new Error(`Linha ${index + 1}: informe uma quantidade válida.`);
        if (!Number.isFinite(item.unit_cost) || item.unit_cost < 0)
          throw new Error(`Linha ${index + 1}: informe um valor de entrada válido.`);
        return {
          product_id: product.id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
        };
      });
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("stock_entries").insert(
        rows.map((row) => ({
          ...row,
          created_by: auth.user?.id,
          owner_id: auth.user?.id,
        })),
      );
      if (error) return toast.error(error.message);
      toast.success(`Lote registrado com ${rows.length} produto(s).`);
      closeLotDialog();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o lote.");
    }
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

  const { sorted, sortKey, sortDir, toggle } = useSort(
    filtered,
    {
      name: (p) => p.name,
      cost_price: (p) => Number(p.cost_price),
      sale_price: (p) => Number(p.sale_price),
      stock_quantity: (p) => p.stock_quantity,
      low_stock_threshold: (p) => p.low_stock_threshold,
    },
    { key: "name", dir: "asc" },
  );

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
  const lotTotal = lotItems.reduce(
    (total, item) => total + Number(item.quantity) * Number(item.unit_cost),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h2 className="text-2xl font-bold">{isAdmin ? "Estoque" : "Produtos"}</h2>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Estoque e catálogo da matriz" : "Catálogo e disponibilidade da matriz"}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          {isAdmin && (
            <Dialog
              open={openLot}
              onOpenChange={(nextOpen) => {
                setOpenLot(nextOpen);
                if (!nextOpen) setLotItems([emptyLotItem()]);
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> + Registrar Entrada de Lote
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Registrar Entrada de Lote</DialogTitle>
                </DialogHeader>
                <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                  {lotItems.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 items-end gap-2 rounded border p-3"
                    >
                      <div className="col-span-12 sm:col-span-6">
                        <Label>Produto</Label>
                        <Select
                          value={item.product_id}
                          onValueChange={(value) => updateLotItem(index, { product_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} · saldo {product.stock_quantity}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-5 sm:col-span-2">
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) =>
                            updateLotItem(index, { quantity: Number(event.target.value) })
                          }
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-3">
                        <Label>Valor unitário</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(event) =>
                            updateLotItem(index, { unit_cost: Number(event.target.value) })
                          }
                        />
                      </div>
                      <div className="col-span-2 flex justify-end sm:col-span-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={lotItems.length === 1}
                          aria-label={`Remover linha ${index + 1}`}
                          onClick={() =>
                            setLotItems((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="col-span-12 text-right text-xs text-muted-foreground">
                        Subtotal: {fmtBRL(Number(item.quantity) * Number(item.unit_cost))}
                      </p>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLotItems((current) => [...current, emptyLotItem()])}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Adicionar produto
                  </Button>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm text-muted-foreground">Total do lote</span>
                  <strong className="text-lg">{fmtBRL(lotTotal)}</strong>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeLotDialog}>
                    Cancelar
                  </Button>
                  <Button onClick={registerLot}>Registrar entrada</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={() => setOpenReplenish(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Reposição Inteligente
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={exportStock}>
              <Download className="h-4 w-4 mr-2" /> Exportar Estoque
            </Button>
          )}
          {isAdmin && (
            <Dialog
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (!o) setEditing(null);
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Novo Produto
                </Button>
              </DialogTrigger>
              <ProductDialog initial={editing} onSave={save} isMatriz />
            </Dialog>
          )}
        </div>
      </div>
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar em todos os campos..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="text-left p-3">
                <SortHeader
                  label="Produto"
                  sortKey="name"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                />
              </th>
              {isAdmin && (
                <th className="text-right p-3">
                  <SortHeader
                    label="Valor Entrada"
                    sortKey="cost_price"
                    currentKey={sortKey}
                    dir={sortDir}
                    onToggle={toggle}
                  />
                </th>
              )}
              <th className="text-right p-3">
                <SortHeader
                  label="Valor Saída"
                  sortKey="sale_price"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                />
              </th>
              <th className="text-right p-3">
                <SortHeader
                  label="Estoque"
                  sortKey="stock_quantity"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                />
              </th>
              {isAdmin && (
                <th className="text-right p-3">
                  <SortHeader
                    label="Alerta <="
                    sortKey="low_stock_threshold"
                    currentKey={sortKey}
                    dir={sortDir}
                    onToggle={toggle}
                  />
                </th>
              )}
              {isAdmin && <th className="text-right p-3">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-medium">{p.name}</td>
                {isAdmin && <td className="p-3 text-right">{fmtBRL(p.cost_price)}</td>}
                <td className="p-3 text-right">{fmtBRL(p.sale_price)}</td>
                <td
                  className={
                    "p-3 text-right font-semibold " +
                    (p.stock_quantity <= p.low_stock_threshold ? "text-destructive" : "")
                  }
                >
                  {p.stock_quantity}
                </td>
                {isAdmin && <td className="p-3 text-right">{p.low_stock_threshold}</td>}
                {isAdmin && (
                  <td className="p-3 text-right space-x-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                      aria-label={`Editar ${p.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(p.id)}
                      aria-label={`Remover ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={openReplenish} onOpenChange={setOpenReplenish}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> Proposta de Reposição
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Período analisado (dias)</Label>
              <Input
                type="number"
                min={1}
                value={windowDays}
                onChange={(e) => setWindowDays(Math.max(1, Number(e.target.value)))}
              />
            </div>
            <div>
              <Label>Cobertura desejada (dias)</Label>
              <Input
                type="number"
                min={1}
                value={coverDays}
                onChange={(e) => setCoverDays(Math.max(1, Number(e.target.value)))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Calculado a partir das vendas dos últimos {windowDays} dias. A sugestão cobre{" "}
            {coverDays} dias de venda média.
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
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      Nenhuma reposição necessária no momento.
                    </td>
                  </tr>
                ) : (
                  replenish.map(({ p, sold, perDay, suggest }) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2 font-medium">{p.name}</td>
                      <td className="p-2 text-right">{sold}</td>
                      <td className="p-2 text-right">{perDay.toFixed(2)}</td>
                      <td
                        className={
                          "p-2 text-right " +
                          (p.stock_quantity <= p.low_stock_threshold
                            ? "text-destructive font-semibold"
                            : "")
                        }
                      >
                        {p.stock_quantity}
                      </td>
                      <td className="p-2 text-right font-bold text-primary">
                        {suggest > 0 ? `+${suggest}` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenReplenish(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductDialog({
  initial,
  onSave,
  isMatriz,
}: {
  initial: Product | null;
  onSave: (p: any) => void;
  isMatriz: boolean;
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
        <DialogTitle>
          {isMatriz ? (initial ? "Editar Produto" : "Novo Produto") : "Editar preço de saída"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isMatriz} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Valor de Entrada (Matriz)</Label>
            <Input
              type="number"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              disabled={!isMatriz}
            />
          </div>
          <div>
            <Label>Valor de Saída</Label>
            <Input
              type="number"
              step="0.01"
              value={sale}
              onChange={(e) => setSale(Number(e.target.value))}
            />
          </div>
        </div>
        {isMatriz && (
          <div>
            <Label>Alerta de baixo estoque (un.)</Label>
            <Input type="number" value={low} onChange={(e) => setLow(Number(e.target.value))} />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          onClick={() =>
            onSave({
              id: initial?.id,
              name,
              cost_price: cost,
              sale_price: sale,
              low_stock_threshold: low,
            })
          }
        >
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
