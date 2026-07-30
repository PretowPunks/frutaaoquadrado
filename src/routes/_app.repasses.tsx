import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

export const Route = createFileRoute("/_app/repasses")({ component: RepassesPage });

type PendingItem = { product_id: string; product_name: string; quantity: number; unit_cost: number; total_cost: number };
type SaleRemain = { id: string; remaining: number };

function RepassesPage() {
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

  const load = async () => {
    const [paysRes, salesRes] = await Promise.all([
      (supabase as any).from("supplier_payments").select("*").order("paid_at", { ascending: false }),
      supabase.from("sales").select("id, product_id, quantity, repassed_quantity, unit_cost, supplier_payment_id, status, products(name)"),
    ]);
    setPayments(paysRes.data ?? []);
    const sales = (salesRes.data ?? []) as any[];
    setSupplierTotal(sales.reduce((a, s) => a + Number(s.unit_cost) * s.quantity, 0));

    // Agrupa vendas pendentes (sem repasse) por produto
    const pend = sales.filter(
      (s: any) => s.status !== "scheduled" && s.quantity - (s.repassed_quantity ?? 0) > 0,
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
  useEffect(() => { load(); }, []);

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
    if (selectedItems.length === 0) return toast.error("Selecione ao menos um produto para repassar");
    const { data: u } = await supabase.auth.getUser();

    // 1. cria o repasse
    const { data: pay, error: e1 } = await (supabase as any).from("supplier_payments").insert({
      amount: selectedTotal,
      note: note || null,
      paid_at: new Date(paidAt).toISOString(),
      created_by: u.user?.id,
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
    if (!confirm("Excluir este repasse? As vendas vinculadas voltarão para 'pendentes'.")) return;
    await (supabase as any).from("sales").update({ repassed_quantity: 0 }).eq("supplier_payment_id", id);
    const { error } = await (supabase as any).from("supplier_payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const paid = payments.reduce((a, p) => a + Number(p.amount), 0);
  const owed = supplierTotal - paid;

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
      <h2 className="text-2xl font-bold">Repasses ao Fornecedor</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Total gerado pelas vendas (custo)</p>
          <p className="text-2xl font-bold">{fmtBRL(supplierTotal)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Já repassado</p>
          <p className="text-2xl font-bold text-primary">{fmtBRL(paid)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Saldo devido</p>
          <p className={`text-2xl font-bold ${owed > 0 ? "text-destructive" : "text-primary"}`}>{fmtBRL(owed)}</p>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
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
      </Card>

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
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
            <div id="receipt-printable" className="space-y-4 text-sm">
              <div className="flex justify-between border-b pb-2">
                <div>
                  <p className="text-muted-foreground">Data do pagamento</p>
                  <p className="font-semibold">{new Date(openReceipt.payment.paid_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Repasse nº</p>
                  <p className="font-mono text-xs">{openReceipt.payment.id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">Produtos vendidos incluídos neste repasse:</p>
                <div className="overflow-auto rounded border">
                  <table className="w-full">
                    <thead className="bg-secondary text-secondary-foreground">
                      <tr>
                        <th className="text-left p-2">Produto</th>
                        <th className="text-right p-2">Qtd</th>
                        <th className="text-right p-2">Custo unit.</th>
                        <th className="text-right p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openReceipt.items.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="p-2">{it.product_name}</td>
                          <td className="p-2 text-right">{it.quantity}</td>
                          <td className="p-2 text-right">{fmtBRL(it.unit_cost)}</td>
                          <td className="p-2 text-right font-semibold">{fmtBRL(it.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/50">
                      <tr>
                        <td className="p-2 font-bold" colSpan={3}>TOTAL DO REPASSE</td>
                        <td className="p-2 text-right font-bold">{fmtBRL(openReceipt.payment.amount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {openReceipt.payment.note && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Observação:</p>
                  <p>{openReceipt.payment.note}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                <div className="border-t pt-2">Assinatura — Fruta²</div>
                <div className="border-t pt-2">Assinatura — Fornecedor</div>
              </div>
            </div>
          )}
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setOpenReceipt(null)}>Fechar</Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir / Salvar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
