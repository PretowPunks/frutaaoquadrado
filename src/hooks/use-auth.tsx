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
const NATIVE_AUTH_CALLBACK = "com.fruta2.gerenciador://auth";

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

    let active = true;
    const listener = App.addListener("appUrlOpen", async ({ url }) => {
      if (!active || !url.startsWith(NATIVE_AUTH_CALLBACK)) return;

      try {
        await Browser.close().catch(() => undefined);
        const callbackUrl = new URL(url);
        const hash = new URLSearchParams(callbackUrl.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const code = callbackUrl.searchParams.get("code");

        let nextSession: Session | null = null;
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          nextSession = data.session;
        } else if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          nextSession = data.session;
        } else {
          throw new Error("O retorno do Google não contém uma sessão válida.");
        }

        await resolveSession(nextSession);
        if (!active || !nextSession) return;
        await navigate({ to: "/", replace: true });
        await router.invalidate();
      } catch (error) {
        console.error("Não foi possível concluir o login no Android", error);
        if (active) clearAuthState();
      }
    });

    return () => {
      active = false;
      void listener.then((handle) => handle.remove());
    };
  }, [clearAuthState, navigate, resolveSession, router]);

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
    const native = Capacitor.isNativePlatform();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: native
        ? { redirectTo: NATIVE_AUTH_CALLBACK, skipBrowserRedirect: true }
        : { redirectTo: window.location.origin },
    });
    if (error) throw error;
    if (native) {
      if (!data.url) throw new Error("Não foi possível abrir o login do Google.");
      await Browser.open({ url: data.url, windowName: "_system" });
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
