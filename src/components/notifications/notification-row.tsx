import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { PostExcerpt } from "@/components/post/post-text";
import { relativeTime, fullTimestamp } from "@/lib/format/datetime";
import type { NotificationView } from "@/lib/types";
import type { NotificationType } from "@/types/database";
import { cn } from "@/lib/cn";

/**
 * Uma notificação.
 *
 * A frase é montada com nome e @handle em texto, não com ícone: "Arthur Valença
 * curtiu a publicação de Helena Duarte" é lido em voz alta sem contexto. Cada
 * destino é um link próprio, sem link dentro de link. A linha não lida leva um
 * fio na esquerda, não um fundo, para que a diferença não dependa de cor.
 */
const PHRASES: Record<NotificationType, string> = {
  like: "curtiu a publicação de",
  reply: "respondeu a",
  repost: "repassou a publicação de",
  follow: "começou a seguir",
  mention: "citou",
};

export function NotificationRow({ item }: { item: NotificationView }) {
  const authorLink = (className: string) => (
    <Link href={`/profile/${item.actor.username}`} className={className}>
      {item.actor.display_name}
    </Link>
  );

  return (
    <li className={cn("relative border-b border-line last:border-b-0", !item.read && "bg-accent-soft/30")}>
      {!item.read ? (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
      ) : null}

      <div className="flex gap-3 py-3 pr-4 pl-5">
        <Link
          href={`/profile/${item.actor.username}`}
          aria-label={`Ver perfil de ${item.actor.display_name}`}
          className="shrink-0"
        >
          <Avatar
            name={item.actor.display_name}
            username={item.actor.username}
            src={item.actor.avatar_url}
            size="sm"
            decorative
          />
        </Link>

        <div className="min-w-0 flex-1 text-sm leading-relaxed">
          <p>
            {authorLink("font-medium text-ink hover:underline")}{" "}
            <span className="text-ink-2">{PHRASES[item.type]}</span>{" "}
            {item.target ? (
              <Link
                href={`/profile/${item.target.username}`}
                className="font-medium text-ink hover:underline"
              >
                {item.target.display_name}
              </Link>
            ) : null}
            {!item.read ? <span className="sr-only"> — não lida</span> : null}
          </p>

          {item.post ? (
            <Link
              href={`/post/${item.post.id}`}
              className="mt-1 line-clamp-2 block text-[13px] text-ink-3 hover:text-ink-2"
            >
              <PostExcerpt content={item.post.content} />
            </Link>
          ) : null}

          <time
            dateTime={item.created_at}
            title={fullTimestamp(item.created_at)}
            className="mt-1 block font-mono text-[11px] text-ink-3"
          >
            {relativeTime(item.created_at)}
          </time>
        </div>
      </div>
    </li>
  );
}
