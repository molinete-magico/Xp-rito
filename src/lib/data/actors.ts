import { toActorCard, type DataClient } from "@/lib/data/identities";
import type { Viewer } from "@/lib/session";
import type { ActorProfile, ActorSummary } from "@/lib/types";
import type { OrganizationType } from "@/types/database";

/** Perfis, contadores e o que o leitor pode fazer ali. */

const ACTOR_FIELDS =
  "id, display_name, username, avatar_url, banner_url, entity_type, character:characters(id, is_npc, bio, banner_url), organization:organizations(id, type, description, banner_url)";

export async function loadActorByUsername(
  client: DataClient,
  viewer: Viewer,
  username: string,
): Promise<ActorProfile | null> {
  const { data } = await client.from("actors").select(ACTOR_FIELDS).eq("username", username).maybeSingle();

  if (!data) return null;

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