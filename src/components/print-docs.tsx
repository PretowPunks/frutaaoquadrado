import { fmtBRL } from "@/lib/format";

type Item = { id?: string; product_name: string; quantity: number; unit_cost?: number; unit_price?: number; total: number };

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

/** Comprovante de repasse ao fornecedor */
export function ReceiptDoc({
  payment,
  items,
  boletos,
}: {
  payment: any;
  items: any[];
  boletos?: any[];
}) {
  const boletoTotal = (boletos ?? []).reduce((a, b) => a + Number(b.total), 0);
  return (
    <div className="text-sm">
      <DocHeader
        title="Comprovante de Repasse"
        subtitle={`Nº ${String(payment.id).slice(0, 8).toUpperCase()}`}
      />

      <div className="flex justify-between mb-4 print-avoid-break">
        <div>
          <p className="text-muted-foreground text-xs">Data do pagamento</p>
          <p className="font-semibold">{new Date(payment.paid_at).toLocaleDateString("pt-BR")}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs">Valor total</p>
          <p className="font-bold">{fmtBRL(payment.amount)}</p>
        </div>
      </div>

      <p className="font-semibold mb-1">Produtos incluídos neste repasse</p>
      <table className="w-full border rounded">
        <thead className="bg-secondary text-secondary-foreground">
          <tr>
            <th className="text-left p-2">Produto</th>
            <th className="text-right p-2">Qtd</th>
            <th className="text-right p-2">Custo unit.</th>
            <th className="text-right p-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id ?? i} className="border-t">
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
            <td className="p-2 text-right font-bold">{fmtBRL(payment.amount)}</td>
          </tr>
        </tfoot>
      </table>

      {boletos && boletos.length > 0 && (
        <div className="mt-5">
          <p className="font-semibold mb-1">Boletos pagos diretamente ao fornecedor (não incluídos no valor acima)</p>
          <table className="w-full border rounded">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="text-left p-2">Produto</th>
                <th className="text-left p-2">Pago em</th>
                <th className="text-right p-2">Qtd</th>
                <th className="text-right p-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {boletos.map((b, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{b.product_name}</td>
                  <td className="p-2">{new Date(b.paid_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-2 text-right">{b.quantity}</td>
                  <td className="p-2 text-right font-semibold">{fmtBRL(b.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/50">
              <tr>
                <td className="p-2 font-bold" colSpan={3}>TOTAL EM BOLETOS</td>
                <td className="p-2 text-right font-bold">{fmtBRL(boletoTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {payment.note && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">Observação</p>
          <p>{payment.note}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-10 pt-12 text-center text-xs print-avoid-break">
        <div className="border-t pt-2">Assinatura — Fruta²</div>
        <div className="border-t pt-2">Assinatura — Fornecedor</div>
      </div>
    </div>
  );
}

/** Relatório de boletos pagos direto ao fornecedor */
export function BoletoReportDoc({ rows, periodLabel }: { rows: any[]; periodLabel: string }) {
  const total = rows.reduce((a, r) => a + Number(r.total), 0);
  return (
    <div className="text-sm">
      <DocHeader title="Relatório de Boletos Pagos" subtitle={periodLabel} />
      <table className="w-full border rounded">
        <thead className="bg-secondary text-secondary-foreground">
          <tr>
            <th className="text-left p-2">Produto</th>
            <th className="text-left p-2">Cliente</th>
            <th className="text-left p-2">Vencimento</th>
            <th className="text-left p-2">Pago em</th>
            <th className="text-right p-2">Qtd</th>
            <th className="text-right p-2">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">{r.product_name}</td>
              <td className="p-2">{r.customer_name ?? "—"}</td>
              <td className="p-2">{r.due_date ? new Date(r.due_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
              <td className="p-2">{new Date(r.paid_at).toLocaleDateString("pt-BR")}</td>
              <td className="p-2 text-right">{r.quantity}</td>
              <td className="p-2 text-right font-semibold">{fmtBRL(r.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/50">
          <tr>
            <td className="p-2 font-bold" colSpan={5}>TOTAL PAGO VIA BOLETO</td>
            <td className="p-2 text-right font-bold">{fmtBRL(total)}</td>
          </tr>
        </tfoot>
      </table>
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
