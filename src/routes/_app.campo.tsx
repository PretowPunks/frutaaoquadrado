import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Play, Square, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/campo")({
  head: () => ({
    meta: [
      { title: "Expediente do Vendedor — Fruta²" },
      { name: "description", content: "Inicie o expediente e registre sua rota de atendimento com privacidade." },
      { property: "og:title", content: "Expediente do Vendedor — Fruta²" },
      { property: "og:description", content: "Jornada com rota por GPS e rastreamento limitado ao expediente." },
    ],
  }),
  component: CampoPage,
});

const CONSENT_VERSION = "v1";
const MIN_INTERVAL_MS = 20000;

type Shift = { id: string; started_at: string; ended_at: string | null; start_city: string | null };

function CampoPage() {
  const { user, isAdmin } = useAuth();
  const [consent, setConsent] = useState<boolean | null>(null);
  const [accept, setAccept] = useState(false);
  const [shift, setShift] = useState<Shift | null>(null);
  const [points, setPoints] = useState(0);
  const [city, setCity] = useState("");

  const watchRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: c } = await supabase
        .from("privacy_consents")
        .select("id")
        .eq("user_id", user.id)
        .eq("version", CONSENT_VERSION)
        .maybeSingle();
      setConsent(!!c);

      const { data: s } = await supabase
        .from("work_shifts")
        .select("id, started_at, ended_at, start_city")
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setShift((s as Shift) ?? null);
    })();
  }, [user]);

  // Contagem de pontos da jornada atual
  useEffect(() => {
    if (!shift) return setPoints(0);
    supabase
      .from("shift_route_points")
      .select("id", { count: "exact", head: true })
      .eq("shift_id", shift.id)
      .then(({ count }) => setPoints(count ?? 0));
  }, [shift]);

  const stopWatch = useCallback(() => {
    if (watchRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  // Rastreio ativo SOMENTE enquanto há expediente aberto (LGPD)
  useEffect(() => {
    if (!shift || !consent) {
      stopWatch();
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Este dispositivo não fornece GPS.");
      return;
    }

    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastRef.current < MIN_INTERVAL_MS) return;
        lastRef.current = now;
        const { error } = await supabase.from("shift_route_points").insert({
          shift_id: shift.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        if (!error) setPoints((p) => p + 1);
      },
      (err) => toast.error(`GPS: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
    );

    return stopWatch;
  }, [shift, consent, stopWatch]);

  const acceptConsent = async () => {
    const { error } = await supabase.from("privacy_consents").insert({
      version: CONSENT_VERSION,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    if (error) return toast.error(error.message);
    setConsent(true);
    toast.success("Termo aceito. Você já pode iniciar o expediente.");
  };

  const startShift = async () => {
    const { data, error } = await supabase
      .from("work_shifts")
      .insert({ start_city: city.trim() || null })
      .select("id, started_at, ended_at, start_city")
      .single();
    if (error) return toast.error(error.message);
    lastRef.current = 0;
    setShift(data as Shift);
    toast.success("Expediente iniciado — rota sendo registrada.");
  };

  const endShift = async () => {
    if (!shift) return;
    stopWatch();
    const { error } = await supabase
      .from("work_shifts")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", shift.id);
    if (error) return toast.error(error.message);
    setShift(null);
    toast.success("Expediente encerrado — rastreamento interrompido.");
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-10">
      <div>
        <h2 className="text-2xl font-bold">Meu Expediente</h2>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Jornada e venda rápida da matriz — as vendas saem do estoque da matriz."
            : "Jornada de atendimento com registro de rota por GPS."}
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <span className="font-semibold">Jornada</span>
          </div>
          {shift ? (
            <Badge>Em expediente</Badge>
          ) : (
            <Badge variant="secondary">Fora de expediente</Badge>
          )}
        </div>

        {shift ? (
          <>
            <p className="text-sm text-muted-foreground">
              Início: <strong className="text-foreground">{new Date(shift.started_at).toLocaleString("pt-BR")}</strong>
              {shift.start_city ? ` · ${shift.start_city}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              Pontos de rota gravados: <strong className="text-foreground">{points}</strong>
            </p>
            <Button variant="destructive" className="w-full h-12 text-base" onClick={endShift}>
              <Square className="h-5 w-5 mr-2" /> Encerrar Expediente
            </Button>
          </>
        ) : (
          <>
            <div>
              <Label>Município inicial (opcional)</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Feira de Santana" />
            </div>
            <Button className="w-full h-12 text-base" onClick={startShift} disabled={!consent}>
              <Play className="h-5 w-5 mr-2" /> Iniciar Expediente
            </Button>
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
              A localização é registrada apenas entre o início e o encerramento do expediente.
            </p>
          </>
        )}
      </Card>

      <Dialog open={consent === false}>
        <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Termo de Privacidade (LGPD)</DialogTitle>
            <DialogDescription>Leia e aceite para usar o painel de rua.</DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-2 max-h-64 overflow-auto text-muted-foreground">
            <p>
              A Fruta² coleta sua localização geográfica <strong>exclusivamente durante o expediente de trabalho</strong>,
              com a finalidade de registrar a rota de atendimento entre os municípios e permitir auditoria das visitas.
            </p>
            <p>
              O rastreamento começa quando você clica em <strong>Iniciar Expediente</strong> e é{" "}
              <strong>interrompido imediatamente</strong> ao clicar em <strong>Encerrar Expediente</strong>. Fora desse
              período nenhum dado de localização é coletado.
            </p>
            <p>
              Os dados são armazenados de forma segura, acessíveis apenas a você e à administração da empresa, e podem
              ser solicitados para consulta ou exclusão a qualquer momento, conforme a Lei nº 13.709/2018 (LGPD).
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={accept} onCheckedChange={(v) => setAccept(v === true)} />
            <span>Li e concordo com a coleta de localização durante o expediente.</span>
          </label>
          <DialogFooter>
            <Button disabled={!accept} onClick={acceptConsent}>Aceitar e continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
