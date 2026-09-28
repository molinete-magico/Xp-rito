import { NotificationsStream } from "@/components/notifications/notifications-stream";

/**
 * Notificações.
 *
 * Moldura estática; a lista (e a marcação de lidas) acontece no navegador, com
 * o mesmo RLS do servidor.
 */
export default function NotificationsPage() {
  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <h1 className="font-display text-lg text-ink">Notificações</h1>
      </div>

      <NotificationsStream />
    </>
  );
}