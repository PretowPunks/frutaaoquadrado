import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/mock-client";

type Role = "admin" | "user" | null;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: Role;
  isAdmin: boolean;
  roleLoading: boolean;
  loading: boolean;
  signInAs: (role: Exclude<Role, null>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: PromiseLike<T>, ms = ROLE_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error("Tempo limite de autenticação excedido"));
    }, ms);

    Promise.resolve(promise).then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const authVersion = useRef(0);
  const mounted = useRef(true);

  const clearAuthState = useCallback(() => {
    authVersion.current += 1;
    setSession(null);
    setRole(null);
    setRoleLoading(false);
    setLoading(false);
  }, []);

  const resolveSession = useCallback(async (nextSession: Session | null) => {
    const version = ++authVersion.current;

    if (!nextSession) {
      if (mounted.current) {
        setSession(null);
        setRole(null);
        setRoleLoading(false);
        setLoading(false);
      }
      return;
    }

    setSession(nextSession);
    setRoleLoading(true);
    setLoading(false);

    try {
      const { data: userData, error: userError } = await withTimeout(supabase.auth.getUser());
      if (userError || !userData.user || userData.user.id !== nextSession.user.id) {
        throw userError ?? new Error("Sessão inválida");
      }

      const result = await withTimeout(
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .order("role")
          .limit(1)
          .maybeSingle(),
      );
      if (result.error) throw result.error;
      if (!mounted.current || version !== authVersion.current) return;

      setRole((result.data?.role as Role) ?? null);
    } catch (error) {
      if (!mounted.current || version !== authVersion.current) return;
      console.error("Não foi possível carregar a permissão da conta", error);
      setSession(null);
      setRole(null);
      void supabase.auth.signOut({ scope: "local" });
    } finally {
      if (mounted.current && version === authVersion.current) {
        setRoleLoading(false);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_OUT" || !nextSession) {
        clearAuthState();
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        setSession(nextSession);
        return;
      }

      // Calls to the auth API and database must run after the auth callback returns.
      globalThis.setTimeout(() => void resolveSession(nextSession), 0);
    });

    withTimeout(supabase.auth.getSession())
      .then(({ data, error }) => {
        if (error) throw error;
        return resolveSession(data.session);
      })
      .catch((error) => {
        if (!mounted.current) return;
        console.error("Não foi possível restaurar a sessão", error);
        clearAuthState();
      });

    return () => {
      mounted.current = false;
      authVersion.current += 1;
      sub.subscription.unsubscribe();
    };
  }, [clearAuthState, resolveSession]);

  const signOut = useCallback(async () => {
    clearAuthState();
    window.localStorage.removeItem("fruta2:viewAs");
    await queryClient.cancelQueries();
    queryClient.clear();

    try {
      await withTimeout(supabase.auth.signOut({ scope: "local" }));
    } catch (error) {
      console.error("Não foi possível finalizar a sessão remota", error);
    } finally {
      await navigate({ to: "/login", replace: true });
      await router.invalidate();
    }
  }, [clearAuthState, navigate, queryClient, router]);

  const signInAs = useCallback(
    async (nextRole: Exclude<Role, null>) => {
      const { mockSignIn } = await import("@/lib/mock-client");
      const nextSession = mockSignIn(nextRole);
      await resolveSession(nextSession);
      await navigate({ to: nextRole === "admin" ? "/" : "/campo", replace: true });
      await router.invalidate();
    },
    [navigate, resolveSession, router],
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        isAdmin: role === "admin",
        roleLoading,
        loading,
        signInAs,
        signOut,
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
