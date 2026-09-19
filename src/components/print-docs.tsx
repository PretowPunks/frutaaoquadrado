import { fmtBRL } from "@/lib/format";

type Item = {
  id?: string;
  product_name: string;
  quantity: number;
  unit_cost?: number;
  unit_price?: number;
  total: number;
};

export type PickingListOrder = {
  id: string;
  deliveryDate: string;
  customer: string;
  address: string;
  representative: string;
  items: Array<{ name: string; quantity: number }>;
};

export function PickingListDoc({ orders }: { orders: PickingListOrder[] }) {
  const consolidated = Array.from(
    orders
      .flatMap((order) => order.items)
      .reduce((items, item) => {
        items.set(item.name, (items.get(item.name) ?? 0) + item.quantity);
        return items;
      }, new Map<string, number>()),
  ).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  const dates = Array.from(new Set(orders.map((order) => order.deliveryDate))).sort();

  return (
    <div className="space-y-6 bg-card p-5 text-card-foreground">
      <header className="border-b pb-4">
        <p className="text-2xl font-bold">Fruta²</p>
        <h2 className="text-lg font-semibold">Romaneio / Lista de Separação</h2>
        <p className="text-sm text-muted-foreground">
          Entrega:{" "}
          {dates
            .map((date) => new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR"))
            .join(" a ")}
        </p>
      </header>

      <section>
        <h3 className="mb-2 font-semibold">Resumo Consolidado de Estoque</h3>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Sabor / Produto</th>
              <th className="text-right">Caixas / Unidades</th>
            </tr>
          </thead>
          <tbody>
            {consolidated.map(([name, quantity]) => (
              <tr key={name}>
                <td>{name}</td>
                <td className="text-right font-semibold">{quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">Detalhamento por Cliente</h3>
        {orders.map((order) => (
          <article key={order.id} className="print-avoid-break border-t pt-3">
            <div className="mb-2 flex justify-between gap-4">
              <div>
                <p className="font-semibold">{order.customer}</p>
                <p className="text-sm">{order.address}</p>
              </div>
              <div className="text-right text-sm">
                <p>{order.representative}</p>
                <p>{new Date(`${order.deliveryDate}T00:00:00`).toLocaleDateString("pt-BR")}</p>
              </div>
            </div>
            <ul className="text-sm">
              {order.items.map((item) => (
                <li key={item.name}>
                  {item.quantity} × {item.name}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}

/** Card de pedido para conferência do cliente (WhatsApp / Instagram) */
export function OrderCardDoc({
  customer,
  createdAt,
  items,
  status,
  extra,
}: {
  customer: { name: string; phone?: string | null };
  createdAt: string;
  items: Item[];
  status: string;
  extra?: string | null;
}) {
  const total = items.reduce((a, i) => a + Number(i.total), 0);
  const qty = items.reduce((a, i) => a + Number(i.quantity), 0);
  return (
    <div className="rounded-xl border overflow-hidden bg-card print-avoid-break">
      <div className="bg-primary text-primary-foreground px-5 py-4">
        <p className="text-lg font-bold leading-tight">Fruta²</p>
        <p className="text-xs opacity-90">Comprovante de pedido</p>
      </div>
      <div className="p-5 space-y-4 text-sm">
        <div className="flex justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="font-semibold">{customer.name}</p>
            {customer.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Data</p>
            <p className="font-semibold">{new Date(createdAt).toLocaleDateString("pt-BR")}</p>
            <p className="text-xs">{status}</p>
          </div>
        </div>

        <ul className="divide-y border-y">
          {items.map((it, i) => (
            <li key={i} className="py-2 flex justify-between gap-3">
              <div>
                <p className="font-medium">{it.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  {it.quantity} × {fmtBRL(it.unit_price ?? 0)}
                </p>
              </div>
              <span className="font-semibold whitespace-nowrap">{fmtBRL(it.total)}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-between items-end">
          <span className="text-xs text-muted-foreground">{qty} item(ns)</span>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total do pedido</p>
            <p className="text-2xl font-bold text-primary">{fmtBRL(total)}</p>
          </div>
        </div>

        {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
        <p className="text-[11px] text-center text-muted-foreground pt-1">
          Obrigado pela preferência! 🍓
        </p>
      </div>
    </div>
  );
}
