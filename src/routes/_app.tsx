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
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <AppHeader />
            <main className="flex-1 p-6 bg-muted/30">
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
      <header className="h-14 flex items-center border-b bg-background px-3 gap-3">
        <SidebarTrigger />
        <h1 className="font-semibold">Controle de Estoque</h1>
        {isAdmin && reps.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Visualizar:</span>
            <Select value={viewAs ?? "matriz"} onValueChange={(v) => setViewAs(v === "matriz" ? null : v)}>
              <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
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
