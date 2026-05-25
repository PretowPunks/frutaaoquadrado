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
import { Search, Trash2 } from "lucide-react";
import { useSort, SortHeader } from "@/hooks/use-sort";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/entradas")({ component: EntradasPage });

function EntradasPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data: p } = await supabase.from("products").select("*").order("name");
    setProducts(p ?? []);
    const { data: e } = await supabase
      .from("stock_entries").select("*, products(name)").order("created_at", { ascending: false }).limit(50);
    setEntries(e ?? []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const p = products.find((x) => x.id === productId);
    if (p) setUnitCost(Number(p.cost_price));
  }, [productId, products]);

  const submit = async () => {
    if (!productId || qty < 1) return toast.error("Selecione produto e quantidade");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("stock_entries").insert({
      product_id: productId, quantity: qty, unit_cost: unitCost, created_by: u.user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Entrada registrada");
    setQty(1); load();
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Quantidade</Label><Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
          <div><Label>Valor de Entrada (un.)</Label><Input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} /></div>
        </div>
        <Button onClick={submit}>Registrar Entrada</Button>
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