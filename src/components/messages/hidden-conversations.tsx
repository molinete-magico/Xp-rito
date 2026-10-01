"use client";

import { useState, useTransition } from "react";
import { EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { relativeTime } from "@/lib/format/datetime";
import { StackedAvatars } from "@/components/messages/conversation-row";
import { unhideConversationAction } from "@/app/actions/messages";
import type { ConversationCard } from "@/lib/types";
import type { Viewer } from "@/lib/session";

/**
 * O que a pessoa tirou da própria caixa, e o botão para desfazer.
 *
 * Esconder era um beco sem volta: a conversa saía da lista e não sobrava lugar
 * na tela para trazê-la de volta. A linha aqui é a única saída, então o botão é
 * o elemento principal — a conversa e a prévia são só o contexto de qual
 * estamos falando.
 *
 * A reexibição é aplicada na hora: a linha sai da lista de ocultas assim que o
 * banco confirma, e a caixa é recarregada para a conversa aparecer no lugar dela.
 * Se o banco recusar, a volta é para a mesma lista e o motivo aparece em vez de
 * a linha simplesmente sumir.
 */
export function HiddenConversations({
  conversations,
  viewer,
  onRestored,
}: {
  conversations: ConversationCard[];
  viewer: Viewer;
  onRestored: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function restore(conversationId: string) {
    setError(null);
    setRestoring(conversationId);
    startTransition(async () => {
      const result = await unhideConversationAction(conversationId);
      if (result.error) {
        setError(result.error);
        setRestoring(null);
        return;
      }
      setRestoring(null);
      onRestored();
    });
  }

  return (
    <section className="border-t border-line">
      <h2 className="sr-only">Conversas ocultas</h2>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-ink-2 hover:bg-sunken"
      >
        <EyeOff aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>
          Ocultas <span className="tabular-nums">({conversations.length})</span>
        </span>
        <span className="ml-auto text-ink-3">{open ? "Ocultar lista" : "Ver"}</span>
      </button>

      {error ? (
        <p role="alert" className="border-t border-line px-4 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {open ? (
        <ul>
          {conversations.map((conversation) => (
            <li key={conversation.id} className="border-t border-line">
              <div className="flex items-start gap-3 px-4 py-3">
                <HiddenAvatars conversation={conversation} viewer={viewer} />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink-2">{conversation.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">
                    {conversation.preview ?? "Nenhuma mensagem ainda"} ·{" "}
                    {relativeTime(conversation.last_message_at)}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => restore(conversation.id)}
                  disabled={pending}
                  aria-label={`Reexibir a conversa ${conversation.title}`}
                  className={cn(
                    "shrink-0 rounded-xs border border-line px-2 py-1 text-xs text-ink-2",
                    "hover:bg-sunken hover:text-ink disabled:opacity-50",
                  )}
                >
                  {restoring === conversation.id ? "Voltando…" : "Reexibir"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * A mesma figura da linha da caixa, mas sem o link: quem está aqui não está
 * dentro da conversa, e um botão dentro de um link é duas coisas focáveis
 * disputando o mesmo clique.
 */
function HiddenAvatars({
  conversation,
  viewer,
}: {
  conversation: ConversationCard;
  viewer: Viewer;
}) {
  if (conversation.kind === "group") {
    return <StackedAvatars actors={conversation.participants} />;
  }

  const other = conversation.participants.find(
    (actor) => !viewer.identities.some((mine) => mine.id === actor.id),
  );

  if (!other) {
    return <Avatar name="Conversa direta" username="conversa-direta" size="md" decorative />;
  }

  return (
    <Avatar
      name={other.display_name}
      username={other.username}
      src={other.avatar_url}
      size="md"
      decorative
      objectPosition={`${other.avatar_position_x}% ${other.avatar_position_y}%`}
    />
  );
}
