import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Package, AlertTriangle, TrendingUp, DollarSign, Wallet } from "lucide-react";
import { useScope, scopeProducts } from "@/hooks/use-scope";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

function Dashboard() {
  const { ownerId, productOwner, isMatriz, isViewingRep } = useScope();
  const [stats, setStats] = useState({
    stockValue: 0,
    totalProfit: 0,
    supplierReturn: 0,
    supplierPaid: 0,
    supplierOwed: 0,
    pendingPayment: 0,
    lowStock: [] as { id: string; name: string; stock_quantity: number }[],
    profitByProduct: [] as { name: string; profit: number }[],
    lastBackupAt: null as string | null,
  });

  const load = useCallback(async () => {
    {
      const { data: products } = await scopeProducts(supabase.from("products").select("*") as any, productOwner);
      const salesQuery = supabase.from("sales").select("*, products(name)");
      const { data: sales } = await (isMatriz ? salesQuery : salesQuery.eq("owner_id", ownerId));
      const paysQuery = (supabase as any).from("supplier_payments").select("amount");
      const { data: pays } = await (isMatriz ? paysQuery.eq("owner_id", ownerId) : paysQuery.eq("owner_id", ownerId));
      const { data: backups } = await (supabase as any)
        .from("data_backups").select("created_at").order("created_at", { ascending: false }).limit(1);

      const stockValue = (products ?? []).reduce(
        (s, p) => s + Number(p.cost_price) * p.stock_quantity,
        0,
      );
      const lowStock = (products ?? [])
        .filter((p) => p.stock_quantity <= p.low_stock_threshold)
        .map((p) => ({ id: p.id, name: p.name, stock_quantity: p.stock_quantity }));

      let totalProfit = 0;
      let supplierReturn = 0;
      let pendingPayment = 0;
      let boletoPaid = 0;
      const byProduct = new Map<string, number>();

      for (const s of sales ?? []) {
        const profit = (Number(s.unit_sale_price) - Number(s.unit_cost)) * s.quantity;
        totalProfit += profit;
        supplierReturn += Number(s.unit_cost) * s.quantity;
        if ((s as any).payment_method === "boleto" && (s as any).boleto_paid_at)
          boletoPaid += Number(s.unit_cost) * s.quantity;
        if (s.status === "unpaid")
          pendingPayment += Number(s.unit_sale_price) * s.quantity;
        const name = (s as any).products?.name ?? "—";
        byProduct.set(name, (byProduct.get(name) ?? 0) + profit);
      }

      const supplierPaid = (pays ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);

      setStats({
        stockValue,
        totalProfit,
        supplierReturn,
        supplierPaid,
        supplierOwed: supplierReturn - supplierPaid - boletoPaid,
        pendingPayment,
        lowStock,
        profitByProduct: [...byProduct.entries()]
          .map(([name, profit]) => ({ name, profit }))
          .sort((a, b) => b.profit - a.profit),
        lastBackupAt: backups?.[0]?.created_at ?? null,
      });
    }
  }, [isMatriz, ownerId, productOwner]);

  // Faturamento em tempo real: recarrega quando vendas ou estoque mudam na rua
  useEffect(() => {
    load();
    const channel = supabase
      .channel("painel-tempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold">Painel Fruta²</h2><p className="text-sm text-muted-foreground">{isMatriz ? "Visão consolidada das vendas da matriz e dos representantes." : isViewingRep ? "Indicadores do representante selecionado." : "Seus indicadores de vendas e estoque móvel."}</p></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Package />} label="Valor do Estoque" value={fmt(stats.stockValue)} />
        <StatCard icon={<TrendingUp />} label="Lucro Bruto Total" value={fmt(stats.totalProfit)} />
        <StatCard icon={<Wallet />} label="Saldo Devido ao Fornecedor" value={fmt(stats.supplierOwed)} />
        <StatCard icon={<DollarSign />} label="Vendas A Receber" value={fmt(stats.pendingPayment)} />
      </div>

      <Card className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Total gerado pelas vendas (custo): </span>
          <span className="font-semibold">{fmt(stats.supplierReturn)}</span>
          <span className="mx-2 text-muted-foreground">·</span>
          <span className="text-muted-foreground">Já repassado: </span>
          <span className="font-semibold text-primary">{fmt(stats.supplierPaid)}</span>
        </div>
        <div className="text-muted-foreground">
          Backup automático diário ·{" "}
          {stats.lastBackupAt
            ? <>último em <span className="font-medium text-foreground">{new Date(stats.lastBackupAt).toLocaleString("pt-BR")}</span></>
            : <span className="italic">aguardando primeira execução (03:00 UTC)</span>}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-accent" />
            <h3 className="font-semibold">Produtos com Baixo Estoque</h3>
          </div>
          {stats.lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum produto em alerta.</p>
          ) : (
            <ul className="divide-y">
              {stats.lowStock.map((p) => (
                <li key={p.id} className="py-2 flex justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="font-semibold text-destructive">{p.stock_quantity} un.</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">Lucro por Produto</h3>
          {stats.profitByProduct.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem vendas registradas ainda.</p>
          ) : (
            <ul className="divide-y max-h-80 overflow-auto">
              {stats.profitByProduct.map((p) => (
                <li key={p.name} className="py-2 flex justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="font-semibold text-primary">{fmt(p.profit)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}