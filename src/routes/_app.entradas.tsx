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
import { Search, Trash2, Plus, X } from "lucide-react";
import { useSort, SortHeader } from "@/hooks/use-sort";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/entradas")({ component: EntradasGate });

type CartItem = { product_id: string; quantity: number; unit_cost: number };

function EntradasGate() {
  const { isAdmin } = useAuth();
  const { isViewingRep } = useScope();
  if (!isAdmin) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        As entradas de mercadoria são registradas pela matriz. Seu estoque é abastecido pelas transferências recebidas.
      </Card>
    );
  }
  if (isViewingRep) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        O estoque do representante é abastecido apenas por transferências da matriz — ele não registra entradas.
      </Card>
    );
  }
  return <EntradasPage />;
}

function EntradasPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([{ product_id: "", quantity: 1, unit_cost: 0 }]);
  const [q, setQ] = useState("");

  const load = async () => {
    // Entradas sempre integram o estoque da matriz (owner_id nulo)
    const { data: p } = await supabase.from("products").select("*").is("owner_id", null).order("name");
    setProducts(p ?? []);
    const { data: u } = await supabase.auth.getUser();
    const { data: e } = await supabase
      .from("stock_entries").select("*, products(name)")
      .eq("owner_id", u.user?.id ?? "")
      .order("created_at", { ascending: false }).limit(50);
    setEntries(e ?? []);
  };
  useEffect(() => { load(); }, []);

  const updateItem = (idx: number, patch: Partial<CartItem>) => {
    setCart((c) => c.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      if (patch.product_id) {
        const p = products.find((x) => x.id === patch.product_id);
        if (p) next.unit_cost = Number(p.cost_price);
      }
      return next;
    }));
  };
  const addRow = () => setCart((c) => [...c, { product_id: "", quantity: 1, unit_cost: 0 }]);
  const removeRow = (idx: number) => setCart((c) => c.length === 1 ? c : c.filter((_, i) => i !== idx));
  const cartTotal = cart.reduce((a, it) => a + Number(it.unit_cost) * Number(it.quantity), 0);

  const submit = async () => {
    if (cart.length === 0) return toast.error("Adicione ao menos um produto");
    const rows: any[] = [];
    for (const [i, it] of cart.entries()) {
      const p = products.find((x) => x.id === it.product_id);
      if (!p) return toast.error(`Linha ${i + 1}: selecione um produto`);
      if (it.quantity < 1) return toast.error(`Linha ${i + 1}: quantidade inválida`);
      rows.push({
        product_id: p.id,
        quantity: it.quantity,
        unit_cost: it.unit_cost || Number(p.cost_price),
      });
    }
    const { data: u } = await supabase.auth.getUser();
    const payload = rows.map((r) => ({ ...r, created_by: u.user?.id }));
    const { error } = await supabase.from("stock_entries").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} item(ns) registrado(s)`);
    setCart([{ product_id: "", quantity: 1, unit_cost: 0 }]);
    load();
  };

  const filtered = entries.filter((e) => {
    const t = q.toLowerCase().trim();
    if (!t) return true;
    return [
      e.products?.name ?? "",
      String(e.quantity),
      String(e.unit_cost),
      fmtBRL(e.unit_cost),
      fmtBRL(Number(e.unit_cost) * e.quantity),
      new Date(e.created_at).toLocaleString("pt-BR"),
    ].some((v) => String(v).toLowerCase().includes(t));
  });

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, {
    created_at: (e) => new Date(e.created_at).getTime(),
    product: (e) => e.products?.name ?? "",
    quantity: (e) => e.quantity,
    unit_cost: (e) => Number(e.unit_cost),
    total: (e) => Number(e.unit_cost) * e.quantity,
  }, { key: "created_at", dir: "desc" });

  const remove = async (id: string) => {
    const { error } = await supabase.from("stock_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Entrada excluída, estoque ajustado");
    load();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Entradas de Estoque</h2>
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Label>Produtos da entrada</Label>
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
                  <Label className="text-xs">Valor Entrada (un.)</Label>
                  <Input type="number" step="0.01" value={it.unit_cost} onChange={(e) => updateItem(idx, { unit_cost: Number(e.target.value) })} />
                </div>
                <div className="col-span-2 md:col-span-1 flex justify-end">
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeRow(idx)} disabled={cart.length === 1}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {p && (
                  <div className="col-span-12 text-xs text-muted-foreground">
                    Subtotal: <span className="font-semibold text-foreground">{fmtBRL(Number(it.unit_cost) * Number(it.quantity))}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">Total da entrada</span>
          <span className="text-lg font-bold">{fmtBRL(cartTotal)}</span>
        </div>
        <Button onClick={submit} className="w-full">Registrar Entrada</Button>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold">Últimas entradas</h3>
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
              <th className="text-right p-3"><SortHeader label="Qtd" sortKey="quantity" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-right p-3"><SortHeader label="Valor Un." sortKey="unit_cost" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="text-right p-3"><SortHeader label="Total" sortKey="total" currentKey={sortKey} dir={sortDir} onToggle={toggle} /></th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-3">{new Date(e.created_at).toLocaleString("pt-BR")}</td>
                <td className="p-3">{e.products?.name}</td>
                <td className="p-3 text-right">{e.quantity}</td>
                <td className="p-3 text-right">{fmtBRL(e.unit_cost)}</td>
                <td className="p-3 text-right font-semibold">{fmtBRL(Number(e.unit_cost) * e.quantity)}</td>
                <td className="p-3 text-center">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir entrada?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A quantidade desta entrada será descontada do estoque do produto. Use esta opção apenas para corrigir um registro incorreto.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(e.id)}>Excluir</AlertDialogAction>
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
