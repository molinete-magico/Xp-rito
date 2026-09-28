import { requireViewer } from "@/lib/session";
import { loadNotifications } from "@/lib/data/notifications";
import { NotificationRow } from "@/components/notifications/notification-row";
import { MarkReadOnView } from "@/components/notifications/mark-read";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

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
  const page = await loadNotifications(viewer, { cursor });

  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <h1 className="font-display text-lg text-ink">Notificações</h1>
      </div>

      {page.unread > 0 ? <MarkReadOnView /> : null}

      {page.items.length === 0 ? (
        <EmptyState title="Nada por aqui" />
      ) : (
        <>
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
      )}
    </>
  );
}
