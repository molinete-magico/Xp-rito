import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { loadIdentities, type DataClient } from "@/lib/data/identities";
import type { Viewer } from "@/lib/session";

/**
 * Sessão no navegador.
 *
 * Espelha a `getViewer` do servidor usando o cliente público `anon`: o banco
 * autoriza pela sessão que o @supabase/ssr guarda nos cookies, com as mesmas
 * regras de RLS. É o que permite ao shell e aos feeds buscarem seus dados
 * depois de a página ser pré-renderizada.
 */

export type BrowserClient = SupabaseClient<Database>;

export async function buildClientViewer(client: DataClient): Promise<Viewer | null> {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return null;

  const { data: profile } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url, role, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  const identities = await loadIdentities(client, user.id, profile.role === "gm");
  const activeActorId = identities[0]?.id ?? null;

  return {
    userId: user.id,
    profile,
    isGm: profile.role === "gm",
    identities,
    activeActorId,
  };
}