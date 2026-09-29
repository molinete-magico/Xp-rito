"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildClientViewer, type BrowserClient } from "@/lib/session-client";
import { writeActiveActor } from "@/lib/storage";
import { setActiveActorAction } from "@/app/actions/auth";
import type { Viewer } from "@/lib/session";

/**
 * Sessão no cliente.
 *
 * Pré-renderiza a moldura sem saber quem está entrando: aqui, depois da
 * hidratação, resolvemos a sessão pelos cookies do Supabase. Enquanto resolve,
 * os esqueletos aparecem; se não houver sessão, o provedor manda para /login.
 * O `client` compartilhado evita abrir uma conexão por feed.
 */
interface SessionState {
  viewer: Viewer | null;
  client: BrowserClient | null;
  isLoading: boolean;
  setActiveActor: (actorId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const client = useMemo(() => (typeof window === "undefined" ? null : createClient()), []);

  const refresh = useCallback(async () => {
    if (!client) return;
    const next = await buildClientViewer(client);
    setViewer(next);
    return;
  }, [client]);

  useEffect(() => {
    if (!client) return;
    let mounted = true;

    async function start(browser: BrowserClient) {
      const next = await buildClientViewer(browser);
      if (!mounted) return;
      setViewer(next);
      setIsLoading(false);
    }

    if (client) void start(client);

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setViewer(null);
        setIsLoading(false);
        router.replace("/login");
      } else if (event === "INITIAL_SESSION") {
        // O primeiro estado já foi resolvido por `start()`.
      } else if (event === "TOKEN_REFRESHED") {
        void refresh();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [client, refresh, router]);

  const actorSwitchTail = useRef(Promise.resolve());
  const actorSwitchVersion = useRef(0);

  const setActiveActor = useCallback((actorId: string): Promise<boolean> => {
    const version = ++actorSwitchVersion.current;
    const operation = actorSwitchTail.current.then(async () => {
      const allowed = await setActiveActorAction(actorId);
      if (allowed && version === actorSwitchVersion.current) {
        writeActiveActor(actorId);
        setViewer((current) => (current ? { ...current, activeActorId: actorId } : current));
      }
      return allowed;
    });

    actorSwitchTail.current = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }, []);

  return (
    <SessionContext.Provider value={{ viewer, client, isLoading, setActiveActor, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession precisa estar dentro de <SessionProvider>");
  return value;
}