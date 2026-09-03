import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";
import { useSort, SortHeader } from "@/hooks/use-sort";

export const Route = createFileRoute("/_app/transferencias")({
  head: () => ({
    meta: [
      { title: "Transferências de Estoque — Fruta²" },
      { name: "description", content: "Envie polpas do estoque da matriz para o freezer de cada vendedor." },
      { property: "og:title", content: "Transferências de Estoque — Fruta²" },
      { property: "og:description", content: "Baixa automática na matriz e entrada no estoque móvel do vendedor." },
    ],
  }),
  component: TransferenciasPage,
});

type Prod = { id: string; name: string; stock_quantity: number; cost_price: number };
type Rep = { user_id: string; label: string };

function TransferenciasPage() {
  const { isAdmin } = useAuth();
  const [matriz, setMatriz] = useState<Prod[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [productId, setProductId] = useState("");
  const [repId, setRepId] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data: prods } = await supabase
      .from("products")
      .select("id, name, stock_quantity, cost_price")
      .is("owner_id", null)
      .order("name");
    setMatriz((prods ?? []) as Prod[]);

    const { data: inv } = await supabase
      .from("rep_invites")
      .select("email, name, accepted_user_id")
      .not("accepted_user_id", "is", null);
    setReps(
      ((inv ?? []) as any[]).map((i) => ({
        user_id: i.accepted_user_id as string,
        label: i.name ? `${i.name} (${i.email})` : i.email,
      })),
    );

    const { data: tr } = await supabase
      .from("stock_transfers")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(tr ?? []);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const selected = matriz.find((p) => p.id === productId);

  const transfer = async () => {
    if (!selected) return toast.error("Selecione o produto da matriz");
    if (!repId) return toast.error("Selecione o vendedor");
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) return toast.error("Quantidade inválida");
    if (quantity > selected.stock_quantity)
      return toast.error(`Estoque da matriz insuficiente (${selected.stock_quantity} un.)`);

    const { error } = await supabase.from("stock_transfers").insert({
      source_product_id: selected.id,
      product_name: selected.name,
      to_user_id: repId,
      quantity,
      unit_cost: selected.cost_price,
      note: note.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Transferência registrada — estoque atualizado automaticamente.");
    setQty("");
    setNote("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Cancelar esta transferência? O estoque volta para a matriz.")) return;
    const { error } = await supabase.from("stock_transfers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Transferência cancelada");
    load();
  };

  const repLabel = (id: string) => reps.find((r) => r.user_id === id)?.label ?? "—";

  const filtered = rows.filter((r) => {
    const t = q.toLowerCase().trim();
    if (!t) return true;
    return [r.product_name, repLabel(r.to_user_id), r.note ?? "", String(r.quantity)].some((v) =>
      String(v).toLowerCase().includes(t),
    );
  });

  const sort = useSort(
    filtered,
    {
      created_at: (r) => new Date(r.created_at).getTime(),
      product_name: (r) => r.product_name,
      rep: (r) => repLabel(r.to_user_id),
      quantity: (r) => r.quantity,
      total: (r) => Number(r.unit_cost) * r.quantity,
    },
    { key: "created_at", dir: "desc" },
  );

  if (!isAdmin) {
    return <Card className="p-8 text-center text-muted-foreground">Área exclusiva da matriz.</Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Transferências de Estoque</h2>
        <p className="text-sm text-muted-foreground">
          Envie produtos da matriz para o carro/freezer do vendedor. A baixa e a entrada são automáticas.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <span className="font-semibold">Nova transferência</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label>Produto (estoque da matriz)</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {matriz.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.stock_quantity} un.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Vendedor</Label>
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {reps.map((r) => (
                  <SelectItem key={r.user_id} value={r.user_id}>{r.label}</SelectItem>
                ))}
                {reps.length === 0 && <SelectItem value="none" disabled>Nenhum vendedor ativo</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Observação</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: carga da manhã" />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={transfer}>Transferir</Button>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar em todos os campos..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {sort.sorted.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma transferência registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="text-left p-3"><SortHeader label="Data" sortKey="created_at" currentKey={sort.sortKey} dir={sort.sortDir} onToggle={sort.toggle} /></th>
                  <th className="text-left p-3"><SortHeader label="Produto" sortKey="product_name" currentKey={sort.sortKey} dir={sort.sortDir} onToggle={sort.toggle} /></th>
                  <th className="text-left p-3"><SortHeader label="Vendedor" sortKey="rep" currentKey={sort.sortKey} dir={sort.sortDir} onToggle={sort.toggle} /></th>
                  <th className="text-right p-3"><SortHeader label="Qtd" sortKey="quantity" currentKey={sort.sortKey} dir={sort.sortDir} onToggle={sort.toggle} /></th>
                  <th className="text-right p-3"><SortHeader label="Custo total" sortKey="total" currentKey={sort.sortKey} dir={sort.sortDir} onToggle={sort.toggle} /></th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {sort.sorted.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                    <td className="p-3">{r.product_name}</td>
                    <td className="p-3">{repLabel(r.to_user_id)}</td>
                    <td className="p-3 text-right">{r.quantity}</td>
                    <td className="p-3 text-right">{fmtBRL(Number(r.unit_cost) * r.quantity)}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
