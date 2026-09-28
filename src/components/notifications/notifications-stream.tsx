"use client";

import { useCallback, useEffect, useState } from "react";
import { loadNotifications, type NotificationPage } from "@/lib/data/notifications";
import { useSession } from "@/components/shell/session-provider";
import { NotificationRow } from "@/components/notifications/notification-row";
import { MarkReadOnView } from "@/components/notifications/mark-read";
import { PostFeedSkeleton } from "@/components/timeline/post-feed-skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import type { NotificationView } from "@/lib/types";

/**
 * Lista de notificações.
 *
 * Vem do navegador depois que a moldura estática hidrata; marca como lida ao
 * abrir e cresce por botão. As regras de visibilidade são as do RLS do
 * servidor: só quem controla um personagem recebe notificação.
 */
export function NotificationsStream() {
  const { viewer, client, isLoading } = useSession();
  const [page, setPage] = useState<NotificationPage | null>(null);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const ready = Boolean(client && viewer && !isLoading);

  const loadMore = useCallback(async () => {
    if (!client || !viewer || !page?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await loadNotifications(client, viewer, { cursor: page.nextCursor });
      setPage((current) =>
        current
          ? {
              items: [...current.items, ...next.items],
              unread: next.unread,
              nextCursor: next.nextCursor,
              hasMore: next.hasMore,
            }
          : next,
      );
    } finally {
      setLoadingMore(false);
    }
  }, [client, viewer, page?.nextCursor, loadingMore]);

  useEffect(() => {
    if (!ready || !client || !viewer) return;
    let cancelled = false;

    (async () => {
      const next = await loadNotifications(client, viewer, {});
      if (cancelled) return;
      setError(false);
      setPage(next);
    })().catch(() => {
      if (!cancelled) setError(true);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, client, viewer]);

  if (!ready || page === null) {
    return error ? <ErrorState /> : <PostFeedSkeleton rows={5} />;
  }

  const items = page.items as NotificationView[];

  if (items.length === 0) return <EmptyState title="Nada por aqui" />;

  return (
    <>
      {page.unread > 0 ? <MarkReadOnView /> : null}
      <ul>
        {items.map((item) => (
          <NotificationRow key={item.id} item={item} />
        ))}
      </ul>

      {page.hasMore && page.nextCursor ? (
        <div className="flex justify-center px-4 py-6">
          <Button variant="outline" size="sm" onClick={() => void loadMore()}>
            Notificações anteriores
          </Button>
        </div>
      ) : null}
    </>
  );
}