import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/mock-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarPlus, Copy, FileText, Plus, Printer, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";
import { useSort, SortHeader } from "@/hooks/use-sort";
import { useScope } from "@/hooks/use-scope";
import { useAuth } from "@/hooks/use-auth";
import { PrintPortal } from "@/components/print-portal";
import { OrderCardDoc } from "@/components/print-docs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  customerAddress,
  emptyCustomerForm,
  maskDocument,
  maskPhone,
  normalizeCity,
  validateCustomer,
  type Customer,
  type CustomerForm,
} from "@/lib/customer";

export const Route = createFileRoute("/_app/clientes")({ component: ClientesPage });

type Product = {
  id: string;
  name: string;
  sale_price: number;
  cost_price: number;
  stock_quantity: number;
};
type Profile = { id: string; full_name: string | null; email: string | null };
type OrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
};

function ClientesPage() {
  const { ownerId, isViewingRep, viewingRepLabel } = useScope();
  const { isAdmin, user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [allowedCities, setAllowedCities] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyCustomerForm);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reportOpen, setReportOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const load = async () => {
    let customerQuery = supabase.from("customers").select("*").order("name");
    if (!isAdmin || isViewingRep) customerQuery = customerQuery.eq("owner_id", ownerId);
    const [{ data: customerRows, error }, { data: productRows }] = await Promise.all([
      customerQuery,
      supabase
        .from("products")
        .select("id, name, sale_price, cost_price, stock_quantity")
        .is("owner_id", null)
        .order("name"),
    ]);
    if (error) toast.error(error.message);
    setCustomers((customerRows ?? []) as Customer[]);
    setProducts((productRows ?? []) as Product[]);

    if (isAdmin) {
      const ownerIds = Array.from(
        new Set(
          (customerRows ?? []).map((customer: Customer) => customer.owner_id).filter(Boolean),
        ),
      ) as string[];
      if (ownerIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ownerIds);
        setProfiles(
          Object.fromEntries(((data ?? []) as Profile[]).map((profile) => [profile.id, profile])),
        );
      } else setProfiles({});
    } else if (user) {
      const { data } = await supabase
        .from("rep_invites")
        .select("cities")
        .eq("accepted_user_id", user.id)
        .maybeSingle();
      setAllowedCities(data?.cities ?? []);
    }
  };

  useEffect(() => {
    if (!ownerId) return;
    setSelected(null);
    void load();
  }, [ownerId, isAdmin, isViewingRep]);

  useEffect(() => {
    if (!selected) {
      setHistory([]);
      return;
    }
    setPicked(new Set());
    let query = supabase
      .from("sales")
      .select("*, products(name)")
      .eq("customer_id", selected.id)
      .order("created_at", { ascending: false });
    if (!isAdmin) query = query.eq("owner_id", ownerId);
    query.then(({ data }) => setHistory(data ?? []));
  }, [selected, ownerId, isAdmin]);

  const updateForm = (key: keyof CustomerForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const create = async () => {
    if (isViewingRep) return toast.error("Você está apenas consultando os dados do representante.");
    const validationError = validateCustomer(form);
    if (validationError) return toast.error(validationError);
    if (
      !isAdmin &&
      !allowedCities.some((city) => normalizeCity(city) === normalizeCity(form.city))
    ) {
      return toast.error("Escolha uma das cidades atribuídas pela Matriz");
    }
    const address = `${form.street.trim()}, ${form.addressNumber.trim()} — ${form.neighborhood.trim()}, ${form.city.trim()}`;
    const { error } = await supabase.from("customers").insert({
      name: form.name.trim(),
      phone: form.phone,
      document_number: form.documentNumber,
      street: form.street.trim(),
      address_number: form.addressNumber.trim(),
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      address,
      owner_id: ownerId,
    });
    if (error) return toast.error(error.message);
    toast.success("Cliente cadastrado");
    setForm(emptyCustomerForm);
    setOpen(false);
    void load();
  };

  const addOrderItem = () => {
    const product = products.find((item) => item.id === productId);
    const parsedQuantity = Number(quantity);
    const parsedPrice = Number(unitPrice);
    if (!product) return toast.error("Selecione um produto");
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1)
      return toast.error("Informe uma quantidade válida");
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0)
      return toast.error("Informe um preço válido");

    setOrderItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + parsedQuantity, unitPrice: parsedPrice }
            : item,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          quantity: parsedQuantity,
          unitPrice: parsedPrice,
          unitCost: Number(product.cost_price),
        },
      ];
    });
    setProductId("");
    setQuantity("1");
    setUnitPrice("");
  };

  const createScheduledOrder = async () => {
    if (!selected) return toast.error("Selecione um cliente");
    if (orderItems.length === 0) return toast.error("Adicione ao menos um produto ao pedido");
    if (!deliveryDate) return toast.error("Informe a data de entrega");
    const orderId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `pedido-${Date.now()}`;
    const orderTotal = orderItems.reduce(
      (total, item) => total + item.quantity * item.unitPrice,
      0,
    );
    const rows = orderItems.map((item) => ({
      order_id: orderId,
      order_total: orderTotal,
      order_status: "pending",
      product_id: item.productId,
      customer_id: selected.id,
      quantity: item.quantity,
      unit_sale_price: item.unitPrice,
      unit_cost: item.unitCost,
      status: "scheduled",
      payment_method: "direct",
      delivery_date: deliveryDate,
      created_by: user?.id ?? null,
      owner_id: selected.owner_id ?? user?.id ?? null,
    }));
    const { error } = await supabase.from("sales").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Pedido com ${orderItems.length} item(ns) enviado para a Matriz`);
    setProductId("");
    setQuantity("1");
    setUnitPrice("");
    setDeliveryDate("");
    setOrderItems([]);
    setOrderOpen(false);
    setSelected({ ...selected });
  };

  const selectProduct = (id: string) => {
    setProductId(id);
    const product = products.find((item) => item.id === id);
    if (product) setUnitPrice(String(product.sale_price));
  };

  const orderTotal = orderItems.reduce((total, item) => total + item.quantity * item.unitPrice, 0);

  const removeOrderItem = (productIdToRemove: string) =>
    setOrderItems((current) => current.filter((item) => item.productId !== productIdToRemove));

  const remove = async (id: string) => {
    if (isViewingRep) return toast.error("Você está apenas consultando os dados do representante.");
    if (!confirm("Remover cliente?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selected?.id === id) setSelected(null);
    void load();
  };

  const histSort = useSort(
    history,
    {
      created_at: (item) => new Date(item.created_at).getTime(),
      product: (item) => item.products?.name ?? "",
      quantity: (item) => item.quantity,
      total: (item) => Number(item.unit_sale_price) * item.quantity,
      status: (item) => item.status,
    },
    { key: "created_at", dir: "desc" },
  );

  const pickedSales = history.filter((item) => picked.has(item.id));
  const allPicked = history.length > 0 && picked.size === history.length;
  const togglePick = (id: string) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  };
  const toggleAll = () =>
    setPicked(allPicked ? new Set() : new Set(history.map((item) => item.id)));

  const orderSituation = (item: any) =>
    item.order_status === "delivered"
      ? "Entregue"
      : item.order_status === "scheduled"
        ? "Agendado"
        : "Pendente";

  const statusLabel = (item: any) =>
    item.status === "scheduled" || item.order_status
      ? `${orderSituation(item)}${item.delivery_date ? ` — ${new Date(`${item.delivery_date}T00:00:00`).toLocaleDateString("pt-BR")}` : ""}`
      : item.payment_method === "boleto"
        ? `Boleto${item.boleto_due_date ? ` — vence ${new Date(`${item.boleto_due_date}T00:00:00`).toLocaleDateString("pt-BR")}` : ""}`
        : item.status === "paid"
          ? "Pago"
          : "A pagar";

  const reportItems = pickedSales.map((item) => ({
    product_name: item.products?.name ?? "—",
    quantity: item.quantity,
    unit_price: Number(item.unit_sale_price),
    total: Number(item.unit_sale_price) * item.quantity,
  }));
  const reportTotal = reportItems.reduce((total, item) => total + item.total, 0);
  const reportStatus = Array.from(new Set(pickedSales.map(statusLabel))).join(" · ");

  const copyReport = () => {
    if (!selected) return;
    const lines = [
      "*Fruta² — Pedido*",
      `Cliente: ${selected.name}`,
      `Data: ${new Date().toLocaleDateString("pt-BR")}`,
      "",
      ...reportItems.map(
        (item) =>
          `• ${item.product_name} — ${item.quantity} x ${fmtBRL(item.unit_price)} = ${fmtBRL(item.total)}`,
      ),
      "",
      `*Total: ${fmtBRL(reportTotal)}*`,
      reportStatus,
    ];
    void navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Pedido copiado");
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return customers;
    return customers.filter((customer) => {
      const representative = customer.owner_id ? profiles[customer.owner_id] : null;
      return [
        customer.name,
        customer.phone ?? "",
        customer.document_number ?? "",
        customerAddress(customer),
        customer.city ?? "",
        representative?.full_name ?? representative?.email ?? "Matriz",
      ].some((value) => String(value).toLowerCase().includes(term));
    });
  }, [customers, profiles, search]);

  const canCreate = !isViewingRep && (isAdmin || allowedCities.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Clientes</h2>
          {isViewingRep && (
            <p className="text-sm text-muted-foreground">Carteira de {viewingRepLabel}</p>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canCreate}>
              <Plus className="mr-2 h-4 w-4" /> Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nome do Cliente">
                <Input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  maxLength={120}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={form.phone}
                  onChange={(event) => updateForm("phone", maskPhone(event.target.value))}
                  inputMode="tel"
                  placeholder="(75) 99999-9999"
                />
              </Field>
              <Field label="CPF ou CNPJ">
                <Input
                  value={form.documentNumber}
                  onChange={(event) =>
                    updateForm("documentNumber", maskDocument(event.target.value))
                  }
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                />
              </Field>
              <Field label="Rua">
                <Input
                  value={form.street}
                  onChange={(event) => updateForm("street", event.target.value)}
                  maxLength={160}
                />
              </Field>
              <Field label="Número">
                <Input
                  value={form.addressNumber}
                  onChange={(event) => updateForm("addressNumber", event.target.value)}
                  maxLength={20}
                />
              </Field>
              <Field label="Bairro">
                <Input
                  value={form.neighborhood}
                  onChange={(event) => updateForm("neighborhood", event.target.value)}
                  maxLength={100}
                />
              </Field>
              <div className="sm:col-span-2">
                <Label>Cidade</Label>
                {!isAdmin && allowedCities.length > 0 ? (
                  <Select value={form.city} onValueChange={(value) => updateForm("city", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma cidade atribuída" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedCities.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.city}
                    onChange={(event) => updateForm("city", event.target.value)}
                    maxLength={100}
                  />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={create}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!isAdmin && allowedCities.length === 0 && (
        <Card className="border-destructive/40 p-4 text-sm text-muted-foreground">
          A Matriz precisa atribuir ao menos uma cidade ao seu perfil antes de você cadastrar
          clientes.
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-3 p-4 lg:col-span-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar cliente, cidade ou representante..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <ul className="max-h-[60vh] divide-y overflow-auto">
            {filtered.map((customer) => {
              const representative = customer.owner_id ? profiles[customer.owner_id] : null;
              return (
                <li
                  key={customer.id}
                  onClick={() => setSelected(customer)}
                  className={`cursor-pointer rounded p-3 hover:bg-muted/50 ${selected?.id === customer.id ? "bg-muted" : ""}`}
                >
                  <span className="font-medium">{customer.name}</span>
                  <p className="text-xs text-muted-foreground">
                    {customer.city || "Cidade não informada"}
                  </p>
                  {isAdmin && (
                    <p className="text-xs text-muted-foreground">
                      {representative?.full_name ?? representative?.email ?? "Matriz"}
                    </p>
                  )}
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">Nenhum cliente.</li>
            )}
          </ul>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {!selected ? (
            <Card className="p-10 text-center text-muted-foreground">
              Selecione um cliente para ver os detalhes
            </Card>
          ) : (
            <>
              <Card className="space-y-2 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold">{selected.name}</h3>
                    {isAdmin && (
                      <p className="text-xs text-muted-foreground">
                        Responsável:{" "}
                        {selected.owner_id
                          ? (profiles[selected.owner_id]?.full_name ??
                            profiles[selected.owner_id]?.email ??
                            "Representante")
                          : "Matriz"}
                      </p>
                    )}
                  </div>
                  {!isViewingRep && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(selected.id)}
                      aria-label={`Remover ${selected.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-sm">
                  <strong>CPF/CNPJ:</strong> {selected.document_number || "—"}
                </p>
                <p className="text-sm">
                  <strong>Telefone:</strong> {selected.phone || "—"}
                </p>
                <p className="text-sm">
                  <strong>Endereço:</strong> {customerAddress(selected)}
                </p>
                {!isAdmin && (
                  <Button className="mt-3 w-full sm:w-auto" onClick={() => setOrderOpen(true)}>
                    <CalendarPlus className="mr-2 h-4 w-4" /> Registrar pedido agendado
                  </Button>
                )}
              </Card>

              <Card className="overflow-hidden p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                  <h4 className="font-semibold">Histórico de Pedidos e Compras</h4>
                  <div className="flex items-center gap-3">
                    {picked.size > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {picked.size} selecionado(s) ·{" "}
                        <strong className="text-foreground">{fmtBRL(reportTotal)}</strong>
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={picked.size === 0}
                      onClick={() => setReportOpen(true)}
                    >
                      <FileText className="mr-1 h-4 w-4" /> Gerar relatório
                    </Button>
                  </div>
                </div>
                {history.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    Nenhum pedido ou compra registrado.
                  </p>
                ) : (
                  <table className="w-full min-w-[680px] text-sm">
                    <thead className="bg-secondary text-secondary-foreground">
                      <tr>
                        <th className="w-10 p-3">
                          <Checkbox checked={allPicked} onCheckedChange={toggleAll} />
                        </th>
                        <th className="p-3 text-left">
                          <SortHeader
                            label="Data"
                            sortKey="created_at"
                            currentKey={histSort.sortKey}
                            dir={histSort.sortDir}
                            onToggle={histSort.toggle}
                          />
                        </th>
                        <th className="p-3 text-left">
                          <SortHeader
                            label="Produto"
                            sortKey="product"
                            currentKey={histSort.sortKey}
                            dir={histSort.sortDir}
                            onToggle={histSort.toggle}
                          />
                        </th>
                        <th className="p-3 text-right">
                          <SortHeader
                            label="Qtd"
                            sortKey="quantity"
                            currentKey={histSort.sortKey}
                            dir={histSort.sortDir}
                            onToggle={histSort.toggle}
                          />
                        </th>
                        <th className="p-3 text-right">
                          <SortHeader
                            label="Total"
                            sortKey="total"
                            currentKey={histSort.sortKey}
                            dir={histSort.sortDir}
                            onToggle={histSort.toggle}
                          />
                        </th>
                        <th className="p-3 text-center">
                          <SortHeader
                            label="Status"
                            sortKey="status"
                            currentKey={histSort.sortKey}
                            dir={histSort.sortDir}
                            onToggle={histSort.toggle}
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {histSort.sorted.map((item) => (
                        <tr
                          key={item.id}
                          className={`border-t ${picked.has(item.id) ? "bg-muted/50" : ""}`}
                        >
                          <td className="p-3">
                            <Checkbox
                              checked={picked.has(item.id)}
                              onCheckedChange={() => togglePick(item.id)}
                            />
                          </td>
                          <td className="p-3">
                            {new Date(item.created_at).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="p-3">{item.products?.name}</td>
                          <td className="p-3 text-right">{item.quantity}</td>
                          <td className="p-3 text-right">
                            {fmtBRL(Number(item.unit_sale_price) * item.quantity)}
                          </td>
                          <td className="p-3 text-center">
                            <Badge
                              variant={
                                item.order_status === "delivered"
                                  ? "default"
                                  : item.order_status === "scheduled"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {item.order_status ? orderSituation(item) : statusLabel(item)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo pedido agendado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Produto">
              <Select value={productId} onValueChange={selectProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione no catálogo" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} · {product.stock_quantity} un.
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade">
                <Input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </Field>
              <Field label="Preço unitário">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                />
              </Field>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={addOrderItem}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar ao Pedido
            </Button>
            {orderItems.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-secondary text-secondary-foreground">
                    <tr>
                      <th className="p-3 text-left">Produto</th>
                      <th className="p-3 text-right">Quantidade</th>
                      <th className="p-3 text-right">Valor unitário</th>
                      <th className="p-3 text-right">Subtotal</th>
                      <th className="w-12 p-3">
                        <span className="sr-only">Remover</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item) => (
                      <tr key={item.productId} className="border-t">
                        <td className="p-3 font-medium">{item.productName}</td>
                        <td className="p-3 text-right">{item.quantity}</td>
                        <td className="p-3 text-right">{fmtBRL(item.unitPrice)}</td>
                        <td className="p-3 text-right font-medium">
                          {fmtBRL(item.quantity * item.unitPrice)}
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOrderItem(item.productId)}
                            aria-label={`Remover ${item.productName}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between border-y py-3 font-semibold">
              <span>Valor Total</span>
              <span className="text-lg">{fmtBRL(orderTotal)}</span>
            </div>
            <Field label="Data de entrega">
              <Input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={deliveryDate}
                onChange={(event) => setDeliveryDate(event.target.value)}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              O estoque será atualizado somente quando a Matriz concluir o pedido.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={createScheduledOrder}
              disabled={!selected || !deliveryDate || orderItems.length === 0}
            >
              Finalizar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pedido — conferência do cliente</DialogTitle>
          </DialogHeader>
          {reportItems.length > 0 && selected && (
            <>
              <div className="max-h-[65vh] overflow-auto">
                <OrderCardDoc
                  customer={{ name: selected.name, phone: selected.phone }}
                  createdAt={new Date().toISOString()}
                  items={reportItems}
                  status={reportStatus}
                />
              </div>
              <PrintPortal>
                <OrderCardDoc
                  customer={{ name: selected.name, phone: selected.phone }}
                  createdAt={new Date().toISOString()}
                  items={reportItems}
                  status={reportStatus}
                />
              </PrintPortal>
            </>
          )}
          <DialogFooter className="gap-2 print:hidden">
            <Button variant="outline" onClick={copyReport}>
              <Copy className="mr-2 h-4 w-4" /> Copiar texto
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
