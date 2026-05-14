import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/repasses")({ component: RepassesPage });

function RepassesPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [supplierTotal, setSupplierTotal] = useState(0);
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().slice(0, 10));

  const load = async () => {
    const [{ data: pays }, { data: sales }] = await Promise.all([
      (supabase as any).from("supplier_payments").select("*").order("paid_at", { ascending: false }),
      supabase.from("sales").select("unit_cost, quantity"),
    ]);
    setPayments(pays ?? []);
    setSupplierTotal((sales ?? []).reduce((a: number, s: any) => a + Number(s.unit_cost) * s.quantity, 0));
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!amount || amount <= 0) return toast.error("Informe um valor válido");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("supplier_payments").insert({
      amount,
      note: note || null,
      paid_at: new Date(paidAt).toISOString(),
      created_by: u.user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Repasse registrado");
    setAmount(0); setNote("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este repasse?")) return;
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
        <h3 className="font-semibold">Registrar novo repasse</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" min={0} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <Label>Data do pagamento</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Observação</Label>
            <Textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional (ex: PIX, recibo nº...)" />
          </div>
        </div>
        <Button onClick={submit}>Registrar Repasse</Button>
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
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">{new Date(p.paid_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3">{p.note ?? "—"}</td>
                  <td className="p-3 text-right font-semibold">{fmtBRL(p.amount)}</td>
                  <td className="p-3 text-right">
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
    </div>
  );
}
