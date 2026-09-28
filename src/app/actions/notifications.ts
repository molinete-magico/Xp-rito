"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";

/**
 * Notificações.
 *
 * O INSERT é exclusivo dos triggers do banco: nenhum caminho de cliente cria
 * notificação. Aqui só se lê e se marca como lida, que é a única escrita
 * permitida pela política.
 */

export async function markNotificationsReadAction(notificationIds: string[]): Promise<void> {
  const viewer = await requireViewer();
  if (notificationIds.length === 0) return;

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .in("id", notificationIds)
    .in("recipient_actor_id", viewer.identities.map((actor) => actor.id));

  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const viewer = await requireViewer();
  const actorIds = viewer.identities.map((actor) => actor.id);
  if (actorIds.length === 0) return;

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("read", false)
    .in("recipient_actor_id", actorIds);

  revalidatePath("/notifications");
}
