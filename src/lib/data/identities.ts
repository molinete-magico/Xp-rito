import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OrganizationType } from "@/types/database";
import type { ActorSummary } from "@/lib/types";
import type { Viewer } from "@/lib/session";

export type DataClient = SupabaseClient<Database>;

const ACTOR_FIELDS =
  "id, display_name, username, avatar_url, banner_url, avatar_position_x, avatar_position_y, banner_position_y, entity_type, character:characters(id, is_npc), organization:organizations(id, type)";

/**
 * Identidades disponíveis para a pessoa.
 *
 * Um jogador recebe apenas os próprios personagens. O Mestre recebe os próprios
 * personagens, os NPCs e as organizações. A lista é montada a partir de dados que
 * o RLS já filtra; e, mesmo que alguém tentasse usar uma identidade alheia,
 * `public.can_manage_actor` nega a publicação.
 *
 * Este módulo é client-safe: só depende do cliente Supabase e de tipos.
 */
export async function loadIdentities(
  client: DataClient,
  userId: string,
  isGm: boolean,
): Promise<ActorSummary[]> {
  const characterQuery = client.from("characters").select("id").eq("owner_id", userId);

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

/**
 * Identidades com que a pessoa pode falar numa conversa.
 *
 * Um jogador fala como os próprios personagens. O Mestre também fala como os NPCs
 * da mesa, mas só os que JÁ estão na conversa: a voz é por conversa, senão o
 * Mestre entraria em conversa alheia. Por isso o filtro cruza os participantes da
 * conversa com quem a pessoa pode comandar (o próprio personagem, ou NPC se GM).
 *
 * O banco (public.dm_speaker_ids e a política de insert) é a autoridade; aqui só
 * montamos as opções da tela e escolhemos um remetente inicial.
 */
export function dmSpeakerCandidates(
  viewer: Viewer,
  participants: ActorSummary[],
): ActorSummary[] {
  const canCommand = new Set(
    viewer.identities
      .filter((actor) => actor.entity_type === "character" && (actor.is_npc !== true || viewer.isGm))
      .map((actor) => actor.id),
  );
  return participants.filter((actor) => actor.entity_type === "character" && canCommand.has(actor.id));
}

/**
 * Personagens com que a pessoa pode dar voz em qualquer conversa, e que por isso
 * podem abrir uma. Sem conversa em mãos (abrir conversa direta, criar grupo) não
 * dá para filtrar pelos participantes, então a lista é a do próprio usuário. Para
 * o Mestre, isso inclui os NPCs da mesa.
 */
export function dmVoiceIdentities(viewer: Viewer): ActorSummary[] {
  return viewer.identities.filter(
    (actor) => actor.entity_type === "character" && (actor.is_npc !== true || viewer.isGm),
  );
}

/**
 * Escolhe o remetente de uma ação que não tem conversa carregada: usa o que veio
 * do formulário quando é uma voz válida, senão o personagem ativo. Serve para
 * abrir conversa e criar grupo, onde a conversa ainda não existe.
 */
export function dmSenderChoice(viewer: Viewer, senderActorId?: string | null): ActorSummary | null {
  const voices = dmVoiceIdentities(viewer);
  const wanted = senderActorId ? voices.find((actor) => actor.id === senderActorId) : null;
  return wanted ?? voices.find((actor) => actor.id === viewer.activeActorId) ?? voices[0] ?? null;
}

/** Normaliza a linha do PostgREST (com embeds) para o formato de domínio. */
export function toActorCard(row: {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  avatar_position_x: number;
  avatar_position_y: number;
  banner_position_y: number;
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
    avatar_position_x: row.avatar_position_x,
    avatar_position_y: row.avatar_position_y,
    banner_position_y: row.banner_position_y,
    entity_type: row.entity_type,
    is_npc: character?.is_npc ?? null,
    organization_type: organization?.type ?? null,
  };
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}