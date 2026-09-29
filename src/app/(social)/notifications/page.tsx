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
      <div className="interface-header">
        <h1 className="font-display text-lg text-ink">Notificações</h1>
      </div>

      <NotificationsStream />
    </>
  );
}