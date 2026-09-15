import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, FileDown, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fmtBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrintPortal } from "@/components/print-portal";
import { RepresentativeTransferReceiptDoc, type RepresentativeTransferReceipt } from "@/components/print-docs";

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

type TransferMethod = "Abatimento" | "PIX" | "Dinheiro";
type TransferRecord = RepresentativeTransferReceipt & {
  repUserId: string;
  saleId: string;
  note: string;
};

type PendingTransfer = {
  sale: BoletoSale;
  method: TransferMethod;
  amount: number;
  debtBefore: number;
};

const LOCAL_TRANSFERS_KEY = "fruta2:representative-financial-transfers";

function readLocalTransfers(): TransferRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(LOCAL_TRANSFERS_KEY);
    return stored ? (JSON.parse(stored) as TransferRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalTransfers(records: TransferRecord[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(LOCAL_TRANSFERS_KEY, JSON.stringify(records));
}

export function RepresentativeProfitPayments() {
  const [sales, setSales] = useState<BoletoSale[]>([]);
  const [payments, setPayments] = useState<ProfitPayment[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [paying, setPaying] = useState<BoletoSale | null>(null);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [localTransfers, setLocalTransfers] = useState<TransferRecord[]>([]);
  const [debts, setDebts] = useState<Record<string, number>>({});
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null);
  const [manualRepId, setManualRepId] = useState("");
  const [manualMethod, setManualMethod] = useState<"PIX" | "Dinheiro">("PIX");
  const [manualAmount, setManualAmount] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [receipt, setReceipt] = useState<TransferRecord | null>(null);

  const load = useCallback(async () => {
    const [{ data: saleRows, error: salesError }, { data: paymentRows }, { data: invites }, { data: transfers }] = await Promise.all([
      supabase
        .from("sales")
        .select("id, owner_id, quantity, unit_sale_price, unit_cost, boleto_paid_at, created_at, products(name), customers(name)")
        .eq("payment_method", "boleto")
        .not("boleto_paid_at", "is", null)
        .neq("status", "scheduled")
        .order("created_at", { ascending: false }),
      (supabase as any).from("representative_profit_payments").select("*").order("paid_at", { ascending: false }),
      supabase.from("rep_invites").select("accepted_user_id, name, email").not("accepted_user_id", "is", null),
      supabase.from("stock_transfers").select("to_user_id, quantity, unit_cost"),
    ]);
    if (salesError) return toast.error(salesError.message);
    const repLabels: Record<string, string> = {};
    for (const invite of (invites ?? []) as any[]) {
      repLabels[invite.accepted_user_id] = invite.name || invite.email;
    }
    setLabels(repLabels);
    setSales(((saleRows ?? []) as unknown as BoletoSale[]).filter((sale) => Boolean(repLabels[sale.owner_id])));
    setPayments((paymentRows ?? []) as ProfitPayment[]);
    const initialDebts: Record<string, number> = {};
    for (const transfer of (transfers ?? []) as any[]) {
      initialDebts[transfer.to_user_id] = (initialDebts[transfer.to_user_id] ?? 0) + Number(transfer.quantity) * Number(transfer.unit_cost);
    }
    const saved = readLocalTransfers();
    for (const transfer of saved) {
      if (transfer.method === "Abatimento") {
        initialDebts[transfer.repUserId] = Math.max(0, (initialDebts[transfer.repUserId] ?? 0) - transfer.profitAmount);
      }
    }
    setDebts(initialDebts);
    setLocalTransfers(saved);
  }, []);

  useEffect(() => { load(); }, [load]);

  const paidSaleIds = useMemo(() => new Set([...payments.map((payment) => payment.sale_id), ...localTransfers.map((payment) => payment.saleId)]), [payments, localTransfers]);
  const pending = sales.filter((sale) => !paidSaleIds.has(sale.id));
  const pendingTotal = pending.reduce(
    (sum, sale) => sum + (Number(sale.unit_sale_price) - Number(sale.unit_cost)) * sale.quantity,
    0,
  );
  const paidTotal = localTransfers.reduce((sum, payment) => sum + Number(payment.profitAmount), 0);
  const filtered = pending.filter((sale) => {
    const term = query.trim().toLowerCase();
    return !term || [labels[sale.owner_id], sale.products?.name, sale.customers?.name]
      .some((value) => String(value ?? "").toLowerCase().includes(term));
  });

  const prepareSaleTransfer = () => {
    if (!paying) return;
    const profit = (Number(paying.unit_sale_price) - Number(paying.unit_cost)) * paying.quantity;
    const debt = debts[paying.owner_id] ?? 0;
    const discount = Math.min(profit, debt);
    const remainder = Math.max(profit - discount, 0);
    setPendingTransfer({ sale: paying, method: discount > 0 ? "Abatimento" : "PIX", amount: discount || remainder, debtBefore: debt });
  };

  const confirmTransfer = () => {
    if (!pendingTransfer) return;
    const { sale, method, amount, debtBefore } = pendingTransfer;
    const updatedDebt = method === "Abatimento" ? Math.max(0, debtBefore - amount) : debtBefore;
    const record: TransferRecord = {
      id: crypto.randomUUID(), date: paidAt, representativeName: labels[sale.owner_id] ?? "Representante",
      repUserId: sale.owner_id, saleId: sale.id, profitAmount: amount, method, updatedDebt, note: note.trim(),
    };
    const next = [record, ...localTransfers];
    setLocalTransfers(next);
    writeLocalTransfers(next);
    setDebts((current) => ({ ...current, [sale.owner_id]: updatedDebt }));
    setReceipt(record);
    setPendingTransfer(null);
    setPaying(null);
    setNote("");
    toast.success(method === "Abatimento" ? "Abatimento confirmado" : "Repasse manual confirmado");
  };

  const prepareManualTransfer = () => {
    const amount = Number(manualAmount.replace(",", "."));
    const representativeName = labels[manualRepId];
    if (!representativeName || amount <= 0) return toast.error("Informe o representante e um valor válido.");
    const virtualSale: BoletoSale = { id: `manual-${Date.now()}`, owner_id: manualRepId, quantity: 1, unit_sale_price: amount, unit_cost: 0, boleto_paid_at: new Date().toISOString(), created_at: new Date().toISOString(), products: null, customers: null };
    setPendingTransfer({ sale: virtualSale, method: manualMethod, amount, debtBefore: debts[manualRepId] ?? 0 });
    setManualOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-2xl font-bold">Repasses aos Representantes</h2>
        <p className="text-sm text-muted-foreground">
          Boletos recebidos pela Matriz geram abatimento da dívida e, quando necessário, pagamento manual.
        </p>
        </div>
        <Button onClick={() => setManualOpen(true)}><Banknote className="h-4 w-4 mr-2" /> Registrar Repasse Manual</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5"><p className="text-xs text-muted-foreground">Lucro pendente</p><p className="text-2xl font-bold text-destructive">{fmtBRL(pendingTotal)}</p></Card>
        <Card className="p-5"><p className="text-xs text-muted-foreground">Lucro processado</p><p className="text-2xl font-bold text-primary">{fmtBRL(paidTotal)}</p></Card>
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
               return <tr key={sale.id} className="border-t"><td className="p-3 font-medium">{labels[sale.owner_id]}</td><td className="p-3">{sale.products?.name ?? "—"} · {sale.quantity} un.<p className="text-xs text-muted-foreground">{sale.customers?.name ?? "Sem cliente"}</p></td><td className="p-3 text-right">{fmtBRL(gross)}</td><td className="p-3 text-right">{fmtBRL(cost)}</td><td className="p-3 text-right font-bold text-primary">{fmtBRL(gross - cost)}</td><td className="p-3 text-right"><Button size="sm" onClick={() => setPaying(sale)}><Banknote className="h-4 w-4 mr-1" /> Processar lucro</Button></td></tr>;
            })}
          </tbody></table></div>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b"><h3 className="font-semibold">Histórico de repasses de lucro</h3></div>
        {localTransfers.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Nenhum repasse registrado.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-secondary text-secondary-foreground"><tr><th className="text-left p-3">Data</th><th className="text-left p-3">Representante</th><th className="text-left p-3">Forma</th><th className="text-right p-3">Lucro</th><th className="text-right p-3">Saldo atualizado</th><th className="p-3" /></tr></thead><tbody>{localTransfers.map((record) => <tr key={record.id} className="border-t"><td className="p-3">{new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR")}</td><td className="p-3">{record.representativeName}</td><td className="p-3">{record.method}</td><td className="p-3 text-right font-bold text-primary">{fmtBRL(record.profitAmount)}</td><td className="p-3 text-right">{fmtBRL(record.updatedDebt)}</td><td className="p-3 text-right"><Button size="icon" variant="ghost" title="Ver comprovante" onClick={() => setReceipt(record)}><FileDown className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div>}
      </Card>

      {paying && <Card className="p-5 space-y-4 border-primary">
        <h3 className="font-semibold">Processar lucro de {labels[paying.owner_id]}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm"><div><p className="text-muted-foreground">Lucro</p><p className="font-bold">{fmtBRL((Number(paying.unit_sale_price) - Number(paying.unit_cost)) * paying.quantity)}</p></div><div><p className="text-muted-foreground">Saldo devedor</p><p className="font-bold">{fmtBRL(debts[paying.owner_id] ?? 0)}</p></div><div><p className="text-muted-foreground">Excedente manual</p><p className="font-bold">{fmtBRL(Math.max((Number(paying.unit_sale_price) - Number(paying.unit_cost)) * paying.quantity - (debts[paying.owner_id] ?? 0), 0))}</p></div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><Label>Data do pagamento</Label><Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></div><div><Label>Observação</Label><Textarea rows={1} value={note} onChange={(event) => setNote(event.target.value)} /></div></div>
        <div className="flex gap-2"><Button onClick={prepareSaleTransfer}>Continuar para confirmação</Button><Button variant="outline" onClick={() => setPaying(null)}>Cancelar</Button></div>
      </Card>}

      <Dialog open={manualOpen} onOpenChange={setManualOpen}><DialogContent><DialogHeader><DialogTitle>Registrar Repasse Manual</DialogTitle><DialogDescription>Use PIX ou Dinheiro somente para o valor que não pôde ser abatido do saldo devedor.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Representante</Label><Select value={manualRepId} onValueChange={setManualRepId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{Object.entries(labels).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div><Label>Forma</Label><Select value={manualMethod} onValueChange={(value: "PIX" | "Dinheiro") => setManualMethod(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PIX">PIX</SelectItem><SelectItem value="Dinheiro">Dinheiro</SelectItem></SelectContent></Select></div><div><Label>Valor</Label><Input inputMode="decimal" value={manualAmount} onChange={(event) => setManualAmount(event.target.value)} placeholder="0,00" /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button><Button onClick={prepareManualTransfer}>Continuar</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(pendingTransfer)} onOpenChange={(open) => !open && setPendingTransfer(null)}><DialogContent><DialogHeader><DialogTitle>Confirmar repasse</DialogTitle><DialogDescription>Revise os valores. A operação só será concluída após esta confirmação da Matriz.</DialogDescription></DialogHeader>{pendingTransfer && <div className="space-y-2 rounded-md border p-4 text-sm"><div className="flex justify-between"><span>Representante</span><strong>{labels[pendingTransfer.sale.owner_id]}</strong></div><div className="flex justify-between"><span>Forma</span><strong>{pendingTransfer.method}</strong></div><div className="flex justify-between"><span>Valor</span><strong>{fmtBRL(pendingTransfer.amount)}</strong></div><div className="flex justify-between border-t pt-2"><span>Saldo após confirmação</span><strong>{fmtBRL(pendingTransfer.method === "Abatimento" ? Math.max(0, pendingTransfer.debtBefore - pendingTransfer.amount) : pendingTransfer.debtBefore)}</strong></div></div>}<DialogFooter><Button variant="outline" onClick={() => setPendingTransfer(null)}>Voltar</Button><Button onClick={confirmTransfer}>Confirmar repasse</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(receipt)} onOpenChange={(open) => !open && setReceipt(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Relatório de Conferência</DialogTitle><DialogDescription>Comprovante do repasse confirmado pela Matriz.</DialogDescription></DialogHeader>{receipt && <RepresentativeTransferReceiptDoc receipt={receipt} />}<DialogFooter><Button variant="outline" onClick={() => setReceipt(null)}>Fechar</Button><Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Baixar comprovante</Button></DialogFooter></DialogContent></Dialog>
      {receipt && <PrintPortal><RepresentativeTransferReceiptDoc receipt={receipt} /></PrintPortal>}
    </div>
  );
}