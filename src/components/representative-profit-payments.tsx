import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fmtBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type BoletoSale = {
  id: string;
  owner_id: string;
  quantity: number;
  unit_sale_price: number;
  unit_cost: number;
  boleto_paid_at: string;
  created_at: string;
  products: { name: string } | null;
  customers: { name: string } | null;
};

type ProfitPayment = {
  id: string;
  sale_id: string;
  rep_user_id: string;
  profit_amount: number;
  paid_at: string;
  note: string | null;
};

export function RepresentativeProfitPayments() {
  const [sales, setSales] = useState<BoletoSale[]>([]);
  const [payments, setPayments] = useState<ProfitPayment[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [paying, setPaying] = useState<BoletoSale | null>(null);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const [{ data: saleRows, error: salesError }, { data: paymentRows }, { data: invites }] = await Promise.all([
      supabase
        .from("sales")
        .select("id, owner_id, quantity, unit_sale_price, unit_cost, boleto_paid_at, created_at, products(name), customers(name)")
        .eq("payment_method", "boleto")
        .not("boleto_paid_at", "is", null)
        .neq("status", "scheduled")
        .order("created_at", { ascending: false }),
      (supabase as any).from("representative_profit_payments").select("*").order("paid_at", { ascending: false }),
      supabase.from("rep_invites").select("accepted_user_id, name, email").not("accepted_user_id", "is", null),
    ]);
    if (salesError) return toast.error(salesError.message);
    const repLabels: Record<string, string> = {};
    for (const invite of (invites ?? []) as any[]) {
      repLabels[invite.accepted_user_id] = invite.name || invite.email;
    }
    setLabels(repLabels);
    setSales(((saleRows ?? []) as unknown as BoletoSale[]).filter((sale) => Boolean(repLabels[sale.owner_id])));
    setPayments((paymentRows ?? []) as ProfitPayment[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const paidSaleIds = useMemo(() => new Set(payments.map((payment) => payment.sale_id)), [payments]);
  const pending = sales.filter((sale) => !paidSaleIds.has(sale.id));
  const pendingTotal = pending.reduce(
    (sum, sale) => sum + (Number(sale.unit_sale_price) - Number(sale.unit_cost)) * sale.quantity,
    0,
  );
  const paidTotal = payments.reduce((sum, payment) => sum + Number(payment.profit_amount), 0);
  const filtered = pending.filter((sale) => {
    const term = query.trim().toLowerCase();
    return !term || [labels[sale.owner_id], sale.products?.name, sale.customers?.name]
      .some((value) => String(value ?? "").toLowerCase().includes(term));
  });

  const submit = async () => {
    if (!paying) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return toast.error("Sua sessão expirou. Entre novamente.");
    const grossSale = Number(paying.unit_sale_price) * paying.quantity;
    const costTotal = Number(paying.unit_cost) * paying.quantity;
    const { error } = await (supabase as any).from("representative_profit_payments").insert({
      rep_user_id: paying.owner_id,
      sale_id: paying.id,
      gross_sale: grossSale,
      cost_total: costTotal,
      profit_amount: grossSale - costTotal,
      note: note.trim() || null,
      paid_at: new Date(`${paidAt}T12:00:00`).toISOString(),
      created_by: auth.user.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Repasse de lucro registrado");
    setPaying(null);
    setNote("");
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Repasses aos Representantes</h2>
        <p className="text-sm text-muted-foreground">
          Lucro devido pela matriz somente nas vendas dos representantes pagas por boleto.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5"><p className="text-xs text-muted-foreground">Lucro pendente</p><p className="text-2xl font-bold text-destructive">{fmtBRL(pendingTotal)}</p></Card>
        <Card className="p-5"><p className="text-xs text-muted-foreground">Lucro já repassado</p><p className="text-2xl font-bold text-primary">{fmtBRL(paidTotal)}</p></Card>
        <Card className="p-5"><p className="text-xs text-muted-foreground">Boletos aguardando repasse</p><p className="text-2xl font-bold">{pending.length}</p></Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold">Vendas em boleto com lucro pendente</h3>
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar representante, cliente ou produto" />
          </div>
        </div>
        {filtered.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Nenhum lucro pendente de repasse.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-secondary text-secondary-foreground"><tr><th className="text-left p-3">Representante</th><th className="text-left p-3">Venda</th><th className="text-right p-3">Valor</th><th className="text-right p-3">Custo</th><th className="text-right p-3">Lucro</th><th className="p-3" /></tr></thead><tbody>
            {filtered.map((sale) => {
              const gross = Number(sale.unit_sale_price) * sale.quantity;
              const cost = Number(sale.unit_cost) * sale.quantity;
              return <tr key={sale.id} className="border-t"><td className="p-3 font-medium">{labels[sale.owner_id]}</td><td className="p-3">{sale.products?.name ?? "—"} · {sale.quantity} un.<p className="text-xs text-muted-foreground">{sale.customers?.name ?? "Sem cliente"}</p></td><td className="p-3 text-right">{fmtBRL(gross)}</td><td className="p-3 text-right">{fmtBRL(cost)}</td><td className="p-3 text-right font-bold text-primary">{fmtBRL(gross - cost)}</td><td className="p-3 text-right"><Button size="sm" onClick={() => setPaying(sale)}><Banknote className="h-4 w-4 mr-1" /> Repassar</Button></td></tr>;
            })}
          </tbody></table></div>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b"><h3 className="font-semibold">Histórico de repasses de lucro</h3></div>
        {payments.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Nenhum repasse registrado.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-secondary text-secondary-foreground"><tr><th className="text-left p-3">Data</th><th className="text-left p-3">Representante</th><th className="text-left p-3">Observação</th><th className="text-right p-3">Lucro repassado</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className="border-t"><td className="p-3">{new Date(payment.paid_at).toLocaleDateString("pt-BR")}</td><td className="p-3">{labels[payment.rep_user_id] ?? "Representante"}</td><td className="p-3">{payment.note ?? "—"}</td><td className="p-3 text-right font-bold text-primary">{fmtBRL(payment.profit_amount)}</td></tr>)}</tbody></table></div>}
      </Card>

      {paying && <Card className="p-5 space-y-4 border-primary">
        <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /><h3 className="font-semibold">Confirmar repasse para {labels[paying.owner_id]}</h3></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><Label>Data do pagamento</Label><Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></div><div><Label>Observação</Label><Textarea rows={1} value={note} onChange={(event) => setNote(event.target.value)} /></div></div>
        <div className="flex gap-2"><Button onClick={submit}>Confirmar {fmtBRL((Number(paying.unit_sale_price) - Number(paying.unit_cost)) * paying.quantity)}</Button><Button variant="outline" onClick={() => setPaying(null)}>Cancelar</Button></div>
      </Card>}
    </div>
  );
}