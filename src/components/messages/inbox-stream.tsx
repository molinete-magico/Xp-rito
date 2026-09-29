"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/shell/session-provider";
import { useDmSignal } from "@/components/shell/dm-unread-provider";
import { ConversationRow } from "@/components/messages/conversation-row";
import { NewGroupButton } from "@/components/messages/new-group-button";
import { NewMessageButton } from "@/components/messages/new-message-button";
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
  const [search, setSearch] = useState("");
  const [masterFilter, setMasterFilter] = useState<"all" | "characters" | "npcs">("all");

  const filteredConversations = useMemo(() => {
    if (!viewer) return [];
    const term = search.trim().toLocaleLowerCase();
    const mine = new Set(viewer.identities.map((actor) => actor.id));

    return (conversations ?? []).filter((conversation) => {
      const voices = conversation.participants.filter((actor) => mine.has(actor.id));
      const matchesFilter =
        !viewer.isGm ||
        masterFilter === "all" ||
        (masterFilter === "npcs" && voices.some((actor) => actor.is_npc === true)) ||
        (masterFilter === "characters" && voices.some((actor) => actor.entity_type === "character" && actor.is_npc !== true));

      if (!matchesFilter) return false;
      if (!term) return true;

      return [
        conversation.title,
        conversation.preview ?? "",
        ...conversation.participants.map((actor) => actor.display_name),
        ...conversation.participants.map((actor) => actor.username),
      ].some((value) => value.toLocaleLowerCase().includes(term));
    });
  }, [conversations, masterFilter, search, viewer]);

  const reload = useCallback(async () => {
    if (!client || !viewer) return;
    try {
      const list = await loadInbox(client, viewer, viewer.isGm ? 200 : 50);
      setError(null);
      setConversations(list);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as conversas.");
    }
  }, [client, viewer]);

  useEffect(() => {
    if (!client || !viewer) return;
    let cancelled = false;

    void loadInbox(client, viewer, viewer.isGm ? 200 : 50)
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

    void loadInbox(client, viewer, viewer.isGm ? 200 : 50)
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
    return (
      <EmptyState
        title="Nenhuma conversa ainda"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <NewMessageButton />
            <NewGroupButton />
          </div>
        }
      />
    );
  }

  return (
    <div>
      <div className="border-b border-line px-4 py-2">
        <div className="flex justify-end gap-2">
          <NewMessageButton />
          <NewGroupButton iconOnly />
        </div>

        <label htmlFor="dm-search" className="sr-only">Buscar nas conversas</label>
        <input
          id="dm-search"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder={viewer.isGm ? "Buscar conversa, jogador ou NPC" : "Buscar conversa"}
          className="mt-2 w-full border border-line-2 bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-ink"
        />

        {viewer.isGm ? (
          <div className="mt-2 flex gap-1 overflow-x-auto" aria-label="Filtrar conversas por identidade">
            {([
              ["all", "Todas"],
              ["characters", "Meus personagens"],
              ["npcs", "NPCs"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={masterFilter === value}
                onClick={() => setMasterFilter(value)}
                className={
                  masterFilter === value
                    ? "shrink-0 border border-ink bg-ink px-2.5 py-1 text-xs text-bg"
                    : "shrink-0 border border-line px-2.5 py-1 text-xs text-ink-2 hover:bg-sunken"
                }
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {filteredConversations.length === 0 ? (
        <EmptyState
          title={search.trim() || (viewer.isGm && masterFilter !== "all") ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
          action={
            search.trim() || (viewer.isGm && masterFilter !== "all") ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setMasterFilter("all");
                }}
                className="text-sm text-ink-2 underline"
              >
                Limpar filtros
              </button>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                <NewMessageButton />
                <NewGroupButton />
              </div>
            )
          }
        />
      ) : (
        <ul>
          {filteredConversations.map((conversation) => (
            <li key={conversation.id}>
              <ConversationRow conversation={conversation} viewer={viewer} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
