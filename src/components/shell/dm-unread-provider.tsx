"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { loadUnreadTotal } from "@/lib/data/messages";

/**
 * Estado compartilhado das mensagens privadas: o selo de não lidas e um sinal de
 * "mudou alguma coisa".
 *
 * Mesmo desenho do provider de notificações: o shell é pré-renderizado sem
 * sessão, então o número inicial é zero e quem calcula é o banco — o Realtime
 * avisa que a tabela de mensagens mudou e o cliente refaz a contagem pela função,
 * que já conhece o `last_read_at` de cada participante.
 *
 * O sinal existe para a caixa não abrir um segundo canal: selo e caixa escutam
 * o mesmo Realtime, e a caixa só recarrega a lista quando o número de eventos
 * muda.
 */
interface DmState {
  unread: number;
  /** Muda a cada mensagem inserida; a caixa escuta isso para se recarregar. */
  signal: number;
  /**
   * Refaz a contagem. Ler e ocultar mexem em `dm_participants`, e não em
   * `dm_messages` — sem isto o selo ficaria com a contagem de antes de abrir a
   * conversa até a próxima mensagem chegar.
   */
  refreshUnread: () => void;
}

const DmContext = createContext<DmState>({
  unread: 0,
  signal: 0,
  refreshUnread: () => {},
});

export function DmUnreadProvider({ actorIds, children }: { actorIds: string[]; children: React.ReactNode }) {
  const [unread, setUnread] = useState(0);
  const [signal, setSignal] = useState(0);
  const key = actorIds.join(",");

  // A contagem vive no efeito (que é quem tem o cliente), mas precisa ser
  // acionável de fora, para leitura e ocultação acertarem o selo na hora.
  const recount = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (key.length === 0) return;

    const supabase = createClient();
    let cancelled = false;

    const refreshCount = () => {
      void loadUnreadTotal(supabase).then((total) => {
        if (!cancelled) setUnread(total);
      });
    };

    recount.current = refreshCount;
    refreshCount();

    const channel = supabase
      .channel(`mensagens:${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_messages" },
        () => {
          setSignal((value) => value + 1);
          refreshCount();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      recount.current = null;
      void supabase.removeChannel(channel);
    };
  }, [key]);

  // Sem identidade de DM (só NPC, ou nada) não há caixa: o selo zerado vem daqui,
  // e não de um setState dentro do efeito acima.
  // A referência de `refreshUnread` é estável de propósito: a thread a chama
  // depois de marcar lido, e um callback novo a cada render faria o efeito dela
  // recarregar a conversa num laço.
  const refreshUnread = useCallback(() => recount.current?.(), []);

  const value = useMemo<DmState>(
    () => ({ unread: key.length === 0 ? 0 : unread, signal, refreshUnread }),
    [unread, signal, key, refreshUnread],
  );

  return <DmContext.Provider value={value}>{children}</DmContext.Provider>;
}

/** Refaz a contagem do selo depois de uma ação que muda o que está lido. */
export function useDmRefreshUnread(): () => void {
  return useContext(DmContext).refreshUnread;
}

/** Total de mensagens não lidas, para o selo da navegação. */
export function useDmUnread(): number {
  return useContext(DmContext).unread;
}

/** Muda a cada mensagem nova; quem lista conversas recarrega quando muda. */
export function useDmSignal(): number {
  return useContext(DmContext).signal;
}
