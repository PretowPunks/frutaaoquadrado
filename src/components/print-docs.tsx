import { fmtBRL } from "@/lib/format";

type Item = {
  id?: string;
  product_name: string;
  quantity: number;
  unit_cost?: number;
  unit_price?: number;
  total: number;
};

function DocHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-end justify-between border-b pb-2 mb-4">
      <div>
        <p className="text-xl font-bold leading-none">Fruta²</p>
        <p className="text-xs text-muted-foreground">Polpas de fruta</p>
      </div>
      <div className="text-right">
        <p className="font-semibold">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
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
