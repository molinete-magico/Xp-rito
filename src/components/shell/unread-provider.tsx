"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Contador de não lidas, compartilhado.
 *
 * O número inicial vem do servidor, que já consultou. A partir daí o Postgres
 * avisa pelo Realtime que a tabela mudou e o cliente refaz a contagem por uma
 * função do banco: uma requisição por evento, escopada pelo RLS. Um único
 * provider para as duas barras de navegação, para não duplicar a assinatura do
 * mesmo canal.
 */
const UnreadContext = createContext<number>(0);

export function UnreadProvider({
  initial,
  actorIds,
  children,
}: {
  initial: number;
  actorIds: string[];
  children: React.ReactNode;
}) {
  const [unread, setUnread] = useState(initial);
  const key = actorIds.join(",");

  useEffect(() => {
    if (key.length === 0) return;

    const supabase = createClient();
    let cancelled = false;

    const channel = supabase
      .channel(`notificacoes:${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          void supabase.rpc("count_unread_notifications").then(({ data }) => {
            if (!cancelled && typeof data === "number") setUnread(data);
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [key]);

  return <UnreadContext.Provider value={unread}>{children}</UnreadContext.Provider>;
}

export function useUnread(): number {
  return useContext(UnreadContext);
}
