import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { fmtBRL } from "@/lib/format";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard da Matriz — Fruta²" },
      { name: "description", content: "Indicadores operacionais e financeiros da Matriz Fruta²." },
      { property: "og:title", content: "Dashboard da Matriz — Fruta²" },
      {
        property: "og:description",
        content: "Acompanhe faturamento, pedidos, estoque e desempenho comercial da Fruta².",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type ChartItem = { label: string; detail?: string; value: number };
type DashboardStats = {
  revenue: number;
  pendingCount: number;
  pendingValue: number;
  scheduledCount: number;
  scheduledValue: number;
  openValue: number;
  boletoValue: number;
  lowStock: Array<{
    id: string;
    name: string;
    stock_quantity: number;
    low_stock_threshold: number;
  }>;
  topProducts: ChartItem[];
  salesByTerritory: ChartItem[];
};

const initialStats: DashboardStats = {
  revenue: 0,
  pendingCount: 0,
  pendingValue: 0,
  scheduledCount: 0,
  scheduledValue: 0,
  openValue: 0,
  boletoValue: 0,
  lowStock: [],
  topProducts: [],
  salesByTerritory: [],
};

function paymentStatus(sale: Record<string, any>) {
  if (sale.payment_status === "paid" || sale.status === "paid") return "paid";
  if (sale.payment_status === "boleto" || sale.payment_method === "boleto") return "boleto";
  return "unpaid";
}

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>(initialStats);

  const load = useCallback(async () => {
    const [{ data: productRows }, { data: saleRows }, { data: inviteRows }] = await Promise.all([
      supabase.from("products").select("*").is("owner_id", null),
      supabase.from("sales").select("*, products(name), customers(city)"),
      supabase.from("rep_invites").select("email, name, accepted_user_id"),
    ]);
    const products = (productRows ?? []) as Array<Record<string, any>>;
    const sales = (saleRows ?? []) as Array<Record<string, any>>;
    const repNames = new Map(
      ((inviteRows ?? []) as Array<Record<string, any>>).map((rep) => [
        rep.accepted_user_id,
        rep.name || rep.email || "Representante",
      ]),
    );

    const orders = new Map<string, { status: string; total: number }>();
    const byProduct = new Map<string, number>();
    const byTerritory = new Map<string, number>();
    let revenue = 0;
    let openValue = 0;
    let boletoValue = 0;

    for (const sale of sales) {
      const total = Number(sale.unit_sale_price) * Number(sale.quantity);
      revenue += total;
      const payStatus = paymentStatus(sale);
      if (payStatus === "unpaid") openValue += total;
      if (payStatus === "boleto") boletoValue += total;

      const orderKey = String(sale.order_id ?? sale.id);
      const currentOrder = orders.get(orderKey) ?? {
        status: sale.order_status ?? (sale.status === "scheduled" ? "scheduled" : "delivered"),
        total: 0,
      };
      currentOrder.total += total;
      orders.set(orderKey, currentOrder);

      const product = sale.products?.name ?? "Produto não identificado";
      byProduct.set(product, (byProduct.get(product) ?? 0) + Number(sale.quantity));
      const city = sale.customers?.city || "Cidade não informada";
      const representative =
        repNames.get(sale.owner_id) || (sale.owner_id ? "Representante" : "Matriz");
      const territory = `${city} / ${representative}`;
      byTerritory.set(territory, (byTerritory.get(territory) ?? 0) + total);
    }

    const pending = [...orders.values()].filter((order) => order.status === "pending");
    const scheduled = [...orders.values()].filter((order) => order.status === "scheduled");
    setStats({
      revenue,
      pendingCount: pending.length,
      pendingValue: pending.reduce((sum, order) => sum + order.total, 0),
      scheduledCount: scheduled.length,
      scheduledValue: scheduled.reduce((sum, order) => sum + order.total, 0),
      openValue,
      boletoValue,
      lowStock: products
        .filter((product) => Number(product.stock_quantity) <= Number(product.low_stock_threshold))
        .map((product) => ({
          id: product.id,
          name: product.name,
          stock_quantity: Number(product.stock_quantity),
          low_stock_threshold: Number(product.low_stock_threshold),
        }))
        .sort((a, b) => a.stock_quantity - b.stock_quantity),
      topProducts: [...byProduct.entries()]
        .map(([label, value]) => ({ label, value, detail: `${value} un.` }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
      salesByTerritory: [...byTerritory.entries()]
        .map(([label, value]) => ({ label, value, detail: fmtBRL(value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
    });
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("dashboard-matriz-tempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, load)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-2xl font-bold">Dashboard da Matriz</h2>
        <p className="text-sm text-muted-foreground">
          Visão consolidada da operação e do financeiro.
        </p>
      </div>

      <KpiSection
        title="Bloco Operacional"
        description="Pedidos, faturamento e disponibilidade de estoque."
      >
        <KpiCard icon={<TrendingUp />} label="Faturamento Total" value={fmtBRL(stats.revenue)} />
        <KpiCard
          icon={<Clock3 />}
          label="Pedidos Pendentes"
          value={`${stats.pendingCount} pedido(s)`}
          detail={fmtBRL(stats.pendingValue)}
        />
        <KpiCard
          icon={<CalendarClock />}
          label="Pedidos Agendados"
          value={`${stats.scheduledCount} pedido(s)`}
          detail={fmtBRL(stats.scheduledValue)}
        />
        <KpiCard
          icon={<AlertTriangle />}
          label="Alertas de Estoque Baixo"
          value={`${stats.lowStock.length} sabor(es)`}
          detail={
            stats.lowStock.length
              ? stats.lowStock.map((item) => item.name).join(", ")
              : "Nenhum alerta"
          }
          alert={stats.lowStock.length > 0}
        />
      </KpiSection>

      <KpiSection title="Bloco Financeiro" description="Valores ainda aguardando recebimento.">
        <KpiCard icon={<Banknote />} label="A Pagar / Em Aberto" value={fmtBRL(stats.openValue)} />
        <KpiCard
          icon={<ReceiptText />}
          label="Boletos a Receber"
          value={fmtBRL(stats.boletoValue)}
        />
      </KpiSection>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title="Produtos Mais Vendidos"
          subtitle="Top sabores de polpa por quantidade"
          icon={<PackageCheck className="h-5 w-5" />}
          items={stats.topProducts}
        />
        <ChartCard
          title="Vendas por Cidade / Representante"
          subtitle="Valor bruto vendido por território"
          icon={<CircleDollarSign className="h-5 w-5" />}
          items={stats.salesByTerritory}
        />
      </div>

      {stats.lowStock.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b p-5">
            <h3 className="font-semibold">Produtos abaixo do limite</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="p-3 text-left">Sabor</th>
                  <th className="p-3 text-right">Saldo atual</th>
                  <th className="p-3 text-right">Limite</th>
                </tr>
              </thead>
              <tbody>
                {stats.lowStock.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-right font-semibold text-destructive">
                      {item.stock_quantity} un.
                    </td>
                    <td className="p-3 text-right">{item.low_stock_threshold} un.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function KpiSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold uppercase text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function KpiCard({
  icon,
  label,
  value,
  detail,
  alert = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  alert?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${alert ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold">{value}</p>
          {detail && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={detail}>
              {detail}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  icon,
  items,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  items: ChartItem[];
}) {
  const max = useMemo(() => Math.max(...items.map((item) => item.value), 1), [items]);
  return (
    <Card className="p-5">
      <div className="mb-5 flex items-start gap-2 text-primary">
        {icon}
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="flex min-h-52 items-center justify-center text-sm text-muted-foreground">
          Sem vendas registradas ainda.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0 font-medium">{item.label}</span>
                <span className="shrink-0 text-muted-foreground">{item.detail}</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-secondary">
                <div
                  className="h-full rounded bg-primary transition-[width] duration-500"
                  style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
