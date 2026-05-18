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
import { Trash2, FileText, Printer } from "lucide-react";

export const Route = createFileRoute("/_app/repasses")({ component: RepassesPage });

type PendingItem = { product_id: string; product_name: string; quantity: number; unit_cost: number; total_cost: number };

function RepassesPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [supplierTotal, setSupplierTotal] = useState(0);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [saleIdsByProduct, setSaleIdsByProduct] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [openReceipt, setOpenReceipt] = useState<null | { payment: any; items: any[] }>(null);

  const load = async () => {
    const [paysRes, salesRes] = await Promise.all([
      (supabase as any).from("supplier_payments").select("*").order("paid_at", { ascending: false }),
      supabase.from("sales").select("id, product_id, quantity, unit_cost, supplier_payment_id, status, products(name)"),
    ]);
    setPayments(paysRes.data ?? []);
    const sales = (salesRes.data ?? []) as any[];
    setSupplierTotal(sales.reduce((a, s) => a + Number(s.unit_cost) * s.quantity, 0));

    // Agrupa vendas pendentes (sem repasse) por produto
    const pend = sales.filter((s: any) => !s.supplier_payment_id && s.status !== "scheduled");
    const grouped = new Map<string, PendingItem>();
    const idsMap: Record<string, string[]> = {};
    for (const s of pend) {
      const key = s.product_id;
      const name = s.products?.name ?? "—";
      const cur = grouped.get(key) ?? { product_id: key, product_name: name, quantity: 0, unit_cost: Number(s.unit_cost), total_cost: 0 };
      cur.quantity += s.quantity;
      cur.total_cost += Number(s.unit_cost) * s.quantity;
      grouped.set(key, cur);
      (idsMap[key] ||= []).push(s.id);
    }
    const list = Array.from(grouped.values()).sort((a, b) => a.product_name.localeCompare(b.product_name));
    setPending(list);
    setSaleIdsByProduct(idsMap);
    setSelected(new Set(list.map((p) => p.product_id))); // por padrão tudo selecionado
  };
  useEffect(() => { load(); }, []);

  const selectedItems = pending.filter((p) => selected.has(p.product_id));
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

    // 3. vincula vendas selecionadas ao repasse
    const saleIds = selectedItems.flatMap((p) => saleIdsByProduct[p.product_id] ?? []);
    const { error: e3 } = await (supabase as any).from("sales").update({ supplier_payment_id: pay.id }).in("id", saleIds);
    if (e3) return toast.error(e3.message);

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
    const { error } = await (supabase as any).from("supplier_payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const paid = payments.reduce((a, p) => a + Number(p.amount), 0);
  const owed = supplierTotal - paid;

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
                    <th className="text-left p-2">Produto</th>
                    <th className="text-right p-2">Qtd</th>
                    <th className="text-right p-2">Custo unit.</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((p) => (
                    <tr key={p.product_id} className="border-t">
                      <td className="p-2">
                        <Checkbox checked={selected.has(p.product_id)} onCheckedChange={() => toggle(p.product_id)} />
                      </td>
                      <td className="p-2">{p.product_name}</td>
                      <td className="p-2 text-right">{p.quantity}</td>
                      <td className="p-2 text-right">{fmtBRL(p.unit_cost)}</td>
                      <td className="p-2 text-right font-semibold">{fmtBRL(p.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50">
                  <tr>
                    <td className="p-2 font-bold" colSpan={4}>Total selecionado</td>
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
        <h3 className="p-4 font-semibold border-b">Histórico de Repasses</h3>
        {payments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum repasse registrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Observação</th>
                <th className="text-right p-3">Valor</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
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
