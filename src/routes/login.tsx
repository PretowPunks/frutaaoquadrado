import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import logoAsset from "@/assets/fruta2-logo.png.asset.json";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Falha no login: " + result.error.message);
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary to-background p-4">
      <Card className="p-8 w-full max-w-md space-y-6">
        <div className="space-y-3 text-center">
          <img src={logoAsset.url} alt="Fruta² — muito mais polpa" className="mx-auto h-auto w-64 max-w-full" />
          <h1 className="text-xl font-bold text-foreground">Controle de Estoque</h1>
          <p className="text-muted-foreground">Entre para gerenciar seu negócio</p>
        </div>
        <Button onClick={handleGoogle} disabled={busy} className="w-full" size="lg">
          {busy ? "Entrando..." : "Entrar com Google"}
        </Button>
      </Card>
    </div>
  );
}