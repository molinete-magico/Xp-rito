import Link from "next/link";
import { segmentContent, hashtagPath } from "@/lib/text/content";
import { cn } from "@/lib/cn";

/**
 * Corpo de uma publicação.
 *
 * O texto do usuário entra aqui como string e sai como elementos React. Não há
 * `dangerouslySetInnerHTML` em nenhum ponto do caminho de post, o que fecha o
 * XSS sem depender de sanitizador.
 */

export function PostText({
  content,
  className,
  compact = false,
}: {
  content: string;
  className?: string;
  compact?: boolean;
}) {
  const segments = segmentContent(content);

  return (
    <div className={cn("prose-post", compact && "line-clamp-6", className)}>
      {segments.map((segment, index) => {
        const key = `${segment.kind}-${index}`;

        if (segment.kind === "hashtag") {
          return (
            <Link key={key} href={hashtagPath(segment.value)} className="tag">
              #{segment.value}
            </Link>
          );
        }

        if (segment.kind === "link") {
          return (
            <a
              key={key}
              href={segment.href}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="break-all"
            >
              {segment.value.replace(/^https?:\/\//, "")}
            </a>
          );
        }

        return <span key={key}>{segment.value}</span>;
      })}
    </div>
  );
}

/** Prévia de uma linha usada em listas compactas (notificações, painel lateral). */
export function PostExcerpt({ content, limit = 140 }: { content: string | null; limit?: number }) {
  if (!content) return <span className="text-ink-3">compartilhou uma publicação</span>;

  const flat = content.replace(/\s+/g, " ").trim();
  return <>{flat.length > limit ? `${flat.slice(0, limit).trimEnd()}…` : flat}</>;
}
