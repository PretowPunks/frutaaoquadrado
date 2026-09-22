import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { supabase } from "@/lib/mock-client";
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
      {
        name: "description",
        content: "Audite no mapa a rota percorrida por cada vendedor durante o expediente.",
      },
      { property: "og:title", content: "Mapa de Deslocamento — Fruta²" },
      {
        property: "og:description",
        content: "Rotas por GPS registradas apenas durante a jornada de trabalho.",
      },
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

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return localDateKey(d);
}

function validDate(value: string | null | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value);
}

function formatDateTime(value: string | null | undefined) {
  const date = validDate(value);
  return date ? date.toLocaleString("pt-BR") : "Data não disponível";
}

function formatTime(value: string | null | undefined) {
  const date = validDate(value);
  return date ? date.toLocaleTimeString("pt-BR") : "Horário não disponível";
}

function RotasPage() {
  const { isAdmin } = useAuth();
  const [from, setFrom] = useState(todayISO(-7));
  const [to, setTo] = useState(todayISO());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [tracks, setTracks] = useState<Track[]>([]);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const { data: sh } = await supabase
      .from("work_shifts")
      .select("id, user_id, started_at, ended_at, start_city")
      .order("started_at", { ascending: false });
    const list = ((sh ?? []) as Shift[]).filter((shift) => {
      const startedAt = validDate(shift.started_at);
      if (!startedAt) return false;
      const day = localDateKey(startedAt);
      return day >= from && day <= to;
    });
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
        ids.map((id) => {
          const s = shifts.find((x) => x.id === id);
          const shiftIndex = shifts.findIndex((shift) => shift.id === id);
          const label = `${names[s?.user_id ?? ""] ?? "Vendedor"} — ${
            s ? (validDate(s.started_at)?.toLocaleDateString("pt-BR") ?? "Data não disponível") : ""
          }`;
          return {
            id,
            label,
            color: COLORS[Math.max(shiftIndex, 0) % COLORS.length] ?? COLORS[0] ?? "currentColor",
            points: grouped[id] ?? [],
          };
        }),
      );
    })();
  }, [picked, shifts, names]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    const selecting = !next.has(id);
    selecting ? next.add(id) : next.delete(id);
    setPicked(next);
    if (selecting && window.matchMedia("(max-width: 1023px)").matches) {
      window.setTimeout(
        () => mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        80,
      );
    }
  };

  const trackById = new Map(tracks.map((track) => [track.id, track]));

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
        <Card className="space-y-2 p-4 lg:col-span-1 lg:max-h-[65vh] lg:overflow-y-auto">
          <div className="flex items-center gap-2 mb-1">
            <MapPinned className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Jornadas</span>
          </div>
          {shifts.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma jornada no período.</p>
          )}
          {shifts.map((s, index) => {
            const selectedTrack = trackById.get(s.id);
            return (
              <label
                key={s.id}
                className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-muted/50"
              >
                <Checkbox checked={picked.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                <span
                  aria-hidden="true"
                  className={`mt-1 h-3 w-3 shrink-0 rounded-full border ${picked.has(s.id) ? "opacity-100" : "opacity-25"}`}
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <div className="text-sm">
                  <p className="font-medium">{names[s.user_id] ?? "Vendedor"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(s.started_at)}
                  {s.ended_at ? ` → ${formatTime(s.ended_at)}` : ""}
                </p>
                {s.start_city && <p className="text-xs text-muted-foreground">{s.start_city}</p>}
                  {!s.ended_at && <Badge className="mt-1">Em expediente</Badge>}
                  {selectedTrack?.points.length === 0 && (
                    <p className="mt-1 text-xs font-medium text-destructive">Sem pontos de GPS</p>
                  )}
                </div>
              </label>
            );
          })}
        </Card>

        <div ref={mapSectionRef} className="scroll-mt-4 lg:col-span-2">
          <ClientOnly
            fallback={
              <Card className="h-[65vh] flex items-center justify-center text-muted-foreground">
                Carregando mapa...
              </Card>
            }
          >
            <Suspense
              fallback={
                <Card className="h-[65vh] flex items-center justify-center text-muted-foreground">
                  Carregando mapa...
                </Card>
              }
            >
              <RouteMap tracks={tracks} />
            </Suspense>
          </ClientOnly>
          <p className="text-xs text-muted-foreground mt-2">
            {tracks.reduce((a, t) => a + t.points.length, 0)} pontos exibidos · mapa © OpenStreetMap
          </p>
          {tracks.length > 0 && tracks.every((track) => track.points.length === 0) && (
            <p className="mt-2 text-sm font-medium text-destructive">Sem pontos de GPS</p>
          )}
        </div>
      </div>
    </div>
  );
}
