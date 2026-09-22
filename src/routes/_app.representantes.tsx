import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Clock, Pencil, Plus, Search, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtBRL } from "@/lib/format";
import { useSort, SortHeader } from "@/hooks/use-sort";

export const Route = createFileRoute("/_app/representantes")({
  head: () => ({
    meta: [
      { title: "Representantes — Fruta²" },
      { name: "description", content: "Cadastros, cidades e desempenho dos representantes Fruta²." },
      { property: "og:title", content: "Representantes — Fruta²" },
      { property: "og:description", content: "Gerencie representantes e acompanhe o desempenho comercial por período." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RepresentantesPage,
});

type RepStatus = "active" | "inactive" | "pending";
type Invite = {
  id: string;
  email: string;
  name: string | null;
  accepted_at: string | null;
  accepted_user_id: string | null;
  created_at: string;
  cities: string[];
  status?: "active" | "inactive";
};
type PerformanceRow = Invite & { repStatus: RepStatus; hours: number; itemsSold: number; grossSales: number };

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;
const parseCities = (value: string) => Array.from(new Set(value.split(",").map((city) => city.trim()).filter(Boolean)));
const repStatus = (invite: Invite): RepStatus => !invite.accepted_at ? "pending" : invite.status === "inactive" ? "inactive" : "active";
const statusLabel: Record<RepStatus, string> = { active: "Ativo", inactive: "Inativo", pending: "Pendente" };

function RepresentantesPage() {
  const { isAdmin, user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [performance, setPerformance] = useState<PerformanceRow[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [citiesText, setCitiesText] = useState("");
  const [editing, setEditing] = useState<Invite | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState(monthStart());
  const [toDate, setToDate] = useState(today());
  const [searched, setSearched] = useState(false);

  const loadInvites = async () => {
    const { data, error } = await supabase.from("rep_invites").select("*").order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setInvites((data ?? []) as Invite[]);
  };

  useEffect(() => { if (isAdmin) void loadInvites(); }, [isAdmin]);

  const searchPerformance = async () => {
    if (fromDate && toDate && fromDate > toDate) return toast.error("A data inicial deve ser anterior à data final");
    const [{ data: sales }, { data: shifts }] = await Promise.all([
      supabase.from("sales").select("owner_id, quantity, unit_sale_price, created_at"),
      supabase.from("work_shifts").select("user_id, started_at, ended_at"),
    ]);
    const start = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const end = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    const inPeriod = (value: unknown) => {
      const time = Date.parse(String(value ?? ""));
      return Number.isFinite(time) && time >= start && time <= end;
    };
    const byRep = new Map<string, { hours: number; itemsSold: number; grossSales: number }>();
    for (const sale of (sales ?? []) as Array<Record<string, any>>) {
      if (!sale.owner_id || !inPeriod(sale.created_at)) continue;
      const current = byRep.get(sale.owner_id) ?? { hours: 0, itemsSold: 0, grossSales: 0 };
      current.itemsSold += Number(sale.quantity);
      current.grossSales += Number(sale.quantity) * Number(sale.unit_sale_price);
      byRep.set(sale.owner_id, current);
    }
    for (const shift of (shifts ?? []) as Array<Record<string, any>>) {
      if (!shift.user_id || !inPeriod(shift.started_at)) continue;
      const started = Date.parse(shift.started_at);
      const ended = shift.ended_at ? Date.parse(shift.ended_at) : Date.now();
      if (!Number.isFinite(started) || !Number.isFinite(ended)) continue;
      const current = byRep.get(shift.user_id) ?? { hours: 0, itemsSold: 0, grossSales: 0 };
      current.hours += Math.max(0, ended - started) / 3_600_000;
      byRep.set(shift.user_id, current);
    }
    setPerformance(invites.map((invite) => ({ ...invite, repStatus: repStatus(invite), ...(invite.accepted_user_id ? byRep.get(invite.accepted_user_id) : undefined), hours: invite.accepted_user_id ? byRep.get(invite.accepted_user_id)?.hours ?? 0 : 0, itemsSold: invite.accepted_user_id ? byRep.get(invite.accepted_user_id)?.itemsSold ?? 0 : 0, grossSales: invite.accepted_user_id ? byRep.get(invite.accepted_user_id)?.grossSales ?? 0 : 0 })));
    setSearched(true);
  };

  const invite = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const cities = parseCities(citiesText);
    if (!normalizedEmail.includes("@")) return toast.error("Informe um e-mail válido");
    if (!cities.length) return toast.error("Informe ao menos uma cidade de atuação");
    const { error } = await supabase.from("rep_invites").insert({ email: normalizedEmail, name: name.trim() || null, cities, status: "active", invited_by: user?.id ?? null });
    if (error) return toast.error(error.message);
    toast.success("Representante convidado. Ele já pode entrar com o Google.");
    setEmail(""); setName(""); setCitiesText(""); setOpen(false); await loadInvites();
  };

  const beginEdit = (invite: Invite) => {
    setEditing(invite); setEditName(invite.name ?? ""); setEditEmail(invite.email); setEditStatus(invite.status === "inactive" ? "inactive" : "active"); setCitiesText(invite.cities.join(", "));
  };

  const saveRepresentative = async () => {
    if (!editing) return;
    const normalizedEmail = editEmail.trim().toLowerCase();
    const cities = parseCities(citiesText);
    if (!normalizedEmail.includes("@")) return toast.error("Informe um e-mail válido");
    if (!cities.length) return toast.error("Informe ao menos uma cidade de atuação");
    const { error } = await supabase.from("rep_invites").update({ name: editName.trim() || null, email: normalizedEmail, status: editStatus, cities }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Dados do representante atualizados");
    setEditing(null); setCitiesText(""); await loadInvites(); setSearched(false);
  };

  const remove = async (invite: Invite) => {
    if (!confirm(`Remover o convite de ${invite.email}? Os dados já lançados continuam no sistema.`)) return;
    const { error } = await supabase.from("rep_invites").delete().eq("id", invite.id);
    if (error) return toast.error(error.message);
    toast.success("Convite removido"); await loadInvites(); setSearched(false);
  };

  const filteredInvites = invites.filter((invite) => {
    const term = q.toLocaleLowerCase("pt-BR").trim();
    return !term || [invite.name ?? "", invite.email, invite.cities.join(" "), statusLabel[repStatus(invite)]].some((value) => value.toLocaleLowerCase("pt-BR").includes(term));
  });

  const sortedInvites = useSort(filteredInvites, { name: (item) => item.name ?? item.email, email: (item) => item.email, status: (item) => statusLabel[repStatus(item)], cities: (item) => item.cities.join(", ") }, { key: "name", dir: "asc" });
  const sortedPerformance = useSort(performance, { name: (item) => item.name ?? item.email, email: (item) => item.email, cities: (item) => item.cities.join(", "), status: (item) => statusLabel[item.repStatus], hours: (item) => item.hours, items: (item) => item.itemsSold, gross: (item) => item.grossSales }, { key: "gross", dir: "desc" });
  const counts = useMemo(() => ({ active: invites.filter((item) => repStatus(item) === "active").length, inactive: invites.filter((item) => repStatus(item) === "inactive").length, pending: invites.filter((item) => repStatus(item) === "pending").length }), [invites]);

  if (!isAdmin) return <Card className="p-6 text-muted-foreground">Apenas a matriz pode gerenciar representantes.</Card>;

  return <div className="space-y-7">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-bold">Representantes</h2><p className="text-sm text-muted-foreground">Cadastros, territórios e desempenho da equipe.</p></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Convidar representante</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Convidar representante</DialogTitle></DialogHeader><RepresentativeFields name={name} setName={setName} email={email} setEmail={setEmail} cities={citiesText} setCities={setCitiesText} /><DialogFooter><Button onClick={invite}>Convidar</Button></DialogFooter></DialogContent></Dialog></div>

    <div className="grid gap-4 sm:grid-cols-3"><Summary label="Representantes ativos" value={counts.active} /><Summary label="Representantes inativos" value={counts.inactive} /><Summary label="Convites pendentes" value={counts.pending} /></div>

    <section className="space-y-3"><div><h3 className="font-semibold">Cadastros</h3><p className="text-xs text-muted-foreground">Edite dados, situação e cidades atribuídas.</p></div><div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar em todos os campos..." value={q} onChange={(event) => setQ(event.target.value)} /></div><Card className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-secondary text-secondary-foreground"><tr><Header label="Nome" sortKey="name" sort={sortedInvites} /><Header label="E-mail" sortKey="email" sort={sortedInvites} /><Header label="Situação" sortKey="status" sort={sortedInvites} /><Header label="Cidades" sortKey="cities" sort={sortedInvites} /><th className="p-3 text-right">Ações</th></tr></thead><tbody>{sortedInvites.sorted.length ? sortedInvites.sorted.map((invite) => <tr key={invite.id} className="border-t"><td className="p-3 font-medium">{invite.name || "—"}</td><td className="p-3">{invite.email}</td><td className="p-3"><StatusBadge status={repStatus(invite)} /></td><td className="p-3">{invite.cities.join(", ") || "Não definidas"}</td><td className="whitespace-nowrap p-3 text-right"><Button size="icon" variant="ghost" onClick={() => beginEdit(invite)} aria-label={`Editar ${invite.name ?? invite.email}`}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => remove(invite)} aria-label={`Remover ${invite.name ?? invite.email}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></td></tr>) : <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum representante encontrado.</td></tr>}</tbody></table></div></Card></section>

    <section className="space-y-3"><div><h3 className="font-semibold">Desempenho</h3><p className="text-xs text-muted-foreground">Resultados de vendas e expediente no período selecionado.</p></div><Card className="space-y-4 p-5"><div className="flex items-center gap-2"><CalendarRange className="h-5 w-5 text-primary" /><span className="font-semibold">Filtrar por data</span></div><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><div><Label>De</Label><Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></div><div><Label>Até</Label><Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div><div className="flex items-end"><Button className="w-full sm:w-auto" onClick={searchPerformance}><Search className="mr-2 h-4 w-4" />Buscar</Button></div></div></Card><Card className="overflow-hidden p-0">{!searched ? <div className="p-10 text-center text-sm text-muted-foreground">Selecione o período e clique em Buscar para carregar o desempenho.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-secondary text-secondary-foreground"><tr><Header label="Nome" sortKey="name" sort={sortedPerformance} /><Header label="E-mail" sortKey="email" sort={sortedPerformance} /><Header label="Cidades" sortKey="cities" sort={sortedPerformance} /><Header label="Status" sortKey="status" sort={sortedPerformance} /><Header label="Horas Trabalhadas" sortKey="hours" sort={sortedPerformance} right /><Header label="Qtd. Itens Vendidos" sortKey="items" sort={sortedPerformance} right /><Header label="Valor Bruto Vendido" sortKey="gross" sort={sortedPerformance} right /></tr></thead><tbody>{sortedPerformance.sorted.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-medium">{item.name || "—"}</td><td className="p-3">{item.email}</td><td className="p-3">{item.cities.join(", ") || "—"}</td><td className="p-3"><StatusBadge status={item.repStatus} /></td><td className="p-3 text-right">{item.hours.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h</td><td className="p-3 text-right">{item.itemsSold}</td><td className="p-3 text-right font-semibold">{fmtBRL(item.grossSales)}</td></tr>)}</tbody></table></div>}</Card></section>

    <Dialog open={Boolean(editing)} onOpenChange={(next) => { if (!next) setEditing(null); }}><DialogContent><DialogHeader><DialogTitle>Editar representante</DialogTitle></DialogHeader><RepresentativeFields name={editName} setName={setEditName} email={editEmail} setEmail={setEditEmail} cities={citiesText} setCities={setCitiesText} status={editStatus} setStatus={setEditStatus} /><DialogFooter><Button onClick={saveRepresentative}>Salvar alterações</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function RepresentativeFields({ name, setName, email, setEmail, cities, setCities, status, setStatus }: { name: string; setName: (value: string) => void; email: string; setEmail: (value: string) => void; cities: string; setCities: (value: string) => void; status?: "active" | "inactive"; setStatus?: (value: "active" | "inactive") => void }) {
  return <div className="space-y-3"><div><Label>Nome</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div><div><Label>E-mail da conta Google</Label><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@gmail.com" /></div>{status && setStatus && <div><Label>Status</Label><Select value={status} onValueChange={(value) => setStatus(value as "active" | "inactive")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="inactive">Inativo</SelectItem></SelectContent></Select></div>}<div><Label>Cidades de atuação</Label><Input value={cities} onChange={(event) => setCities(event.target.value)} placeholder="Feira de Santana, Serrinha" /><p className="mt-1 text-xs text-muted-foreground">Separe várias cidades por vírgula.</p></div></div>;
}
function Summary({ label, value }: { label: string; value: number }) { return <Card className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></Card>; }
function StatusBadge({ status }: { status: RepStatus }) { const Icon = status === "active" ? UserCheck : status === "inactive" ? UserX : Clock; return <Badge variant={status === "active" ? "default" : status === "inactive" ? "destructive" : "secondary"}><Icon className="mr-1 h-3 w-3" />{statusLabel[status]}</Badge>; }
function Header<T>({ label, sortKey, sort, right = false }: { label: string; sortKey: string; sort: ReturnType<typeof useSort<T>>; right?: boolean }) { return <th className={`p-3 ${right ? "text-right" : "text-left"}`}><SortHeader label={label} sortKey={sortKey} currentKey={sort.sortKey} dir={sort.sortDir} onToggle={sort.toggle} className={right ? "justify-end" : ""} /></th>; }
