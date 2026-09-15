import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { ScopeProvider, useScope } from "@/hooks/use-scope";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect } from "react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, role, roleLoading, user, signOut } = useAuth();
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
    <ScopeProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full min-w-0">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <AppHeader />
            <main className="min-w-0 flex-1 overflow-x-hidden bg-muted/30 p-3 sm:p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ScopeProvider>
  );
}

function AppHeader() {
  const { isAdmin } = useAuth();
  const { reps, viewAs, setViewAs, isViewingRep, viewingRepLabel } = useScope();

  return (
    <>
      <header className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b bg-background px-3 py-2 sm:flex sm:gap-3">
        <SidebarTrigger />
        <h1 className="truncate font-semibold">Controle de Estoque</h1>
        {isAdmin && reps.length > 0 && (
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Visualizar:</span>
            <Select value={viewAs ?? "matriz"} onValueChange={(v) => setViewAs(v === "matriz" ? null : v)}>
              <SelectTrigger className="h-10 w-[min(14rem,48vw)] text-xs sm:h-8 sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="matriz">Matriz (meus dados)</SelectItem>
                {reps.map((r) => (
                  <SelectItem key={r.user_id} value={r.user_id}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {!isAdmin && <span className="ml-auto text-xs text-muted-foreground">Representante</span>}
        {isAdmin && reps.length === 0 && <span className="ml-auto text-xs text-muted-foreground">Matriz</span>}
      </header>
      {isViewingRep && (
        <div className="bg-primary/10 text-primary text-xs px-4 py-2 flex items-center justify-between gap-3">
          <span>Você está vendo os dados de <strong>{viewingRepLabel ?? "representante"}</strong> (somente leitura).</span>
          <Button size="sm" variant="secondary" onClick={() => setViewAs(null)}>Voltar para a matriz</Button>
        </div>
      )}
    </>
  );
}
