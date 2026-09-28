import { PostCard } from "@/components/post/post-card";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { PostCard as PostCardData } from "@/lib/types";

/**
 * Lista de publicações com paginação por link.
 *
 * A timeline não usa estado no cliente para carregar mais: cada página é uma
 * URL, o que mantém a posição da rolagem e funciona sem JavaScript.
 */
export function PostTimeline({
  posts,
  nextCursor,
  hasMore,
  basePath,
  empty,
  className,
}: {
  posts: PostCardData[];
  nextCursor: string | null;
  hasMore: boolean;
  /** Caminho da listagem, sem a query; usado para montar o link da próxima página. */
  basePath: string;
  empty: React.ReactNode;
  className?: string;
}) {
  if (posts.length === 0) return <>{empty}</>;

  return (
    <div className={className}>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {hasMore && nextCursor ? (
        <div className="flex justify-center px-4 py-6">
          <ButtonLink
            href={withCursor(basePath, nextCursor)}
            variant="outline"
            size="sm"
            scroll={false}
          >
            Publicações anteriores
          </ButtonLink>
        </div>
      ) : (
        <p className={cn("px-4 py-8 text-center text-xs text-ink-3")}>
          Você chegou ao começo do arquivo.
        </p>
      )}
    </div>
  );
}

function withCursor(basePath: string, cursor: string): string {
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}cursor=${encodeURIComponent(cursor)}`;
}
