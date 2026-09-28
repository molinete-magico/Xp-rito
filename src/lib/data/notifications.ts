import { toActorCard, type DataClient } from "@/lib/data/identities";
import type { Viewer } from "@/lib/session";
import type { NotificationView } from "@/lib/types";
import type { NotificationType } from "@/types/database";

/**
 * Notificações: a lista das identidades que a pessoa controla, mais nova
 * primeiro. Uma página, com o post e o autor de origem resolvidos em lote.
 */

export interface NotificationPage {
  items: NotificationView[];
  unread: number;
  nextCursor: string | null;
  hasMore: boolean;
}

const NOTIFICATION_FIELDS = `id, type, read, created_at, post_id, actor:actors!notifications_actor_id_fkey(id, display_name, username, avatar_url, banner_url, entity_type, character:characters(id, is_npc), organization:organizations(id, type)), post:posts!notifications_post_id_fkey(id, content, author:actors!posts_actor_id_fkey(id, display_name, username, avatar_url, banner_url, entity_type, character:characters(id, is_npc), organization:organizations(id, type)))`;

const PAGE_SIZE = 30;

export async function loadNotifications(
  client: DataClient,
  viewer: Viewer,
  options: { cursor?: string | null } = {},
): Promise<NotificationPage> {
  const actorIds = viewer.identities.map((actor) => actor.id);
  if (actorIds.length === 0) {
    return { items: [], unread: 0, nextCursor: null, hasMore: false };
  }

  const unreadQuery = client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false)
    .in("recipient_actor_id", actorIds);

  let query = client
    .from("notifications")
    .select(NOTIFICATION_FIELDS)
    .in("recipient_actor_id", actorIds)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (options.cursor) {
    const separator = options.cursor.indexOf("|");
    if (separator !== -1) {
      const created_at = options.cursor.slice(0, separator);
      const id = options.cursor.slice(separator + 1);
      query = query.or(`created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id})`);
    }
  }

  const [{ data, error }, unread] = await Promise.all([query, unreadQuery]);
  if (error) throw new Error(`Não foi possível carregar as notificações: ${error.message}`);

  const rows = (data ?? []) as unknown as NotificationRow[];
  const page = rows.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];

  return {
    items: page.map(toView),
    unread: unread.count ?? 0,
    hasMore: rows.length > PAGE_SIZE,
    nextCursor:
      rows.length > PAGE_SIZE && last ? `${last.created_at}|${last.id}` : null,
  };
}

type EmbeddedActor = Parameters<typeof toActorCard>[0];

type NotificationRow = {
  id: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
  post_id: string | null;
  actor: EmbeddedActor;
  post: { id: string; content: string | null; author: EmbeddedActor } | null;
};

function toView(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    type: row.type,
    read: row.read,
    created_at: row.created_at,
    actor: toActorCard(row.actor),
    post: row.post ? { id: row.post.id, content: row.post.content, exists: true } : null,
    target: row.post?.author ? toActorCard(row.post.author) : null,
  };
}
