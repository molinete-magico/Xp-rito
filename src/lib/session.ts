import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationType } from "@/types/database";
import { isSupabaseConfigured } from "@/lib/env";
import type { ActorSummary, ProfileRow } from "@/lib/types";

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

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const ACTOR_FIELDS =
  "id, display_name, username, avatar_url, banner_url, entity_type, character:characters(id, is_npc), organization:organizations(id, type)";

/**
 * Identidades disponíveis para a pessoa.
 *
 * Um jogador recebe apenas os próprios personagens. O Mestre recebe os próprios
 * personagens, os NPCs e as organizações. A lista é montada a partir de dados que
 * o RLS já filtra; e, mesmo que alguém tentasse usar uma identidade alheia,
 * `public.can_manage_actor` nega a publicação.
 */
export async function loadIdentities(client: SupabaseClient, userId: string, isGm: boolean) {
  const characterQuery = client
    .from("characters")
    .select("id")
    .eq("owner_id", userId);

  const { data: ownedCharacters } = await characterQuery;

  const characterIds = (ownedCharacters ?? []).map((row) => row.id);
  let npcIds: string[] = [];
  let organizationIds: string[] = [];

  if (isGm) {
    const [npcs, organizations] = await Promise.all([
      client.from("characters").select("id").eq("is_npc", true).is("owner_id", null),
      client.from("organizations").select("id"),
    ]);
    npcIds = (npcs.data ?? []).map((row) => row.id);
    organizationIds = (organizations.data ?? []).map((row) => row.id);
  }

  const allCharacterIds = [...new Set([...characterIds, ...npcIds])];
  const filters: string[] = [];
  if (allCharacterIds.length > 0) filters.push(`character_id.in.(${allCharacterIds.join(",")})`);
  if (organizationIds.length > 0) filters.push(`organization_id.in.(${organizationIds.join(",")})`);

  if (filters.length === 0) return [];

  const { data } = await client
    .from("actors")
    .select(ACTOR_FIELDS)
    .or(filters.join(","))
    .order("display_name");

  return (data ?? []).map(toActorCard);
}

/** Normaliza a linha do PostgREST (com embeds) para o formato de domínio. */
export function toActorCard(row: {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  entity_type: "character" | "organization";
  character?: { id?: string; is_npc: boolean } | { id?: string; is_npc: boolean }[] | null;
  organization?: { id?: string; type: OrganizationType } | { id?: string; type: OrganizationType }[] | null;
}): ActorSummary {
  const character = first(row.character);
  const organization = first(row.organization);
  return {
    id: row.id,
    entity_id: (row.entity_type === "character" ? character?.id : organization?.id) ?? row.id,
    display_name: row.display_name,
    username: row.username,
    avatar_url: row.avatar_url,
    banner_url: row.banner_url,
    entity_type: row.entity_type,
    is_npc: character?.is_npc ?? null,
    organization_type: organization?.type ?? null,
  };
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

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
