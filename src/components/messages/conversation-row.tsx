"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { relativeTime } from "@/lib/format/datetime";
import type { ConversationCard } from "@/lib/types";
import type { Viewer } from "@/lib/session";

/**
 * Linha da caixa de entrada.
 *
 * A conversa direta mostra o nome do outro e a foto dele; o grupo mostra o nome
 * que quem abriu deu e as fotos de quem participa, empilhadas. A contagem de não
 * lidas é a única coisa em negrito da linha, como no Twitter: o resto é
 * informação de contexto.
 */
export function ConversationRow({
  conversation,
  viewer,
  active = false,
}: {
  conversation: ConversationCard;
  viewer: Viewer;
  active?: boolean;
}) {
  const myIds = new Set(viewer.identities.map((actor) => actor.id));
  const others = conversation.participants.filter((actor) => !myIds.has(actor.id));
  const myVoices = conversation.participants.filter((actor) => myIds.has(actor.id));
  const npcVoices = myVoices.filter((actor) => actor.entity_type === "character" && actor.is_npc === true);
  const unread = conversation.unread > 0;

  return (
    <Link
      href={`/messages/${conversation.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-start gap-3 border-b border-line px-4 py-3 transition-colors hover:bg-sunken",
        active && "bg-sunken",
      )}
    >
      {conversation.kind === "group" ? (
        <StackedAvatars actors={conversation.participants} />
      ) : others[0] ? (
        <Avatar
          name={others[0].display_name}
          username={others[0].username}
          src={others[0].avatar_url}
          size="md"
          decorative
          objectPosition={`${others[0].avatar_position_x}% ${others[0].avatar_position_y}%`}
        />
      ) : (
        <Avatar name="Conversa direta" username="conversa-direta" size="md" decorative />
      )}

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn("truncate text-sm text-ink", unread && "font-semibold")}>
            {conversation.title}
          </span>
          <span className="ml-auto shrink-0 text-xs text-ink-3 tabular-nums">
            {relativeTime(conversation.last_message_at)}
          </span>
        </span>

        <span className="mt-0.5 flex items-center gap-2">
          <span className={cn("line-clamp-1 min-w-0 flex-1 text-sm text-ink-2", unread && "text-ink")}>
            {conversation.preview ?? "Nenhuma mensagem ainda"}
          </span>
          {unread ? (
            <span
              className="shrink-0 rounded-xs bg-accent px-1.5 py-0.5 font-mono text-[10px] leading-none text-bg tabular-nums"
              aria-label={`${conversation.unread} mensagens não lidas`}
            >
              {conversation.unread > 99 ? "99+" : conversation.unread}
            </span>
          ) : null}
        </span>

        {viewer.isGm && myVoices.length > 0 ? (
          <span className="mt-1 block truncate text-[11px] text-ink-3">
            {npcVoices.length > 0
              ? `Como ${npcVoices.map((actor) => actor.display_name).join(", ")}`
              : myVoices.length === 1
                ? `Como ${myVoices[0].display_name}`
                : `${myVoices.length} identidades suas nesta conversa`}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/** Grupo: até três fotos sobrepostas, uma por participante. */
export function StackedAvatars({ actors }: { actors: ConversationCard["participants"] }) {
  const shown = actors.slice(0, 3);

  if (shown.length === 0) {
    return <Avatar name="Grupo" username="grupo" size="md" decorative />;
  }

  return (
    <span className="relative h-10 w-10 shrink-0">
      {shown.map((actor, index) => (
        <span
          key={actor.id}
          className="absolute overflow-hidden rounded-full border-2 border-bg"
          style={{
            inset: 0,
            marginLeft: `${index * 22}%`,
            zIndex: shown.length - index,
          }}
        >
          <Avatar
            name={actor.display_name}
            username={actor.username}
            src={actor.avatar_url}
            size="md"
            decorative
            className="rounded-full border-0"
            objectPosition={`${actor.avatar_position_x}% ${actor.avatar_position_y}%`}
          />
        </span>
      ))}
    </span>
  );
}
