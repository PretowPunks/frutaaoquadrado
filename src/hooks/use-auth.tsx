import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "user" | null;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: Role;
  isAdmin: boolean;
  roleLoading: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_TIMEOUT_MS = 8000;

function timeoutAfter(ms: number) {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error("Tempo limite de autenticação excedido")), ms);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadRole = async (userId: string) => {
    setRoleLoading(true);
    try {
      const result = await Promise.race([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .order("role")
          .limit(1)
          .maybeSingle(),
        timeoutAfter(ROLE_TIMEOUT_MS),
      ]);
      setRole((result.data?.role as Role) ?? null);
    } catch (error) {
      console.error("Não foi possível carregar a permissão da conta", error);
      setRole(null);
    } finally {
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
      if (s?.user) {
        setTimeout(() => loadRole(s.user.id), 0);
      } else {
        setRole(null);
        setRoleLoading(false);
      }
    });

    Promise.race([supabase.auth.getSession(), timeoutAfter(ROLE_TIMEOUT_MS)])
      .then(({ data }) => {
        setSession(data.session);
        if (data.session?.user) {
          loadRole(data.session.user.id);
        } else {
          setRoleLoading(false);
        }
      })
      .catch((error) => {
        console.error("Não foi possível restaurar a sessão", error);
        setRoleLoading(false);
      })
      .finally(() => setLoading(false));

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        isAdmin: role === "admin",
        roleLoading,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
