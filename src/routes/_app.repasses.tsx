import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/mock-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";
import { Trash2, FileText, Printer, Search } from "lucide-react";
import { useSort, SortHeader } from "@/hooks/use-sort";
import { PrintPortal } from "@/components/print-portal";
import { ReceiptDoc, BoletoReportDoc } from "@/components/print-docs";
import { Badge } from "@/components/ui/badge";
import { useScope } from "@/hooks/use-scope";
import { RepresentativeProfitPayments } from "@/components/representative-profit-payments";

export const Route = createFileRoute("/_app/repasses")({ component: RepassesPage });

type PendingItem = { product_id: string; product_name: string; quantity: number; unit_cost: number; total_cost: number };
type SaleRemain = { id: string; remaining: number };

function RepassesPage() {
  const { ownerId, isMatriz, isViewingRep } = useScope();
  if (isMatriz) return <RepresentativeProfitPayments />;
  return <SupplierRepasses ownerId={ownerId} readOnly={isViewingRep} />;
}

function SupplierRepasses({ ownerId, readOnly }: { ownerId: string; readOnly: boolean }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [supplierTotal, setSupplierTotal] = useState(0);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [salesByProduct, setSalesByProduct] = useState<Record<string, SaleRemain[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [openReceipt, setOpenReceipt] = useState<null | { payment: any; items: any[] }>(null);
  const [qPend, setQPend] = useState("");
  const [qHist, setQHist] = useState("");
  const [periodMonth, setPeriodMonth] = useState<string>("");
  const [boletos, setBoletos] = useState<any[]>([]);
  const [openBoletoReport, setOpenBoletoReport] = useState(false);

  const load = async () => {
    const [paysRes, salesRes] = await Promise.all([
      (supabase as any).from("supplier_payments").select("*").eq("owner_id", ownerId).order("paid_at", { ascending: false }),
      supabase.from("sales").select("id, product_id, quantity, repassed_quantity, unit_cost, supplier_payment_id, status, payment_method, boleto_due_date, boleto_paid_at, products(name), customers(name)").eq("owner_id", ownerId),
    ]);
    setPayments(paysRes.data ?? []);
    const sales = (salesRes.data ?? []) as any[];
    setSupplierTotal(sales.reduce((a, s) => a + Number(s.unit_cost) * s.quantity, 0));

    // Boletos: pagos direto na conta do fornecedor
    setBoletos(
      sales
        .filter((s: any) => s.payment_method === "boleto")
        .map((s: any) => ({
          id: s.id,
          product_name: s.products?.name ?? "—",
          customer_name: s.customers?.name ?? null,
          quantity: s.quantity,
          unit_cost: Number(s.unit_cost),
          total: Number(s.unit_cost) * s.quantity,
          due_date: s.boleto_due_date,
          paid_at: s.boleto_paid_at,
        }))
        .sort((a, b) => String(a.due_date ?? "").localeCompare(String(b.due_date ?? ""))),
    );

    // Agrupa vendas pendentes (sem repasse) por produto — boletos ficam de fora
    const pend = sales.filter(
      (s: any) =>
        s.status !== "scheduled" &&
        s.payment_method !== "boleto" &&
        s.quantity - (s.repassed_quantity ?? 0) > 0,
    );
    const grouped = new Map<string, PendingItem>();
    const idsMap: Record<string, SaleRemain[]> = {};
    for (const s of pend) {
      const key = s.product_id;
      const name = s.products?.name ?? "—";
      const remaining = s.quantity - (s.repassed_quantity ?? 0);
      const cur = grouped.get(key) ?? { product_id: key, product_name: name, quantity: 0, unit_cost: Number(s.unit_cost), total_cost: 0 };
      cur.quantity += remaining;
      cur.total_cost += Number(s.unit_cost) * remaining;
      grouped.set(key, cur);
      (idsMap[key] ||= []).push({ id: s.id, remaining });
    }
    const list = Array.from(grouped.values()).sort((a, b) => a.product_name.localeCompare(b.product_name));
    setPending(list);
    setSalesByProduct(idsMap);
    setSelected(new Set(list.map((p) => p.product_id))); // por padrão tudo selecionado
    setQtyByProduct(Object.fromEntries(list.map((p) => [p.product_id, p.quantity])));
  };
  useEffect(() => { load(); }, [ownerId]);

  const qtyOf = (p: PendingItem) => Math.min(Math.max(qtyByProduct[p.product_id] ?? p.quantity, 0), p.quantity);
  const selectedItems = pending
    .filter((p) => selected.has(p.product_id) && qtyOf(p) > 0)
    .map((p) => ({ ...p, quantity: qtyOf(p), total_cost: qtyOf(p) * Number(p.unit_cost) }));
  const selectedTotal = selectedItems.reduce((a, p) => a + p.total_cost, 0);
  const allSelected = pending.length > 0 && selected.size === pending.length;
  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pending.map((p) => p.product_id)));

  const submit = async () => {
    if (readOnly) return toast.error("Você está apenas consultando os dados do representante.");
    if (selectedItems.length === 0) return toast.error("Selecione ao menos um produto para repassar");
    const { data: u } = await supabase.auth.getUser();

    // 1. cria o repasse
    const { data: pay, error: e1 } = await (supabase as any).from("supplier_payments").insert({
      amount: selectedTotal,
      note: note || null,
      paid_at: new Date(paidAt).toISOString(),
      created_by: u.user?.id,
      owner_id: ownerId,
    }).select().single();
    if (e1 || !pay) return toast.error(e1?.message ?? "Erro ao criar repasse");

    // 2. snapshot de itens
    const items = selectedItems.map((p) => ({
      payment_id: pay.id,
      product_id: p.product_id,
      product_name: p.product_name,
      quantity: p.quantity,
      unit_cost: p.unit_cost,
      total_cost: p.total_cost,
    }));
    const { error: e2 } = await (supabase as any).from("supplier_payment_items").insert(items);
    if (e2) return toast.error(e2.message);

    // 3. aloca as quantidades repassadas nas vendas (permite repasse parcial)
    for (const p of selectedItems) {
      let left = p.quantity;
      for (const s of salesByProduct[p.product_id] ?? []) {
        if (left <= 0) break;
        const take = Math.min(left, s.remaining);
        const full = take === s.remaining;
        const { data: row } = await (supabase as any).from("sales").select("repassed_quantity").eq("id", s.id).single();
        const { error: e3 } = await (supabase as any)
          .from("sales")
          .update({
            repassed_quantity: Number(row?.repassed_quantity ?? 0) + take,
            ...(full ? { supplier_payment_id: pay.id } : {}),
          })
          .eq("id", s.id);
        if (e3) return toast.error(e3.message);
        left -= take;
      }
    }

    toast.success("Repasse registrado");
    setNote("");
    await load();
    // abre comprovante automaticamente
    openReceiptFor(pay.id);
  };

  const openReceiptFor = async (paymentId: string) => {
    const [{ data: pay }, { data: items }] = await Promise.all([
      (supabase as any).from("supplier_payments").select("*").eq("id", paymentId).single(),
      (supabase as any).from("supplier_payment_items").select("*").eq("payment_id", paymentId).order("product_name"),
    ]);
    setOpenReceipt({ payment: pay, items: items ?? [] });
  };

  const remove = async (id: string) => {
    if (readOnly) return toast.error("Você está apenas consultando os dados do representante.");
    if (!confirm("Excluir este repasse? As vendas vinculadas voltarão para 'pendentes'.")) return;
    await (supabase as any).from("sales").update({ repassed_quantity: 0 }).eq("supplier_payment_id", id);
    const { error } = await (supabase as any).from("supplier_payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const paid = payments.reduce((a, p) => a + Number(p.amount), 0);
  const boletoPaidTotal = boletos.filter((b) => b.paid_at).reduce((a, b) => a + b.total, 0);
  const boletoOpenTotal = boletos.filter((b) => !b.paid_at).reduce((a, b) => a + b.total, 0);
  const owed = supplierTotal - paid - boletoPaidTotal;

  const confirmBoleto = async (b: any, confirm: boolean) => {
    if (readOnly) return toast.error("Você está apenas consultando os dados do representante.");
    const { error } = await (supabase as any)
      .from("sales")
      .update({
        boleto_paid_at: confirm ? new Date().toISOString() : null,
        status: confirm ? "paid" : "unpaid",
        repassed_quantity: confirm ? b.quantity : 0,
      })
      .eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success(confirm ? "Boleto confirmado — descontado do saldo devido" : "Confirmação desfeita");
    load();
  };

  const filteredPending = pending.filter((p) => {
    const t = qPend.toLowerCase().trim();
    if (!t) return true;
    return [p.product_name, String(p.quantity), fmtBRL(p.unit_cost), fmtBRL(p.total_cost)]
      .some((v) => v.toLowerCase().includes(t));
  });
  const inPeriod = (p: any) => {
    if (!periodMonth) return true;
    const d = new Date(p.paid_at);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return ym === periodMonth;
  };
  const periodPayments = payments.filter(inPeriod);
  const periodTotal = periodPayments.reduce((a, p) => a + Number(p.amount), 0);
  const filteredPayments = periodPayments.filter((p) => {
    const t = qHist.toLowerCase().trim();
    if (!t) return true;
    return [
      new Date(p.paid_at).toLocaleDateString("pt-BR"),
      p.note ?? "",
      fmtBRL(p.amount),
      String(p.amount),
    ].some((v) => String(v).toLowerCase().includes(t));
  });

  const pendSort = useSort(filteredPending, {
    product_name: (p) => p.product_name,
    quantity: (p) => p.quantity,
    unit_cost: (p) => Number(p.unit_cost),
    total_cost: (p) => Number(p.total_cost),
  }, { key: "product_name", dir: "asc" });

  const histSort = useSort(filteredPayments, {
    paid_at: (p) => new Date(p.paid_at).getTime(),
    note: (p) => p.note ?? "",
    amount: (p) => Number(p.amount),
  }, { key: "paid_at", dir: "desc" });

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold">Repasses ao Fornecedor</h2>{readOnly && <p className="text-sm text-muted-foreground">Dados do representante — somente consulta.</p>}</div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Total gerado pelas vendas (custo)</p>
          <p className="text-2xl font-bold">{fmtBRL(supplierTotal)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Já repassado</p>
          <p className="text-2xl font-bold text-primary">{fmtBRL(paid)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Boletos pagos (direto ao fornecedor)</p>
          <p className="text-2xl font-bold text-primary">{fmtBRL(boletoPaidTotal)}</p>
          {boletoOpenTotal > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{fmtBRL(boletoOpenTotal)} aguardando confirmação</p>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Saldo devido</p>
          <p className={`text-2xl font-bold ${owed > 0 ? "text-destructive" : "text-primary"}`}>{fmtBRL(owed)}</p>
        </Card>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold">Boletos — pagamento direto ao fornecedor</h3>
          {boletos.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setOpenBoletoReport(true)}>
              <FileText className="h-4 w-4 mr-1" /> Relatório de boletos
            </Button>
          )}
        </div>
        {boletos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda em boleto registrada.</p>
        ) : (
          <div className="overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="text-left p-2">Produto</th>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">Vencimento</th>
                  <th className="text-right p-2">Qtd</th>
                  <th className="text-right p-2">Valor (custo)</th>
                  <th className="text-center p-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {boletos.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-2">{b.product_name}</td>
                    <td className="p-2">{b.customer_name ?? "—"}</td>
                    <td className="p-2">{b.due_date ? new Date(b.due_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-2 text-right">{b.quantity}</td>
                    <td className="p-2 text-right font-semibold">{fmtBRL(b.total)}</td>
                    <td className="p-2 text-center">
                      {b.paid_at ? (
                        <div className="flex items-center justify-center gap-2">
                          <Badge>Pago em {new Date(b.paid_at).toLocaleDateString("pt-BR")}</Badge>
                          {!readOnly && <Button size="sm" variant="ghost" onClick={() => confirmBoleto(b, false)}>Desfazer</Button>}
                        </div>
                      ) : !readOnly ? (
                        <Button size="sm" variant="outline" onClick={() => confirmBoleto(b, true)}>
                          Confirmar pagamento
                        </Button>
                      ) : (
                        <Badge variant="outline">Aguardando pagamento</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!readOnly && <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold">Vendas pendentes de repasse</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {selected.size}/{pending.length} selecionado(s) — {fmtBRL(selectedTotal)}
            </span>
            {pending.length > 0 && (
              <Button size="sm" variant="outline" onClick={toggleAll}>
                {allSelected ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            )}
          </div>
        </div>

        {pending.length > 0 && (
          <div className="relative max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar em todos os campos..." value={qPend} onChange={(e) => setQPend(e.target.value)} />
          </div>
        )}

        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda pendente. Todas as vendas já foram repassadas.</p>
        ) : (
          <>
            <div className="overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-secondary-foreground">
                  <tr>
                    <th className="p-2 w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                    </th>
                    <th className="text-left p-2"><SortHeader label="Produto" sortKey="product_name" currentKey={pendSort.sortKey} dir={pendSort.sortDir} onToggle={pendSort.toggle} /></th>
                    <th className="text-right p-2"><SortHeader label="Qtd vendida" sortKey="quantity" currentKey={pendSort.sortKey} dir={pendSort.sortDir} onToggle={pendSort.toggle} /></th>
                    <th className="text-right p-2">Qtd a repassar</th>
                    <th className="text-right p-2"><SortHeader label="Custo unit." sortKey="unit_cost" currentKey={pendSort.sortKey} dir={pendSort.sortDir} onToggle={pendSort.toggle} /></th>
                    <th className="text-right p-2"><SortHeader label="Total" sortKey="total_cost" currentKey={pendSort.sortKey} dir={pendSort.sortDir} onToggle={pendSort.toggle} /></th>
                  </tr>
                </thead>
                <tbody>
                  {pendSort.sorted.map((p) => (
                    <tr key={p.product_id} className="border-t">
                      <td className="p-2">
                        <Checkbox checked={selected.has(p.product_id)} onCheckedChange={() => toggle(p.product_id)} />
                      </td>
                      <td className="p-2">{p.product_name}</td>
                      <td className="p-2 text-right">{p.quantity}</td>
                      <td className="p-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={p.quantity}
                          className="h-8 w-24 ml-auto text-right"
                          disabled={!selected.has(p.product_id)}
                          value={qtyByProduct[p.product_id] ?? p.quantity}
                          onChange={(e) => {
                            const v = Math.min(Math.max(Number(e.target.value) || 0, 0), p.quantity);
                            setQtyByProduct({ ...qtyByProduct, [p.product_id]: v });
                          }}
                        />
                      </td>
                      <td className="p-2 text-right">{fmtBRL(p.unit_cost)}</td>
                      <td className="p-2 text-right font-semibold">{fmtBRL(qtyOf(p) * Number(p.unit_cost))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50">
                  <tr>
                    <td className="p-2 font-bold" colSpan={5}>Total selecionado</td>
                    <td className="p-2 text-right font-bold">{fmtBRL(selectedTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Data do pagamento</Label>
                <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Observação</Label>
                <Textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional (ex: PIX, recibo nº...)" />
              </div>
            </div>
            <Button onClick={submit} disabled={selected.size === 0}>
              Registrar Repasse de {fmtBRL(selectedTotal)}
            </Button>
          </>
        )}
      </Card>}

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold">Histórico de Repasses</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} className="w-40" />
            {periodMonth && (
              <Button size="sm" variant="ghost" onClick={() => setPeriodMonth("")}>Limpar</Button>
            )}
            {payments.length > 0 && (
              <div className="relative w-full sm:w-72">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar em todos os campos..." value={qHist} onChange={(e) => setQHist(e.target.value)} />
              </div>
            )}
          </div>
        </div>
        {periodMonth && (
          <div className="px-4 py-2 bg-muted/40 border-b text-sm flex justify-between">
            <span className="text-muted-foreground">Total repassado no período</span>
            <span className="font-bold text-primary">{fmtBRL(periodTotal)}</span>
          </div>
        )}
        {payments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum repasse registrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="text-left p-3"><SortHeader label="Data" sortKey="paid_at" currentKey={histSort.sortKey} dir={histSort.sortDir} onToggle={histSort.toggle} /></th>
                <th className="text-left p-3"><SortHeader label="Observação" sortKey="note" currentKey={histSort.sortKey} dir={histSort.sortDir} onToggle={histSort.toggle} /></th>
                <th className="text-right p-3"><SortHeader label="Valor" sortKey="amount" currentKey={histSort.sortKey} dir={histSort.sortDir} onToggle={histSort.toggle} /></th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {histSort.sorted.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">{new Date(p.paid_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3">{p.note ?? "—"}</td>
                  <td className="p-3 text-right font-semibold">{fmtBRL(p.amount)}</td>
                  <td className="p-3 text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => openReceiptFor(p.id)}>
                      <FileText className="h-4 w-4 mr-1" /> Comprovante
                    </Button>
                    {!readOnly && <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={!!openReceipt} onOpenChange={(o) => !o && setOpenReceipt(null)}>
        <DialogContent className="max-w-2xl print:shadow-none">
          <DialogHeader>
            <DialogTitle>Comprovante de Repasse — Fruta²</DialogTitle>
          </DialogHeader>
          {openReceipt && (
            <>
              <div className="max-h-[65vh] overflow-auto pr-1">
                <ReceiptDoc
                  payment={openReceipt.payment}
                  items={openReceipt.items}
                  boletos={boletos.filter((b) => b.paid_at)}
                />
              </div>
              <PrintPortal>
                <ReceiptDoc
                  payment={openReceipt.payment}
                  items={openReceipt.items}
                  boletos={boletos.filter((b) => b.paid_at)}
                />
              </PrintPortal>
            </>
          )}
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setOpenReceipt(null)}>Fechar</Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir / Salvar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openBoletoReport} onOpenChange={setOpenBoletoReport}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Relatório de Boletos — Fruta²</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto pr-1">
            <BoletoReportDoc
              rows={boletos.filter((b) => b.paid_at)}
              periodLabel={`Emitido em ${new Date().toLocaleDateString("pt-BR")}`}
            />
          </div>
          {openBoletoReport && (
            <PrintPortal>
              <BoletoReportDoc
                rows={boletos.filter((b) => b.paid_at)}
                periodLabel={`Emitido em ${new Date().toLocaleDateString("pt-BR")}`}
              />
            </PrintPortal>
          )}
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setOpenBoletoReport(false)}>Fechar</Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir / Salvar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
