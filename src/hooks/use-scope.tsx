import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type Rep = { user_id: string; label: string };

interface ScopeValue {
  /** Representantes ativos (somente carregado para a matriz) */
  reps: Rep[];
  /** id do representante que a matriz está visualizando, ou null */
  viewAs: string | null;
  setViewAs: (id: string | null) => void;
  /** dono dos dados (vendas, clientes, entradas, repasses) em exibição */
  ownerId: string;
  /** dono do catálogo/estoque em exibição: null = estoque da matriz */
  productOwner: string | null;
  /** true quando a matriz está operando o próprio estoque */
  isMatriz: boolean;
  /** true quando a matriz está apenas consultando os dados de um representante */
  isViewingRep: boolean;
  viewingRepLabel: string | null;
}

const ScopeContext = createContext<ScopeValue | undefined>(undefined);

const STORAGE_KEY = "fruta2:viewAs";

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [reps, setReps] = useState<Rep[]>([]);
  const [viewAs, setViewAsState] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setReps([]);
      setViewAsState(null);
      return;
    }
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved) setViewAsState(saved);
    supabase
      .from("rep_invites")
      .select("email, name, accepted_user_id")
      .not("accepted_user_id", "is", null)
      .then(({ data }) => {
        const activeReps = ((data ?? []) as any[]).map((i) => ({
            user_id: i.accepted_user_id as string,
            label: i.name ? `${i.name} (${i.email})` : i.email,
          }));
        setReps(activeReps);
        if (saved && !activeReps.some((rep) => rep.user_id === saved)) {
          setViewAsState(null);
          window.localStorage.removeItem(STORAGE_KEY);
        }
      });
  }, [isAdmin]);

  const setViewAs = (id: string | null) => {
    setViewAsState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const effectiveViewAs = isAdmin ? viewAs : null;
  const ownerId = effectiveViewAs ?? user?.id ?? "";
  const isMatriz = isAdmin && !effectiveViewAs;

  return (
    <ScopeContext.Provider
      value={{
        reps,
        viewAs: effectiveViewAs,
        setViewAs,
        ownerId,
        productOwner: isMatriz ? null : ownerId,
        isMatriz,
        isViewingRep: !!effectiveViewAs,
        viewingRepLabel: reps.find((r) => r.user_id === effectiveViewAs)?.label ?? null,
      }}
    >
      {children}
    </ScopeContext.Provider>
  );
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useScope must be used inside ScopeProvider");
  return ctx;
}

/** Aplica o filtro de catálogo/estoque: null = estoque da matriz */
export function scopeProducts<T extends { is: any; eq: any }>(query: T, productOwner: string | null): T {
  return (productOwner === null ? query.is("owner_id", null) : query.eq("owner_id", productOwner)) as T;
}
