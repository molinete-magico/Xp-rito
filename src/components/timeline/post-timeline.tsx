import { PostCard } from "@/components/post/post-card";
import { ButtonLink, Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { PostCard as PostCardData } from "@/lib/types";

/**
 * Lista de publicações com paginação.
 *
 * No servidor cada página é uma URL, o que preserva a rolagem e funciona sem
 * JavaScript. No navegador (feeds pré-renderizados) a paginação é por botão via
 * `onLoadMore`, anexando a próxima página à atual.
 */
export function PostTimeline({
  posts,
  nextCursor,
  hasMore,
  basePath,
  empty,
  className,
  onLoadMore,
}: {
  posts: PostCardData[];
  nextCursor: string | null;
  hasMore: boolean;
  /** Caminho da listagem, sem a query; usado para montar o link da próxima página. */
  basePath: string;
  empty: React.ReactNode;
  className?: string;
  /** Quando presente, a paginação vira um botão que anexa a próxima página. */
  onLoadMore?: () => void;
}) {
  if (posts.length === 0) return <>{empty}</>;

  return (
    <div className={className}>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {hasMore && nextCursor ? (
        <div className="flex justify-center px-4 py-6">
          {onLoadMore ? (
            <Button variant="outline" size="sm" onClick={onLoadMore}>
              Publicações anteriores
            </Button>
          ) : (
            <ButtonLink
              href={withCursor(basePath, nextCursor)}
              variant="outline"
              size="sm"
              scroll={false}
            >
              Publicações anteriores
            </ButtonLink>
          )}
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
