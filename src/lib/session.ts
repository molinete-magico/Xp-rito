import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadIdentities } from "@/lib/data/identities";
import { isSupabaseConfigured } from "@/lib/env";
import type { ActorSummary, ProfileRow } from "@/lib/types";

export { loadIdentities, toActorCard } from "@/lib/data/identities";

export const ACTIVE_ACTOR_COOKIE = "vertice-identidade";

export interface Viewer {
  userId: string;
  profile: ProfileRow;
  isGm: boolean;
  /** Todos os actors que esta pessoa pode usar como identidade. */
  identities: ActorSummary[];
  /** Actor com quem se está publicando agora (cookie). */
  activeActorId: string | null;
}

/**
 * Sessão do servidor.
 *
 * `requireViewer` é o portão de todas as páginas da rede; `requireGm` o da
 * área do Mestre.
 *
 * O resultado é memoizado por requisição: layout, página e componentes que
 * chamam `getViewer` compartilham a mesma consulta. A checagem de papel usa
 * `profiles.role`, que só o Mestre pode alterar, e mesmo assim o banco recusa a
 * escrita por caminho de cliente.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, role, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  const identities = await loadIdentities(supabase, user.id, profile.role === "gm");
  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_ACTOR_COOKIE)?.value ?? null;
  const activeActorId = identities.some((actor) => actor.id === requested)
    ? requested
    : (identities[0]?.id ?? null);

  return {
    userId: user.id,
    profile,
    isGm: profile.role === "gm",
    identities,
    activeActorId,
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requireGm(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isGm) redirect("/home");
  return viewer;
}

export function activeActorOf(viewer: Viewer): ActorSummary | null {
  return viewer.identities.find((actor) => actor.id === viewer.activeActorId) ?? null;
}