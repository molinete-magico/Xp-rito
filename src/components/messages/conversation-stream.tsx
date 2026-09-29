"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreHorizontal, Trash2 } from "lucide-react";
import { useSession } from "@/components/shell/session-provider";
import { useDmRefreshUnread, useDmSignal } from "@/components/shell/dm-unread-provider";
import { MessageComposer } from "@/components/messages/message-composer";
import { Avatar } from "@/components/ui/avatar";
import { ErrorState, Spinner } from "@/components/ui/empty-state";
import {
  clearConversationAction,
  hideConversationAction,
  markConversationReadAction,
} from "@/app/actions/messages";
import { formatMessageCursor, loadConversation, MESSAGE_PAGE_SIZE } from "@/lib/data/messages";
import { fullTimestamp, relativeTime } from "@/lib/format/datetime";
import { dmSpeakerCandidates } from "@/lib/data/identities";
import { cn } from "@/lib/cn";
import type { ActorSummary, ConversationView, MessageView } from "@/lib/types";

/**
 * Conversa aberta.
 *
 * O histórico vem paginado do mais novo para o mais antigo e a tela desenha do
 * mais antigo para o mais novo, com a rolagem colada no fim. O Realtime não
 * entrega a mensagem pronta: ele avisa que a tabela mudou, e quem recarrega é
 * esta tela, pelo mesmo caminho do primeiro carregamento — assim a página antiga
 * do histórico e a mensagem nova nunca ficam fora de ordem, e o selo de não
 * lidas é refeito pela mesma contagem que a caixa usa.
 */
export function ConversationStream({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { viewer, client, isLoading } = useSession();
  const signal = useDmSignal();
  const refreshUnread = useDmRefreshUnread();
  const [conversation, setConversation] = useState<ConversationView | null>(null);
  const [inflight, setInflight] = useState<MessageView[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  const reload = useCallback(async () => {
    if (!client || !viewer) return;
    const view = await loadConversation(client, viewer, conversationId);
    setNotFound(!view);
    setConversation(view);
  }, [client, viewer, conversationId]);

  /**
   * Busca a thread e marca como lida, sem mexer no estado da tela: quem chama
   * decide se a resposta ainda vale, porque a conversa pode ter mudado no meio do
   * caminho. Abrir uma conversa é ler, então o selo da navegação cai junto — se
   * ficasse para trás, a navegação mentiria.
   */
  const fetchAndMarkRead = useCallback(
    async (isCurrent: () => boolean) => {
      if (!client || !viewer) return null;
      const view = await loadConversation(client, viewer, conversationId);
      if (view && isCurrent()) void markConversationReadAction(conversationId).then(refreshUnread);
      return view;
    },
    [client, viewer, conversationId, refreshUnread],
  );

  useEffect(() => {
    if (!client || !viewer) return;
    let cancelled = false;

    (async () => {
      const view = await fetchAndMarkRead(() => !cancelled);
      if (cancelled) return;
      setError(null);
      setNotFound(!view);
      setConversation(view);
    })().catch((cause: Error) => {
      if (!cancelled) setError(cause.message);
    });

    return () => {
      cancelled = true;
    };
  }, [client, viewer, fetchAndMarkRead]);

  useEffect(() => {
    if (signal === 0 || !client || !viewer) return;
    let cancelled = false;

    (async () => {
      const view = await fetchAndMarkRead(() => !cancelled);
      if (cancelled || !view) return;
      setNotFound(false);
      setConversation(view);
    })().catch(() => {
      // Uma falha momentânea não pode apagar o histórico que já está na tela.
    });

    return () => {
      cancelled = true;
    };
  }, [signal, client, viewer, fetchAndMarkRead]);

  const messageCount = (conversation?.messages.length ?? 0) + inflight.length;
  useEffect(() => {
    if (nearBottom.current) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount]);

  if (isLoading || !viewer) {
    return (
      <div className="px-4 py-10 text-center">
        <Spinner label="Abrindo conversa" />
      </div>
    );
  }

  if (notFound) {
    return (
      <ErrorState
        title="Esta conversa não existe ou você não participa dela"
        action={
          <Link href="/messages" className="text-sm text-ink-2 underline">
            Voltar para as conversas
          </Link>
        }
      />
    );
  }

  if (error || !conversation) {
    return (
      <ErrorState
        title={error ?? "Não foi possível abrir a conversa"}
        action={
          <Link href="/messages" className="text-sm text-ink-2 underline">
            Voltar para as conversas
          </Link>
        }
      />
    );
  }

  async function loadOlder() {
    if (!client || !viewer || !conversation || conversation.messages.length === 0) return;
    const first = conversation.messages[0];
    setLoadingMore(true);
    const older = await loadConversation(client, viewer, conversationId, {
      before: formatMessageCursor(first.created_at, first.id),
      limit: MESSAGE_PAGE_SIZE,
    });
    if (older) {
      setConversation((current) =>
        current
          ? { ...current, messages: [...older.messages, ...current.messages], hasMore: older.hasMore }
          : current,
      );
    }
    setLoadingMore(false);
  }

  async function hide() {
    setMenuOpen(false);
    const result = await hideConversationAction(conversationId);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    // Ocultar tira a conversa da caixa; o selo acompanha antes de navegar.
    refreshUnread();
    router.push("/messages");
  }

  async function clear() {
    setMenuOpen(false);
    const ok = window.confirm(
      "Apagar todas as mensagens desta conversa? Isso vale para todos que participam.",
    );
    if (!ok) return;

    const result = await clearConversationAction(conversationId);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    await reload();
  }

  // A conversa decide quem pode falar nela: o personagem próprio e, para o
  // Mestre, os NPCs da mesa que já estão aqui. `speakers` é a lista que o
  // compositor mostra, e `mineActors` é o que conta como "minha mensagem" — quem
  // fala por um NPC que está na conversa está do lado de quem escreve.
  const speakers = dmSpeakerCandidates(viewer, conversation.participants);
  const mineActors = new Set(speakers.map((speaker) => speaker.id));

  function addInflight(sender: ActorSummary, content: string) {
    const id = `optimistic-${Date.now()}`;
    // A mensagem otimista sai do lado de quem escreve, e quem escreve é o
    // remetente escolhido agora — o mesmo que o formulário vai mandar.
    const message = optimisticMessage(sender, id, content, mineActors.has(sender.id));
    setInflight((existing) => [...existing, message]);
    return id;
  }

  function settleInflight(ok: boolean, optimisticId: string) {
    if (ok) {
      setInflight([]);
      void reload();
      return;
    }
    setInflight((current) => current.filter((message) => message.id !== optimisticId));
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link
          href="/messages"
          className="text-ink-3 hover:text-ink lg:hidden"
          aria-label="Voltar para as conversas"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-base text-ink">{conversation.title}</h1>
          <p className="truncate text-xs text-ink-3">{conversation.subtitle}</p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="text-ink-3 hover:text-ink"
            aria-label="Opções da conversa"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-56 border border-line bg-surface">
              <button
                type="button"
                onClick={hide}
                className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-sunken"
              >
                Some da minha caixa
              </button>
              <button
                type="button"
                onClick={clear}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                Apagar para todos
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {actionError ? (
        <p role="alert" className="border-b border-line px-4 py-2 text-xs text-danger">
          {actionError}
        </p>
      ) : null}

      <div
        className="flex-1 overflow-y-auto"
        onScroll={(event) => {
          const element = event.currentTarget;
          nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
        }}
      >
        {conversation.hasMore ? (
          <div className="px-4 py-3 text-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingMore}
              className="text-xs text-ink-2 underline underline-offset-2 disabled:opacity-50"
            >
              {loadingMore ? "Carregando…" : "Carregar mensagens anteriores"}
            </button>
          </div>
        ) : (
          <p className="px-4 py-6 text-center text-xs text-ink-3">Este é o começo da conversa.</p>
        )}

        <ul className="space-y-3 px-4 py-2">
          {conversation.messages.map((message) => (
            <li key={message.id} className={cn(message.mine && "flex justify-end")}>
              <MessageBubble message={message} />
            </li>
          ))}

          {inflight.map((message) => (
            <li key={message.id} className="flex justify-end">
              <MessageBubble message={message} />
            </li>
          ))}
        </ul>

        <div ref={bottomRef} />
      </div>

      <MessageComposer
        key={conversationId}
        conversationId={conversationId}
        speakers={speakers}
        activeActorId={viewer.activeActorId}
        onPending={addInflight}
        onSettled={settleInflight}
      />
    </div>
  );
}

function MessageBubble({ message }: { message: MessageView }) {
  return (
    <div className={cn("flex max-w-[85%] items-end gap-2", message.mine && "flex-row-reverse")}>
      <Avatar
        name={message.author.display_name}
        username={message.author.username}
        src={message.author.avatar_url}
        size="xs"
        decorative
        className="mb-0.5"
        objectPosition={`${message.author.avatar_position_x}% ${message.author.avatar_position_y}%`}
      />
      <div className={cn("min-w-0", message.mine && "items-end text-right")}>
        <p className="text-xs text-ink-3">
          <span className="text-ink-2">{message.author.display_name}</span>{" "}
          <time dateTime={message.created_at} title={fullTimestamp(message.created_at)}>
            {relativeTime(message.created_at)}
          </time>
        </p>
        <p
          className={cn(
            "mt-0.5 rounded-xs px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
            message.mine ? "bg-accent-soft text-ink" : "border border-line bg-surface text-ink",
          )}
        >
          {message.content}
        </p>
      </div>
    </div>
  );
}

/**
 * A mensagem que aparece antes do banco responder.
 *
 * Sai com o personagem que o compositor está usando agora — o mesmo que vai no
 * formulário — e some sozinha quando a conversa recarrega com a versão que o
 * banco aceitou. Sem remetente escolhido não há o que desenhar.
 */
function optimisticMessage(
  author: ActorSummary,
  id: string,
  content: string,
  mine: boolean,
): MessageView {
  return {
    id,
    content,
    created_at: new Date().toISOString(),
    author,
    mine,
  };
}
