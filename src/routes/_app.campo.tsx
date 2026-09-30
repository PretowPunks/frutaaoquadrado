import { createFileRoute } from "@tanstack/react-router";
import type {
  BackgroundGeolocationPlugin,
  CallbackError,
  Location as BackgroundLocation,
} from "@capacitor-community/background-geolocation";
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
  EXTERNAL_SUPABASE_URL,
  supabase,
} from "@/integrations/external-supabase/client";
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
      {
        name: "description",
        content: "Inicie o expediente e registre sua rota de atendimento com privacidade.",
      },
      { property: "og:title", content: "Expediente do Vendedor — Fruta²" },
      {
        property: "og:description",
        content: "Jornada com rota por GPS e rastreamento limitado ao expediente.",
      },
    ],
  }),
  component: CampoPage,
});

const CONSENT_VERSION = "v1";
const MIN_INTERVAL_MS = 45000;
const NATIVE_WATCHER_STORAGE_KEY = "fruta2_native_gps_watcher";
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

type Shift = { id: string; started_at: string; ended_at: string | null; start_city: string | null };

function formatDateTime(value: string | null | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) return "Data não disponível";
  return new Date(value).toLocaleString("pt-BR");
}

function CampoPage() {
  const { user, isAdmin } = useAuth();
  const [consent, setConsent] = useState<boolean | null>(null);
  const [accept, setAccept] = useState(false);
  const [shift, setShift] = useState<Shift | null>(null);
  const [points, setPoints] = useState(0);
  const [city, setCity] = useState("");

  const watchRef = useRef<number | null>(null);
  const nativeWatchRef = useRef<string | null>(null);
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

  const stopBrowserWatch = useCallback(() => {
    if (watchRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const stopAllTracking = useCallback(async () => {
    stopBrowserWatch();
    if (!Capacitor.isNativePlatform()) return;

    const watcherId =
      nativeWatchRef.current ?? window.localStorage.getItem(NATIVE_WATCHER_STORAGE_KEY);
    if (!watcherId) return;
    try {
      await BackgroundGeolocation.removeWatcher({ id: watcherId });
    } catch {
      // O serviço pode já ter sido finalizado pelo Android após reiniciar o app.
    }
    nativeWatchRef.current = null;
    window.localStorage.removeItem(NATIVE_WATCHER_STORAGE_KEY);
  }, [stopBrowserWatch]);

  const saveNativePoint = useCallback(
    async (shiftId: string, position: BackgroundLocation) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || !user) return;

      const response = await CapacitorHttp.post({
        url: `${EXTERNAL_SUPABASE_URL}/rest/v1/shift_route_points`,
        headers: {
          apikey: EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        data: {
          shift_id: shiftId,
          user_id: user.id,
          lat: position.latitude,
          lng: position.longitude,
          accuracy: position.accuracy,
          recorded_at: new Date(position.time ?? Date.now()).toISOString(),
        },
        connectTimeout: 20000,
        readTimeout: 20000,
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Falha ao salvar coordenada (${response.status}).`);
      }
      setPoints((value) => value + 1);
    },
    [user],
  );

  // Rastreio ativo SOMENTE enquanto há expediente aberto (LGPD)
  useEffect(() => {
    if (!shift || !consent) {
      void stopAllTracking();
      return;
    }

    if (Capacitor.isNativePlatform()) {
      let cancelled = false;
      void (async () => {
        const oldWatcherId = window.localStorage.getItem(NATIVE_WATCHER_STORAGE_KEY);
        if (oldWatcherId) {
          try {
            await BackgroundGeolocation.removeWatcher({ id: oldWatcherId });
          } catch {
            // Continua e recria o rastreador ligado ao expediente atual.
          }
          window.localStorage.removeItem(NATIVE_WATCHER_STORAGE_KEY);
        }

        const notificationPermission = await LocalNotifications.checkPermissions();
        if (notificationPermission.display === "prompt") {
          await LocalNotifications.requestPermissions();
        }

        const watcherId = await BackgroundGeolocation.addWatcher(
          {
            backgroundTitle: "Fruta² — expediente em andamento",
            backgroundMessage: "Registrando sua rota mesmo com a tela bloqueada.",
            requestPermissions: true,
            stale: false,
            distanceFilter: 15,
          },
          (position?: BackgroundLocation, error?: CallbackError) => {
            if (error) {
              console.error("Falha no GPS em segundo plano:", error);
              return;
            }
            if (position) {
              void saveNativePoint(shift.id, position).catch((saveError) => {
                console.error("Falha ao gravar coordenada em segundo plano:", saveError);
              });
            }
          },
        );

        if (cancelled) {
          await BackgroundGeolocation.removeWatcher({ id: watcherId });
          return;
        }
        nativeWatchRef.current = watcherId;
        window.localStorage.setItem(NATIVE_WATCHER_STORAGE_KEY, watcherId);
      })().catch((error) => {
        console.error("Não foi possível iniciar o GPS em segundo plano:", error);
        toast.error(
          "Autorize localização precisa e notificações para registrar a rota com a tela bloqueada.",
        );
      });

      return () => {
        cancelled = true;
      };
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

    return stopBrowserWatch;
  }, [shift, consent, saveNativePoint, stopAllTracking, stopBrowserWatch]);

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
    const startedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("work_shifts")
      .insert({ start_city: city.trim() || null, started_at: startedAt, ended_at: null })
      .select("id, started_at, ended_at, start_city")
      .single();
    if (error) return toast.error(error.message);
    lastRef.current = 0;
    setShift(data as Shift);
    toast.success("Expediente iniciado — rota sendo registrada.");
  };

  const endShift = async () => {
    if (!shift) return;
    const { error } = await supabase
      .from("work_shifts")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", shift.id);
    if (error) return toast.error(error.message);
    await stopAllTracking();
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
              Início:{" "}
              <strong className="text-foreground">{formatDateTime(shift.started_at)}</strong>
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
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex.: Feira de Santana"
              />
            </div>
            <Button className="w-full h-12 text-base" onClick={startShift} disabled={!consent}>
              <Play className="h-5 w-5 mr-2" /> Iniciar Expediente
            </Button>
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />A localização é registrada apenas
              entre o início e o encerramento do expediente.
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
              A Fruta² coleta sua localização geográfica{" "}
              <strong>exclusivamente durante o expediente de trabalho</strong>, com a finalidade de
              registrar a rota de atendimento entre os municípios e permitir auditoria das visitas.
            </p>
            <p>
              O rastreamento começa quando você clica em <strong>Iniciar Expediente</strong> e é{" "}
              <strong>interrompido imediatamente</strong> ao clicar em{" "}
              <strong>Encerrar Expediente</strong>. Fora desse período nenhum dado de localização é
              coletado.
            </p>
            <p>
              Os dados são armazenados de forma segura, acessíveis apenas a você e à administração
              da empresa, e podem ser solicitados para consulta ou exclusão a qualquer momento,
              conforme a Lei nº 13.709/2018 (LGPD).
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={accept} onCheckedChange={(v) => setAccept(v === true)} />
            <span>Li e concordo com a coleta de localização durante o expediente.</span>
          </label>
          <DialogFooter>
            <Button disabled={!accept} onClick={acceptConsent}>
              Aceitar e continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
