import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPinned } from "lucide-react";
import type { Track } from "@/components/route-map";

const RouteMap = lazy(() => import("@/components/route-map"));

export const Route = createFileRoute("/_app/rotas")({
  head: () => ({
    meta: [
      { title: "Mapa de Deslocamento — Fruta²" },
      { name: "description", content: "Audite no mapa a rota percorrida por cada vendedor durante o expediente." },
      { property: "og:title", content: "Mapa de Deslocamento — Fruta²" },
      { property: "og:description", content: "Rotas por GPS registradas apenas durante a jornada de trabalho." },
    ],
  }),
  component: RotasPage,
});

const COLORS = ["#e11d48", "#0ea5e9", "#16a34a", "#f59e0b", "#7c3aed", "#0f766e"];

type Shift = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  start_city: string | null;
};

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function RotasPage() {
  const { isAdmin } = useAuth();
  const [from, setFrom] = useState(todayISO(-7));
  const [to, setTo] = useState(todayISO());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [tracks, setTracks] = useState<Track[]>([]);

  const load = useCallback(async () => {
    const { data: sh } = await supabase
      .from("work_shifts")
      .select("id, user_id, started_at, ended_at, start_city")
      .gte("started_at", `${from}T00:00:00`)
      .lte("started_at", `${to}T23:59:59`)
      .order("started_at", { ascending: false });
    const list = (sh ?? []) as Shift[];
    setShifts(list);
    setPicked(new Set(list.slice(0, 3).map((s) => s.id)));

    const { data: profs } = await supabase.from("profiles").select("id, email, full_name");
    const map: Record<string, string> = {};
    for (const p of (profs ?? []) as any[]) map[p.id] = p.full_name || p.email || p.id;
    setNames(map);
  }, [from, to]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  useEffect(() => {
    if (picked.size === 0) return setTracks([]);
    (async () => {
      const ids = [...picked];
      const { data } = await supabase
        .from("shift_route_points")
        .select("shift_id, lat, lng, recorded_at")
        .in("shift_id", ids)
        .order("recorded_at");
      const grouped: Record<string, [number, number][]> = {};
      for (const p of (data ?? []) as any[]) {
        (grouped[p.shift_id] ??= []).push([Number(p.lat), Number(p.lng)]);
      }
      setTracks(
        ids.map((id, i) => {
          const s = shifts.find((x) => x.id === id);
          const label = `${names[s?.user_id ?? ""] ?? "Vendedor"} — ${
            s ? new Date(s.started_at).toLocaleDateString("pt-BR") : ""
          }`;
          return { id, label, color: COLORS[i % COLORS.length]!, points: grouped[id] ?? [] };
        }),
      );
    })();
  }, [picked, shifts, names]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  };

  if (!isAdmin) {
    return <Card className="p-8 text-center text-muted-foreground">Área exclusiva da matriz.</Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Mapa de Deslocamento</h2>
        <p className="text-sm text-muted-foreground">
          Rotas registradas por GPS apenas durante o expediente dos vendedores.
        </p>
      </div>

      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div>
          <Label>De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <span className="text-sm text-muted-foreground ml-auto">
          {shifts.length} jornada(s) no período
        </span>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-4 space-y-2 lg:col-span-1 max-h-[65vh] overflow-auto">
          <div className="flex items-center gap-2 mb-1">
            <MapPinned className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Jornadas</span>
          </div>
          {shifts.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma jornada no período.</p>}
          {shifts.map((s) => (
            <label key={s.id} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
              <Checkbox checked={picked.has(s.id)} onCheckedChange={() => toggle(s.id)} />
              <div className="text-sm">
                <p className="font-medium">{names[s.user_id] ?? "Vendedor"}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(s.started_at).toLocaleString("pt-BR")}
                  {s.ended_at ? ` → ${new Date(s.ended_at).toLocaleTimeString("pt-BR")}` : ""}
                </p>
                {s.start_city && <p className="text-xs text-muted-foreground">{s.start_city}</p>}
                {!s.ended_at && <Badge className="mt-1">Em expediente</Badge>}
              </div>
            </label>
          ))}
        </Card>

        <div className="lg:col-span-2">
          <ClientOnly fallback={<Card className="h-[65vh] flex items-center justify-center text-muted-foreground">Carregando mapa...</Card>}>
            <Suspense fallback={<Card className="h-[65vh] flex items-center justify-center text-muted-foreground">Carregando mapa...</Card>}>
              <RouteMap tracks={tracks} />
            </Suspense>
          </ClientOnly>
          <p className="text-xs text-muted-foreground mt-2">
            {tracks.reduce((a, t) => a + t.points.length, 0)} pontos exibidos · mapa © OpenStreetMap
          </p>
        </div>
      </div>
    </div>
  );
}
