import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/mock-client";
import { useAuth } from "@/hooks/use-auth";
import { customerAddress, type Customer } from "@/lib/customer";
import { fmtBRL } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrintPortal } from "@/components/print-portal";
import { PickingListDoc, type PickingListOrder } from "@/components/print-docs";

export const Route = createFileRoute("/_app/transferencias")({
  head: () => ({
    meta: [
      { title: "Pedidos & Entregas — Fruta²" },
      { name: "description", content: "Consulte pedidos, atualize entregas e gere romaneios de separação." },
      { property: "og:title", content: "Pedidos & Entregas — Fruta²" },
      { property: "og:description", content: "Gestão de pedidos, entregas, pagamentos e listas de separação da Fruta²." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersDeliveriesPage,
});

type DeliveryStatus = "pending" | "scheduled" | "delivered";
type PaymentStatus = "unpaid" | "boleto" | "paid";
type Representative = { user_id: string; label: string };
type Sale = Record<string, any> & { customers?: Customer; products?: { name?: string } };
type Order = {
  id: string;
  deliveryDate: string;
  customer: Customer | null;
  representativeId: string;
  representative: string;
  items: Sale[];
  total: number;
  deliveryStatus: DeliveryStatus;
  paymentStatus: PaymentStatus;
};

const deliveryLabels: Record<DeliveryStatus, string> = { pending: "Pendente", scheduled: "Agendada", delivered: "Entregue" };
const paymentLabels: Record<PaymentStatus, string> = { unpaid: "A Pagar", boleto: "Boleto", paid: "Pago" };

function OrdersDeliveriesPage() {
  const { isAdmin } = useAuth();
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [representativeId, setRepresentativeId] = useState("all");
  const [situation, setSituation] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    void supabase.from("rep_invites").select("email, name, accepted_user_id").not("accepted_user_id", "is", null).then(({ data }) => {
      setRepresentatives(((data ?? []) as any[]).map((rep) => ({
        user_id: rep.accepted_user_id,
        label: rep.name || rep.email || "Representante",
      })));
    });
  }, [isAdmin]);

  const representativeLabel = (id: string) => representatives.find((rep) => rep.user_id === id)?.label ?? "Representante";

  const searchOrders = async () => {
    if (startDate && endDate && startDate > endDate) return toast.error("A data inicial deve ser anterior à data final");
    setLoading(true);
    let query = supabase.from("sales").select("*, products(name), customers(*)").not("delivery_date", "is", null).order("delivery_date");
    if (startDate) query = query.gte("delivery_date", startDate);
    if (endDate) query = query.lte("delivery_date", endDate);
    if (representativeId !== "all") query = query.eq("owner_id", representativeId);
    if (situation !== "all") query = query.eq("order_status", situation);
    const { data, error } = await query;
    setLoading(false);
    setSearched(true);
    if (error) return toast.error(error.message);

    const grouped = new Map<string, Sale[]>();
    for (const sale of (data ?? []) as Sale[]) {
      const key = String(sale.order_id ?? sale.id);
      grouped.set(key, [...(grouped.get(key) ?? []), sale]);
    }
    setOrders(Array.from(grouped, ([id, items]) => {
      const first = items[0];
      const paymentStatus: PaymentStatus = first.payment_status === "paid" || first.status === "paid"
        ? "paid"
        : first.payment_status === "boleto" || first.payment_method === "boleto" ? "boleto" : "unpaid";
      return {
        id,
        deliveryDate: first.delivery_date,
        customer: first.customers ?? null,
        representativeId: first.owner_id,
        representative: representativeLabel(first.owner_id),
        items,
        total: items.reduce((sum, item) => sum + Number(item.unit_sale_price) * Number(item.quantity), 0),
        deliveryStatus: (first.order_status ?? "pending") as DeliveryStatus,
        paymentStatus,
      };
    }));
  };

  const updateOrder = async (order: Order, patch: Record<string, unknown>, success: string) => {
    const query = supabase.from("sales").update(patch);
    const { error } = order.items[0]?.order_id ? await query.eq("order_id", order.id) : await query.eq("id", order.id);
    if (error) return toast.error(error.message);
    toast.success(success);
    await searchOrders();
  };

  const updateDelivery = (order: Order, status: DeliveryStatus) =>
    updateOrder(order, { order_status: status }, `Entrega atualizada para ${deliveryLabels[status]}`);

  const updatePayment = (order: Order, status: PaymentStatus) =>
    updateOrder(order, {
      payment_status: status,
      payment_method: status === "boleto" ? "boleto" : "direct",
      status: status === "paid" ? "paid" : order.deliveryStatus === "delivered" ? "unpaid" : "scheduled",
      boleto_paid_at: status === "paid" ? new Date().toISOString() : null,
    }, `Pagamento atualizado para ${paymentLabels[status]}`);

  const reportOrders = useMemo<PickingListOrder[]>(() => orders.map((order) => ({
    id: order.id,
    deliveryDate: order.deliveryDate,
    customer: order.customer?.name ?? "Cliente não informado",
    address: order.customer ? customerAddress(order.customer) : "Endereço não informado",
    representative: order.representative,
    items: order.items.map((item) => ({ name: item.products?.name ?? "Produto", quantity: Number(item.quantity) })),
  })), [orders]);
  const canGenerateReport = searched && Boolean(startDate && endDate) && orders.length > 0;

  if (!isAdmin) return <Card className="p-8 text-center text-muted-foreground">Área exclusiva da Matriz.</Card>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Pedidos & Entregas</h2>
        <p className="text-sm text-muted-foreground">Consulte a programação, atualize situações e prepare as entregas.</p>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /><h3 className="font-semibold">Filtros da consulta</h3></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div><Label>Data Início</Label><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
          <div><Label>Data Fim</Label><Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
          <div><Label>Representante</Label><Select value={representativeId} onValueChange={setRepresentativeId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{representatives.map((rep) => <SelectItem key={rep.user_id} value={rep.user_id}>{rep.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Situação</Label><Select value={situation} onValueChange={setSituation}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="pending">Pendente</SelectItem><SelectItem value="scheduled">Agendada</SelectItem><SelectItem value="delivered">Entregue</SelectItem></SelectContent></Select></div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={!canGenerateReport} onClick={() => setReportOpen(true)}><ClipboardList className="mr-2 h-4 w-4" />Gerar Romaneio / Lista de Separação</Button>
          <Button onClick={searchOrders} disabled={loading}><Search className="mr-2 h-4 w-4" />{loading ? "Buscando..." : "Buscar"}</Button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {!searched ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Defina os filtros e clique em Buscar para carregar os pedidos.</div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhum pedido encontrado para os filtros informados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="bg-secondary text-secondary-foreground"><tr><th className="p-3 text-left">Data Agendada</th><th className="p-3 text-left">Cliente</th><th className="p-3 text-left">Representante</th><th className="p-3 text-left">Itens</th><th className="p-3 text-right">Valor Total</th><th className="p-3 text-center">Status da Entrega</th><th className="p-3 text-center">Status do Pagamento</th></tr></thead>
              <tbody>{orders.map((order) => (
                <tr key={order.id} className="border-t align-top">
                  <td className="whitespace-nowrap p-3">{new Date(`${order.deliveryDate}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 font-medium">{order.customer?.name ?? "—"}</td>
                  <td className="p-3">{order.representative}</td>
                  <td className="p-3"><ul>{order.items.map((item) => <li key={item.id}>{item.quantity} × {item.products?.name ?? "Produto"}</li>)}</ul></td>
                  <td className="whitespace-nowrap p-3 text-right font-semibold">{fmtBRL(order.total)}</td>
                  <td className="p-3 text-center"><StatusMenu label={deliveryLabels[order.deliveryStatus]} variant={order.deliveryStatus === "delivered" ? "default" : order.deliveryStatus === "scheduled" ? "secondary" : "outline"} options={(Object.keys(deliveryLabels) as DeliveryStatus[]).map((value) => ({ value, label: deliveryLabels[value] }))} onChange={(value) => updateDelivery(order, value as DeliveryStatus)} /></td>
                  <td className="p-3 text-center"><StatusMenu label={paymentLabels[order.paymentStatus]} variant={order.paymentStatus === "paid" ? "default" : order.paymentStatus === "boleto" ? "secondary" : "outline"} options={(Object.keys(paymentLabels) as PaymentStatus[]).map((value) => ({ value, label: paymentLabels[value] }))} onChange={(value) => updatePayment(order, value as PaymentStatus)} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Romaneio / Lista de Separação</DialogTitle></DialogHeader><div className="max-h-[68vh] overflow-auto"><PickingListDoc orders={reportOrders} /></div><PrintPortal><PickingListDoc orders={reportOrders} /></PrintPortal><DialogFooter className="print:hidden"><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir / PDF</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}

function StatusMenu({ label, variant, options, onChange }: { label: string; variant: "default" | "secondary" | "outline"; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-auto p-0"><Badge variant={variant} className="cursor-pointer">{label}</Badge><span className="sr-only">Alterar status</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{options.map((option) => <DropdownMenuItem key={option.value} onClick={() => onChange(option.value)}>{option.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}