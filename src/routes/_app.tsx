import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEffect } from "react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, role, roleLoading, isAdmin, user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [session, loading, navigate]);

  if (loading || !session || roleLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="p-8 max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">Acesso não liberado</h1>
          <p className="text-sm text-muted-foreground">
            A conta <strong>{user?.email}</strong> ainda não foi convidada como representante Fruta². Peça à matriz para
            cadastrar este e-mail na lista de representantes e entre novamente.
          </p>
          <Button variant="secondary" onClick={signOut}>Sair</Button>
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b bg-background px-3 gap-2">
            <SidebarTrigger />
            <h1 className="font-semibold">Controle de Estoque</h1>
            <span className="ml-auto text-xs text-muted-foreground">
              {isAdmin ? "Matriz" : "Representante"}
            </span>
          </header>
          <main className="flex-1 p-6 bg-muted/30">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
