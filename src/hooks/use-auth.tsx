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
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/external-supabase/client";

type Role = "admin" | "user" | null;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: Role;
  isAdmin: boolean;
  roleLoading: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_TIMEOUT_MS = 8000;
const NATIVE_AUTH_REDIRECT = "com.fruta2.gerenciador://auth";

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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    const listener = App.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return;

      try {
        const callbackUrl = new URL(url);
        const query = callbackUrl.searchParams;
        const fragment = new URLSearchParams(callbackUrl.hash.replace(/^#/, ""));
        const authError = query.get("error_description") ?? fragment.get("error_description");

        if (authError) throw new Error(authError);

        const code = query.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const accessToken = fragment.get("access_token") ?? query.get("access_token");
          const refreshToken = fragment.get("refresh_token") ?? query.get("refresh_token");
          if (!accessToken || !refreshToken) {
            throw new Error("O retorno do Google não contém uma sessão válida");
          }

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        await Browser.close();
      } catch (error) {
        console.error("Não foi possível concluir o login no aplicativo", error);
        await Browser.close().catch(() => undefined);
      }
    });

    return () => {
      disposed = true;
      void listener.then((handle) => handle.remove());
    };
  }, []);

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

  const signInWithGoogle = useCallback(async () => {
    const isNative = Capacitor.isNativePlatform();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: isNative ? NATIVE_AUTH_REDIRECT : window.location.origin,
        skipBrowserRedirect: isNative,
      },
    });
    if (error) throw error;

    if (isNative) {
      if (!data.url) throw new Error("Não foi possível iniciar o login com o Google");
      await Browser.open({ url: data.url });
    }
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
        signInWithGoogle,
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
