"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/shell/session-provider";
import { useDmSignal } from "@/components/shell/dm-unread-provider";
import { ConversationRow } from "@/components/messages/conversation-row";
import { NewGroupButton } from "@/components/messages/new-group-button";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/empty-state";
import { loadInbox } from "@/lib/data/messages";
import type { ConversationCard } from "@/lib/types";

/**
 * Caixa de entrada.
 *
 * A lista vem do banco já com a última mensagem e a contagem de não lidas. Não há
 * canal próprio aqui: quem avisa que algo mudou é o provider das mensagens, que
 * já escuta o Realtime pelo selo da navegação, e a caixa se recarrega quando o
 * sinal muda. Duas assinaturas do mesmo evento seria desperdício.
 */
export function InboxStream() {
  const { viewer, client, isLoading } = useSession();
  const signal = useDmSignal();
  const [conversations, setConversations] = useState<ConversationCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!client || !viewer) return;
    try {
      const list = await loadInbox(client, viewer);
      setError(null);
      setConversations(list);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as conversas.");
    }
  }, [client, viewer]);

  useEffect(() => {
    if (!client || !viewer) return;
    let cancelled = false;

    void loadInbox(client, viewer)
      .then((list) => {
        if (cancelled) return;
        setError(null);
        setConversations(list);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });

    return () => {
      cancelled = true;
    };
  }, [client, viewer]);

  // Mensagem nova em qualquer conversa: a lista inteira é refeita pelo mesmo
  // caminho, para a ordem e os contadores não divergirem do resto da tela.
  useEffect(() => {
    if (signal === 0 || !client || !viewer) return;
    let cancelled = false;

    void loadInbox(client, viewer)
      .then((list) => {
        if (!cancelled) setConversations(list);
      })
      .catch(() => {
        // Uma falha momentânea aqui não pode apagar a lista que já está na tela.
      });

    return () => {
      cancelled = true;
    };
  }, [signal, client, viewer]);

  if (isLoading || !viewer) {
    return (
      <div className="px-4 py-10 text-center">
        <Spinner label="Carregando conversas" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Não foi possível carregar suas conversas"
        action={
          <button type="button" onClick={reload} className="text-sm text-ink-2 underline">
            Tentar de novo
          </button>
        }
      />
    );
  }

  if (conversations && conversations.length === 0) {
    // O botão de grupo fica no estado vazio: é a única forma de começar.
    return <EmptyState title="Nenhuma conversa ainda" action={<NewGroupButton />} />;
  }

  return (
    <div>
      <div className="flex justify-end border-b border-line px-4 py-2">
        <NewGroupButton iconOnly />
      </div>

      <ul>
        {(conversations ?? []).map((conversation) => (
          <li key={conversation.id}>
            <ConversationRow conversation={conversation} viewer={viewer} />
          </li>
        ))}
      </ul>
    </div>
  );
}
