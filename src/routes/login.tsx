import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import logoAsset from "@/assets/fruta2-logo.png.asset.json";
import { resetMockData } from "@/lib/mock-client";

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
  const { session, loading, roleLoading, signInAs } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !roleLoading && session) navigate({ to: "/", replace: true });
  }, [session, loading, roleLoading, navigate]);

  const handleLogin = async (role: "admin" | "user") => {
    setBusy(true);
    try {
      await signInAs(role);
    } catch {
      toast.error("Não foi possível iniciar a demonstração");
      setBusy(false);
    }
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
          <p className="text-muted-foreground">Modo demonstração local</p>
        </div>
        <div className="space-y-3">
          <Button
            onClick={() => handleLogin("admin")}
            disabled={busy}
            className="w-full"
            size="lg"
          >
            {busy ? "Entrando..." : "Entrar como Matriz"}
          </Button>
          <Button
            onClick={() => handleLogin("user")}
            disabled={busy}
            className="w-full"
            size="lg"
            variant="secondary"
          >
            Entrar como Representante
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs"
            onClick={() => {
              resetMockData();
              toast.success("Dados de demonstração restaurados");
            }}
          >
            Restaurar dados de demonstração
          </Button>
        </div>
      </Card>
    </div>
  );
}
