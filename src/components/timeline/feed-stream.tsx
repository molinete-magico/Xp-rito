"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadPosts, type PostScope, type PostPage } from "@/lib/data/posts";
import { useSession } from "@/components/shell/session-provider";
import { PostTimeline } from "@/components/timeline/post-timeline";
import { PostFeedSkeleton } from "@/components/timeline/post-feed-skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import type { PostCard as PostCardData } from "@/lib/types";

/**
 * Feed ao vivo.
 *
 * Usado pelas telas estáticas (início, explorar): a moldura da página vem do
 * deploy e o conteúdo é buscado aqui, com o mesmo RLS do servidor. A lista
 * cresce por botão e se atualiza quando alguém publica (evento do compositor,
 * Realtime ou, na falta dele, um olhar discreto a cada 45s).
 */
export function FeedStream({
  scope,
  basePath,
  emptyTitle,
}: {
  scope: PostScope;
  basePath: string;
  emptyTitle: string;
}) {
  const { viewer, client, isLoading } = useSession();
  const [page, setPage] = useState<PostPage | null>(null);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const timer = useRef<number | null>(null);

  const ready = Boolean(client && viewer && !isLoading);
  const scopeKey = scope.kind;

  const loadFirst = useCallback(async () => {
    if (!client || !viewer) return;
    try {
      const next = await loadPosts(client, viewer, scope, {});
      setError(false);
      setPage(next);
    } catch {
      setError(true);
    }
  }, [client, viewer, scope]);

  const loadMore = useCallback(async () => {
    if (!client || !viewer || !page?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await loadPosts(client, viewer, scope, { cursor: page.nextCursor });
      setPage((current) =>
        current
          ? {
              posts: [...current.posts, ...next.posts],
              nextCursor: next.nextCursor,
              hasMore: next.hasMore,
            }
          : next,
      );
    } finally {
      setLoadingMore(false);
    }
  }, [client, viewer, scope, page?.nextCursor, loadingMore]);

  useEffect(() => {
    if (!ready || !client || !viewer) return;
    let cancelled = false;

    (async () => {
      const next = await loadPosts(client, viewer, scope, {});
      if (cancelled) return;
      setError(false);
      setPage(next);
    })().catch(() => {
      if (!cancelled) setError(true);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, client, viewer, scope]);

  useEffect(() => {
    if (!client || !viewer || !ready) return;

    const onRefresh = () => {
      void loadFirst();
    };
    window.addEventListener("xpirito:refresh", onRefresh);

    const channel = client
      .channel(`feed:${scopeKey}:${viewer.userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, onRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "actors" }, onRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "characters" }, onRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "organizations" }, onRefresh)
      .subscribe();

    timer.current = window.setInterval(onRefresh, 45_000);

    return () => {
      window.removeEventListener("xpirito:refresh", onRefresh);
      void client.removeChannel(channel);
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [client, viewer, ready, scopeKey, loadFirst]);

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-[820px]">
        <PostFeedSkeleton />
      </div>
    );
  }

  if (page === null) {
    return (
      <div className="mx-auto w-full max-w-[820px]">
        {error ? <ErrorState /> : <PostFeedSkeleton />}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[820px]">
      <PostTimeline
        posts={page.posts as PostCardData[]}
        nextCursor={page.nextCursor}
        hasMore={page.hasMore}
        basePath={basePath}
        onLoadMore={() => void loadMore()}
        empty={<EmptyState title={emptyTitle} />}
      />
    </div>
  );
}