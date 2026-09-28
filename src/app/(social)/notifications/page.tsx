import { Suspense } from "react";
import { requireViewer } from "@/lib/session";
import { loadNotifications } from "@/lib/data/notifications";
import { NotificationRow } from "@/components/notifications/notification-row";
import { MarkReadOnView } from "@/components/notifications/mark-read";
import { PostFeedSkeleton } from "@/components/timeline/post-feed-skeleton";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Viewer } from "@/lib/session";

/**
 * Notificações.
 *
 * Marcar como lidas é feito pelo botão e ao abrir a página. A paginação é por
 * link, como no resto da rede.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const viewer = await requireViewer();

  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <h1 className="font-display text-lg text-ink">Notificações</h1>
      </div>

      <Suspense fallback={<PostFeedSkeleton rows={5} />}>
        <NotificationsFeed viewer={viewer} cursor={cursor} />
      </Suspense>
    </>
  );
}

async function NotificationsFeed({ viewer, cursor }: { viewer: Viewer; cursor?: string }) {
  const page = await loadNotifications(viewer, { cursor });

  if (page.items.length === 0) return <EmptyState title="Nada por aqui" />;

  return (
    <>
      {page.unread > 0 ? <MarkReadOnView /> : null}
      <ul>
        {page.items.map((item) => (
          <NotificationRow key={item.id} item={item} />
        ))}
      </ul>

      {page.hasMore && page.nextCursor ? (
        <div className="flex justify-center px-4 py-6">
          <ButtonLink
            href={`/notifications?cursor=${encodeURIComponent(page.nextCursor)}`}
            variant="outline"
            size="sm"
            scroll={false}
          >
            Notificações anteriores
          </ButtonLink>
        </div>
      ) : null}
    </>
  );
}