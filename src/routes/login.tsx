import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import logoAsset from "@/assets/fruta2-logo.png.asset.json";
import { Chrome } from "lucide-react";

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
  const { session, loading, roleLoading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !roleLoading && session) navigate({ to: "/", replace: true });
  }, [session, loading, roleLoading, navigate]);

  const handleLogin = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      toast.error("Não foi possível entrar com o Google");
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
          <p className="text-muted-foreground">Entre com sua conta Google autorizada</p>
        </div>
        <div className="space-y-3">
          <Button
            onClick={handleLogin}
            disabled={busy}
            className="w-full"
            size="lg"
          >
            <Chrome className="h-5 w-5" />
            {busy ? "Entrando..." : "Entrar com Google"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
