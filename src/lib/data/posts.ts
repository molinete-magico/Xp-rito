import { toActorCard, type DataClient } from "@/lib/data/identities";
import type { Viewer } from "@/lib/session";
import type { ActorSummary, PostCard, PostMediaView, ReplyContext } from "@/lib/types";

/**
 * Leitura de publicações.
 *
 * Uma página custa um número fixo de consultas, sete no pior caso,
 * independentemente de quantos posts a página tenha. Não existe N+1: nem
 * componente nem função dispara uma consulta por item.
 *
 * Paginação por cursor (created_at, id) em ordem decrescente, o que continua
 * correta quando alguém publica durante a leitura, ao contrário de OFFSET.
 *
 * Repost não duplica conteúdo: o post original é buscado e exibido dentro do
 * cartão, e as ações apontam para ele.
 */

export const PAGE_SIZE = 20;

const ACTOR_FIELDS =
  "id, display_name, username, avatar_url, banner_url, entity_type, character:characters(id, is_npc), organization:organizations(id, type)";

const POST_FIELDS = `id, actor_id, content, reply_to, repost_of, created_at, updated_at, author:actors!posts_actor_id_fkey(${ACTOR_FIELDS})`;

const MEDIA_FIELDS = "id, post_id, storage_path, media_type, width, height, alt_text, position";

export interface Cursor {
  created_at: string;
  id: string;
}

export function parseCursor(value: string | undefined | null): Cursor | null {
  if (!value) return null;
  const separator = value.indexOf("|");
  if (separator === -1) return null;
  return { created_at: value.slice(0, separator), id: value.slice(separator + 1) };
}

export function formatCursor(cursor: { created_at: string; id: string } | null): string | null {
  return cursor ? `${cursor.created_at}|${cursor.id}` : null;
}

type PostRow = {
  id: string;
  actor_id: string;
  content: string | null;
  reply_to: string | null;
  repost_of: string | null;
  created_at: string;
  updated_at: string;
  author: Parameters<typeof toActorCard>[0];
};

export type PostScope =
  | { kind: "recentes" }
  | { kind: "identidades"; actorIds: string[] }
  | { kind: "seguindo"; actorIds: string[] }
  | { kind: "ator"; actorId: string }
  | { kind: "respostas"; postId: string }
  | { kind: "respostas-do-ator"; actorId: string }
  | { kind: "reposts-do-ator"; actorId: string }
  | { kind: "hashtag"; name: string }
  | { kind: "busca"; term: string };

type Client = DataClient;

const EMPTY_PAGE: PostPage = { posts: [], nextCursor: null, hasMore: false };
export interface PostPage {
  posts: PostCard[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Escopos em que respostas e reposts ficam de fora do fluxo principal. */
const EXCLUDES_THREADED = new Set<PostScope["kind"]>([
  "recentes",
  "identidades",
  "seguindo",
  "busca",
]);

export async function loadPosts(
  client: DataClient,
  viewer: Viewer,
  scope: PostScope,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<PostPage> {
  const limit = options.limit ?? PAGE_SIZE;
  const cursor = parseCursor(options.cursor);

  const { rows, hasMore } = await fetchPage(client, scope, limit, cursor);
  if (rows.length === 0) return { ...EMPTY_PAGE, hasMore };

  const last = rows[rows.length - 1];
  const posts = await hydrate(client, viewer, rows);

  return {
    posts,
    hasMore,
    nextCursor: hasMore ? formatCursor({ created_at: last.created_at, id: last.id }) : null,
  };
}

async function fetchPage(client: Client, scope: PostScope, limit: number, cursor: Cursor | null) {
  let query = client.from("posts").select(POST_FIELDS);

  switch (scope.kind) {
    case "recentes":
      break;
    case "identidades": {
      if (scope.actorIds.length === 0) return { rows: [] as PostRow[], hasMore: false };
      query = query.in("actor_id", scope.actorIds);
      break;
    }
    case "seguindo": {
      if (scope.actorIds.length === 0) return { rows: [] as PostRow[], hasMore: false };
      const { data } = await client.from("follows").select("following_id").in("follower_id", scope.actorIds);
      const following = [...new Set((data ?? []).map((row) => row.following_id))];
      if (following.length === 0) return { rows: [] as PostRow[], hasMore: false };
      query = query.in("actor_id", following);
      break;
    }
    case "ator":
      query = query.eq("actor_id", scope.actorId);
      break;
    case "respostas":
      query = query.eq("reply_to", scope.postId);
      break;
    case "respostas-do-ator":
      query = query.eq("actor_id", scope.actorId).not("reply_to", "is", null);
      break;
    case "reposts-do-ator":
      query = query.eq("actor_id", scope.actorId).not("repost_of", "is", null);
      break;
    case "hashtag": {
      const ids = await postIdsForHashtag(client, scope.name);
      if (ids.length === 0) return { rows: [] as PostRow[], hasMore: false };
      query = query.in("id", ids);
      break;
    }
    case "busca":
      query = query.ilike("content", `%${escapeLike(scope.term)}%`);
      break;
  }

  if (EXCLUDES_THREADED.has(scope.kind)) {
    query = query.is("reply_to", null);
  }

  query = query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`Não foi possível carregar as publicações: ${error.message}`);

  const rows = (data ?? []) as unknown as PostRow[];
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function loadPostById(
  client: DataClient,
  viewer: Viewer,
  postId: string,
): Promise<PostCard | null> {
  const cards = await loadPostsByIds(client, viewer, [postId]);
  return cards.get(postId) ?? null;
}

export async function loadPostsByIds(
  client: DataClient,
  viewer: Viewer,
  ids: string[],
): Promise<Map<string, PostCard>> {
  if (ids.length === 0) return new Map();

  const { data } = await client.from("posts").select(POST_FIELDS).in("id", ids);
  const rows = (data ?? []) as unknown as PostRow[];
  const cards = await hydrate(client, viewer, rows);
  return new Map(cards.map((card) => [card.id, card]));
}

/** Respostas de um post, em ordem cronológica (a mais antiga primeiro). */
export async function loadReplies(
  client: DataClient,
  viewer: Viewer,
  postId: string,
  limit = 50,
): Promise<PostCard[]> {
  const page = await loadPosts(client, viewer, { kind: "respostas", postId }, { limit });
  return [...page.posts].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Hidratação em lote: contadores, mídia, interação do leitor e o post citado
 * pelas respostas. Roda sempre com um número fixo de consultas, sem N+1.
 */
async function hydrate(client: Client, viewer: Viewer, rows: PostRow[]): Promise<PostCard[]> {
  if (rows.length === 0) return [];

  // Um nível: os originais dos reposts e os posts citados pelas respostas. Dois
  // níveis: o citado de um original repostado, para a prévia sair completa.
  const related = await loadRelated(client, unique(rows.flatMap((row) => [row.repost_of, row.reply_to])));
  const secondLevel = await loadRelated(
    client,
    unique([...related.values()].map((row) => row.reply_to)).filter((id) => !related.has(id)),
  );
  const relatedById = new Map([...related.values(), ...secondLevel.values()].map((row) => [row.id, row]));

  const allIds = unique([...rows.map((row) => row.id), ...relatedById.keys()]);

  const [mediaResult, likesResult, repliesResult, repostsResult] = await Promise.all([
    client.from("post_media").select(MEDIA_FIELDS).in("post_id", allIds),
    client.from("likes").select("post_id, actor_id").in("post_id", allIds),
    client.from("posts").select("id, reply_to").in("reply_to", allIds),
    client.from("posts").select("id, repost_of, actor_id").in("repost_of", allIds),
  ]);

  const mediaByPost = groupBy(mediaResult.data ?? [], (row) => row.post_id);
  const likesByPost = groupBy(likesResult.data ?? [], (row) => row.post_id);
  const repliesByPost = groupBy(repliesResult.data ?? [], (row) => row.reply_to as string);
  const repostsByPost = groupBy(repostsResult.data ?? [], (row) => row.repost_of as string);

  const viewerActorIds = new Set(viewer.identities.map((actor) => actor.id));

  const describe = (row: PostRow) => {
    const postLikes = likesByPost.get(row.id) ?? [];
    const postReposts = repostsByPost.get(row.id) ?? [];
    return {
      author: toActorCard(row.author),
      media: orderMedia(mediaByPost.get(row.id) ?? []),
      stats: {
        replies: (repliesByPost.get(row.id) ?? []).length,
        reposts: postReposts.length,
        likes: postLikes.length,
      },
      viewer: {
        liked: postLikes.some((like) => viewerActorIds.has(like.actor_id as string)),
        reposted: postReposts.some((repost) => viewerActorIds.has(repost.actor_id as string)),
        canDelete: viewer.isGm || viewerActorIds.has(toActorCard(row.author).id),
      },
      edited: row.updated_at !== row.created_at,
    };
  };

  const previewOf = (parentId: string | null): ReplyContext | null => {
    if (!parentId) return null;
    const parent = relatedById.get(parentId);
    if (!parent) return null;
    return {
      author: toActorCard(parent.author),
      post: {
        id: parent.id,
        content: parent.content,
        created_at: parent.created_at,
        media: orderMedia(mediaByPost.get(parent.id) ?? []),
        isReply: Boolean(parent.reply_to),
      },
    };
  };

  return rows.map((row) => {
    const described = describe(row);
    const base = {
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
      reply_to: row.reply_to,
      repost_of: row.repost_of,
      edited: described.edited,
    };

    if (row.repost_of) {
      const original = relatedById.get(row.repost_of);
      if (original) {
        const originalDescribed = describe(original);
        return {
          ...base,
          id: row.id,
          author: described.author,
          media: [],
          stats: originalDescribed.stats,
          // Ações apontam para o post original.
          viewer: originalDescribed.viewer,
          reposted: {
            author: originalDescribed.author,
            post: {
              ...baseFor(original),
              author: originalDescribed.author,
              media: originalDescribed.media,
              stats: originalDescribed.stats,
              viewer: originalDescribed.viewer,
              edited: originalDescribed.edited,
              reposted: null,
              repliedTo: previewOf(original.reply_to),
            },
          },
          repliedTo: null,
        } satisfies PostCard;
      }
    }

    return {
      ...base,
      id: row.id,
      author: described.author,
      media: described.media,
      stats: described.stats,
      viewer: described.viewer,
      reposted: null,
      repliedTo: previewOf(row.reply_to),
    } satisfies PostCard;
  });
}

/** Posts citados, em uma consulta por nível pedido. */
async function loadRelated(client: Client, ids: string[]): Promise<Map<string, PostRow>> {
  if (ids.length === 0) return new Map();
  const { data } = await client.from("posts").select(POST_FIELDS).in("id", ids);
  return new Map(((data ?? []) as unknown as PostRow[]).map((row) => [row.id, row]));
}

function baseFor(row: PostRow) {
  return {
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    reply_to: row.reply_to,
    repost_of: row.repost_of,
  };
}

async function postIdsForHashtag(client: Client, name: string): Promise<string[]> {
  const normalized = name.replace(/^#/, "").toLowerCase();

  const { data: hashtag } = await client
    .from("hashtags")
    .select("id")
    .eq("name", normalized)
    .maybeSingle();

  if (!hashtag) return [];

  const { data } = await client
    .from("post_hashtags")
    .select("post_id")
    .eq("hashtag_id", hashtag.id)
    .limit(500);

  return (data ?? []).map((row) => row.post_id);
}

/** O PostgREST trata % e _ como coringa; neutralizamos no termo do usuário. */
function escapeLike(term: string): string {
  return term.replace(/[%_\\,()]/g, " ").trim();
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    if (!id) continue;
    const bucket = map.get(id);
    if (bucket) bucket.push(row);
    else map.set(id, [row]);
  }
  return map;
}

function orderMedia(rows: { position: number }[]): PostMediaView[] {
  return [...rows].sort((a, b) => a.position - b.position) as PostMediaView[];
}

export type { ActorSummary };
