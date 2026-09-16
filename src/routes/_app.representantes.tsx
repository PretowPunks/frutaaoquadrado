import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
import { Plus, Trash2, Search, UserCheck, Clock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";
import { useSort, SortHeader } from "@/hooks/use-sort";

export const Route = createFileRoute("/_app/representantes")({ component: RepresentantesPage });

type Invite = {
  id: string;
  email: string;
  name: string | null;
  accepted_at: string | null;
  accepted_user_id: string | null;
  created_at: string;
  cities: string[];
};

type Row = Invite & { sold: number; cost: number; paid: number; due: number };

function RepresentantesPage() {
  const { isAdmin, user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [citiesText, setCitiesText] = useState("");
  const [editing, setEditing] = useState<Invite | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data: inv, error } = await supabase
      .from("rep_invites")
      .select("id, email, name, accepted_at, accepted_user_id, created_at, cities")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    const list = (inv ?? []) as Invite[];
    setInvites(list);

    const { data: sales } = await supabase
      .from("sales")
      .select("owner_id, quantity, unit_sale_price, unit_cost, payment_method, boleto_paid_at");
    const { data: pays } = await (supabase as any)
      .from("representative_profit_payments")
      .select("rep_user_id, profit_amount");

    const agg: Record<string, { sold: number; cost: number; paid: number }> = {};
    for (const s of (sales ?? []) as any[]) {
      const k = s.owner_id ?? "—";
      agg[k] = agg[k] ?? { sold: 0, cost: 0, paid: 0 };
      agg[k].sold += Number(s.quantity) * Number(s.unit_sale_price);
      if (s.payment_method === "boleto" && s.boleto_paid_at) {
        agg[k].cost += Number(s.quantity) * (Number(s.unit_sale_price) - Number(s.unit_cost));
      }
    }
    for (const p of (pays ?? []) as any[]) {
      const k = p.rep_user_id ?? "—";
      agg[k] = agg[k] ?? { sold: 0, cost: 0, paid: 0 };
      agg[k].paid += Number(p.profit_amount);
    }

    setRows(
      list.map((i) => {
        const a = (i.accepted_user_id && agg[i.accepted_user_id]) || { sold: 0, cost: 0, paid: 0 };
        return { ...i, sold: a.sold, cost: a.cost, paid: a.paid, due: a.cost - a.paid };
      }),
    );
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const invite = async () => {
    const e = email.trim().toLowerCase();
    if (!e.includes("@")) return toast.error("Informe um e-mail válido");
    const cities = Array.from(
      new Set(
        citiesText
          .split(",")
          .map((city) => city.trim())
          .filter(Boolean),
      ),
    );
    if (cities.length === 0) return toast.error("Informe ao menos uma cidade de atuação");
    const { error } = await supabase
      .from("rep_invites")
      .insert({ email: e, name: name.trim() || null, cities, invited_by: user?.id ?? null });
    if (error) return toast.error(error.message);
    toast.success("Representante convidado. Ele já pode entrar com o Google.");
    setEmail("");
    setName("");
    setCitiesText("");
    setOpen(false);
    load();
  };

  const saveCities = async () => {
    if (!editing) return;
    const cities = Array.from(
      new Set(
        citiesText
          .split(",")
          .map((city) => city.trim())
          .filter(Boolean),
      ),
    );
    if (cities.length === 0) return toast.error("Informe ao menos uma cidade de atuação");
    const { error } = await supabase.from("rep_invites").update({ cities }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Cidades de atuação atualizadas");
    setEditing(null);
    setCitiesText("");
    load();
  };

  const remove = async (row: Invite) => {
    if (
      !confirm(
        `Remover o convite de ${row.email}? Os dados já lançados por ele continuam no sistema.`,
      )
    )
      return;
    const { error } = await supabase.from("rep_invites").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Convite removido");
    load();
  };

  const filtered = rows.filter((r) => {
    const t = q.toLowerCase().trim();
    if (!t) return true;
    return [
      r.email,
      r.name ?? "",
      r.cities.join(" "),
      r.accepted_at ? "ativo" : "pendente",
      fmtBRL(r.due),
    ].some((v) => v.toLowerCase().includes(t));
  });

  const { sorted, sortKey, sortDir, toggle } = useSort(
    filtered,
    {
      name: (r) => r.name ?? r.email,
      email: (r) => r.email,
      status: (r) => (r.accepted_at ? "ativo" : "pendente"),
      cities: (r) => r.cities.join(", "),
      sold: (r) => r.sold,
      cost: (r) => r.cost,
      paid: (r) => r.paid,
      due: (r) => r.due,
    },
    { key: "name", dir: "asc" },
  );

  const totalDue = rows.reduce((a, r) => a + r.due, 0);

  if (!isAdmin) {
    return (
      <Card className="p-6 text-muted-foreground">
        Apenas a matriz pode gerenciar representantes.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Representantes</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Convidar representante
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar representante</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>E-mail da conta Google</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@gmail.com"
                />
              </div>
              <div>
                <Label>Nome (opcional)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Cidades de atuação</Label>
                <Input
                  value={citiesText}
                  onChange={(e) => setCitiesText(e.target.value)}
                  placeholder="Feira de Santana, Serrinha"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Separe várias cidades por vírgula.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Ao entrar com esse e-mail, o representante poderá consultar o catálogo, cumprir a
                jornada e atender clientes somente nas cidades atribuídas.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={invite}>Convidar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Representantes ativos</p>
          <p className="text-2xl font-bold">{invites.filter((i) => i.accepted_at).length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Convites pendentes</p>
          <p className="text-2xl font-bold">{invites.filter((i) => !i.accepted_at).length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total a receber dos representantes</p>
          <p className="text-2xl font-bold text-primary">{fmtBRL(totalDue)}</p>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar em todos os campos..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="text-left p-3">
                <SortHeader
                  label="Nome"
                  sortKey="name"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                />
              </th>
              <th className="text-left p-3">
                <SortHeader
                  label="E-mail"
                  sortKey="email"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                />
              </th>
              <th className="text-left p-3">
                <SortHeader
                  label="Situação"
                  sortKey="status"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                />
              </th>
              <th className="text-left p-3">
                <SortHeader
                  label="Cidades"
                  sortKey="cities"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                />
              </th>
              <th className="text-right p-3">
                <SortHeader
                  label="Vendas"
                  sortKey="sold"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                />
              </th>
              <th className="text-right p-3">
                <SortHeader
                  label="Custo (devido)"
                  sortKey="cost"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                />
              </th>
              <th className="text-right p-3">
                <SortHeader
                  label="Repassado"
                  sortKey="paid"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                />
              </th>
              <th className="text-right p-3">
                <SortHeader
                  label="Saldo a receber"
                  sortKey="due"
                  currentKey={sortKey}
                  dir={sortDir}
                  onToggle={toggle}
                />
              </th>
              <th className="text-right p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  Nenhum representante convidado ainda.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{r.name ?? "—"}</td>
                  <td className="p-3">{r.email}</td>
                  <td className="p-3">
                    {r.accepted_at ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                        <UserCheck className="h-3 w-3" /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        <Clock className="h-3 w-3" /> Pendente
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {r.cities.length > 0 ? r.cities.join(", ") : "Não definidas"}
                  </td>
                  <td className="p-3 text-right">{fmtBRL(r.sold)}</td>
                  <td className="p-3 text-right">{fmtBRL(r.cost)}</td>
                  <td className="p-3 text-right">{fmtBRL(r.paid)}</td>
                  <td
                    className={
                      "p-3 text-right font-semibold " + (r.due > 0 ? "text-destructive" : "")
                    }
                  >
                    {fmtBRL(r.due)}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(r);
                        setCitiesText(r.cities.join(", "));
                      }}
                      aria-label={`Editar cidades de ${r.name ?? r.email}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Dialog
        open={!!editing}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cidades de atuação</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Cidades</Label>
            <Input
              value={citiesText}
              onChange={(e) => setCitiesText(e.target.value)}
              placeholder="Feira de Santana, Serrinha"
            />
            <p className="mt-1 text-xs text-muted-foreground">Separe várias cidades por vírgula.</p>
          </div>
          <DialogFooter>
            <Button onClick={saveCities}>Salvar cidades</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
