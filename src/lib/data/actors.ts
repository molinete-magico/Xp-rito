import { toActorCard, type DataClient } from "@/lib/data/identities";
import type { Viewer } from "@/lib/session";
import type { ActorProfile, ActorSummary } from "@/lib/types";
import type { OrganizationType } from "@/types/database";

/** Perfis, contadores e o que o leitor pode fazer ali. */

const ACTOR_FIELDS =
  "id, display_name, username, avatar_url, banner_url, avatar_position_x, avatar_position_y, banner_position_y, entity_type, character:characters(id, is_npc, bio, banner_url), organization:organizations(id, type, description, banner_url)";

export async function loadActorByUsername(
  client: DataClient,
  viewer: Viewer,
  username: string,
): Promise<ActorProfile | null> {
  // Caso-insensível: o @ mostra a caixa que o dono digitou, mas qualquer caixa
  // leva à mesma conta. `_` é coringa do LIKE, então neutralizamos primeiro e
  // conferimos o resultado na forma canônica por garantia.
  const pattern = username.replace(/_/g, "\\_");
  const { data } = await client.from("actors").select(ACTOR_FIELDS).ilike("username", pattern).maybeSingle();

  if (!data || data.username.toLowerCase() !== username.toLowerCase()) return null;

  return toProfile(client, viewer, data);
}

export async function loadActorById(
  client: DataClient,
  viewer: Viewer,
  actorId: string,
): Promise<ActorProfile | null> {
  const { data } = await client.from("actors").select(ACTOR_FIELDS).eq("id", actorId).maybeSingle();
  if (!data) return null;
  return toProfile(client, viewer, data);
}

type ActorRow = Parameters<typeof toActorCard>[0] & {
  character?: { id?: string; is_npc: boolean; bio: string | null; banner_url: string | null } | null;
  organization?: {
    id?: string;
    type: OrganizationType;
    description: string | null;
    banner_url: string | null;
  } | null;
};

async function toProfile(client: DataClient, viewer: Viewer, row: ActorRow): Promise<ActorProfile> {
  const isCharacter = row.entity_type === "character";

  const [postCount, followerCount, followingCount, likeCount, followingRow, editable] = await Promise.all([
    count(client.from("posts").select("id", { count: "exact", head: true }).eq("actor_id", row.id)),
    count(client.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", row.id)),
    count(client.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", row.id)),
    likesReceived(client, row.id),
    viewer.activeActorId
      ? client
          .from("follows")
          .select("follower_id")
          .eq("follower_id", viewer.activeActorId)
          .eq("following_id", row.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    viewer.isGm
      ? Promise.resolve(true)
      : client
          .rpc("can_edit_character", { target: toActorCard(row).entity_id })
          .then((result) => Boolean(result.data)),
  ]);

  const card = toActorCard(row);
  const selfId = viewer.activeActorId;

  return {
    ...card,
    bio: (isCharacter ? row.character?.bio : row.organization?.description) ?? null,
    entity: {
      id: card.entity_id,
      kind: row.entity_type,
      name: row.display_name,
      bio: (isCharacter ? row.character?.bio : row.organization?.description) ?? null,
      banner_url: (isCharacter ? row.character?.banner_url : row.organization?.banner_url) ?? null,
      is_npc: row.character?.is_npc ?? null,
      type: row.organization?.type ?? null,
    },
    stats: {
      posts: postCount,
      followers: followerCount,
      following: followingCount,
      likesReceived: likeCount,
    },
    viewer: {
      isSelf: selfId === row.id,
      // `isSelf` compara com o personagem aberto agora; este compara com todas as
      // identidades. O Mestre vendo o perfil do próprio NPC tem `isSelf` falso e
      // `isOwnIdentity` verdadeiro, e é a diferença entre "posso mandar mensagem
      // para ele" e "eu sou ele".
      isOwnIdentity: viewer.identities.some((identity) => identity.id === row.id),
      isFollowing: Boolean(followingRow.data),
      canEdit: Boolean(editable) && selfId !== null,
    },
  };
}

async function count(query: PromiseLike<{ count: number | null }>): Promise<number> {
  const { count: value } = await query;
  return value ?? 0;
}

async function likesReceived(client: DataClient, actorId: string): Promise<number> {
  const { data: posts } = await client.from("posts").select("id").eq("actor_id", actorId).limit(1000);
  const ids = (posts ?? []).map((post) => post.id);
  if (ids.length === 0) return 0;

  const { count } = await client
    .from("likes")
    .select("post_id", { count: "exact", head: true })
    .in("post_id", ids);
  return count ?? 0;
}

/**
 * Identidades sugeridas: as mais ativas que a pessoa ainda não segue. Uma
 * consulta só, sem N+1.
 */
export async function loadSuggestions(
  client: DataClient,
  viewer: Viewer,
  limit = 5,
): Promise<ActorSummary[]> {
  const { data } = await client
    .from("actors")
    .select(ACTOR_FIELDS)
    .neq("id", viewer.activeActorId ?? "")
    .order("created_at", { ascending: true })
    .limit(limit * 4);

  const candidates = (data ?? []).map((row) => toActorCard(row as unknown as ActorRow));

  if (viewer.activeActorId) {
    const { data: following } = await client
      .from("follows")
      .select("following_id")
      .eq("follower_id", viewer.activeActorId);
    const seen = new Set((following ?? []).map((row) => row.following_id));
    return candidates.filter((actor) => !seen.has(actor.id)).slice(0, limit);
  }

  return candidates.slice(0, limit);
}

/** Hashtags mais usadas, para a navegação inicial. */
export async function loadPopularHashtags(
  client: DataClient,
  limit = 8,
): Promise<{ name: string; posts: number }[]> {
  const { data } = await client
    .from("post_hashtags")
    .select("hashtag_id, hashtags!inner(name)")
    .limit(2000);

  const counts = new Map<number, { name: string; posts: number }>();

  for (const row of (data ?? []) as unknown as { hashtag_id: number; hashtags: { name: string } }[]) {
    const current = counts.get(row.hashtag_id);
    if (current) current.posts += 1;
    else counts.set(row.hashtag_id, { name: row.hashtags.name, posts: 1 });
  }

  return [...counts.values()].sort((a, b) => b.posts - a.posts).slice(0, limit);
}
export type ConnectionKind = "followers" | "following";

export interface Connection {
  actor: ActorSummary;
  /** O leitor já segue esta conta. */
  following: boolean;
}

/**
 * Conexões de uma conta: quem a segue, ou quem ela segue.
 *
 * Duas consultas, sem N+1: a lista vem de um embed de `follows` para `actors` e
 * o que o leitor segue dessa lista vem de outra. As duas colunas de `follows`
 * viram o mesmo embed trocando o nome da FK.
 */
export async function loadConnections(
  client: DataClient,
  viewer: Viewer,
  actorId: string,
  kind: ConnectionKind,
  limit = 50,
): Promise<Connection[]> {
  const byFollowers = kind === "followers";
  const { data } = await client
    .from("follows")
    .select(
      byFollowers
        ? `follower_id, actor:actors!follows_follower_id_fkey(${ACTOR_FIELDS})`
        : `following_id, actor:actors!follows_following_id_fkey(${ACTOR_FIELDS})`,
    )
    .eq(byFollowers ? "following_id" : "follower_id", actorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const actors = ((data ?? []) as unknown as { actor: ActorRow | null }[])
    .map((row) => row.actor)
    .filter((row): row is ActorRow => Boolean(row))
    .map((row) => toActorCard(row));

  if (actors.length === 0 || !viewer.activeActorId) {
    return actors.map((actor) => ({ actor, following: false }));
  }

  const { data: mine } = await client
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewer.activeActorId)
    .in(
      "following_id",
      actors.map((actor) => actor.id),
    );

  const seen = new Set(((mine ?? []) as { following_id: string }[]).map((row) => row.following_id));
  return actors.map((actor) => ({ actor, following: seen.has(actor.id) }));
}
