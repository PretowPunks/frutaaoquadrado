import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import logoAsset from "@/assets/fruta2-logo.png.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Fruta²" },
      { name: "description", content: "Acesse o sistema de gestão da Fruta²." },
      { property: "og:title", content: "Entrar — Fruta²" },
      { property: "og:description", content: "Acesse o sistema de gestão da Fruta²." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading, roleLoading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !roleLoading && session) navigate({ to: "/", replace: true });
  }, [session, loading, roleLoading, navigate]);

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
    // The auth listener validates the session and redirects only after the role is ready.
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary to-background p-4">
      <Card className="p-8 w-full max-w-md space-y-6">
        <div className="space-y-3 text-center">
          <img
            src={logoAsset.url}
            alt="Fruta² — muito mais polpa"
            className="mx-auto h-auto w-64 max-w-full"
          />
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
