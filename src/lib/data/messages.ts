import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { ActorSummary, ConversationCard, ConversationView, MessageView } from "@/lib/types";
import type { Viewer } from "@/lib/session";
import { toActorCard } from "@/lib/data/identities";
import { formatCursor, parseCursor } from "@/lib/data/posts";

/**
 * Mensagens privadas.
 *
 * O RLS já garante que só quem participa enxerga a conversa: quem não participa
 * recebe lista vazia, sem tratamento extra aqui. A caixa vem inteira de uma
 * função do banco (`dm_inbox`), porque a última mensagem de cada conversa e a
 * contagem de não lidas dependem de `last_read_at` — pedir isso pelo PostgREST
 * daria uma consulta por linha e a última mensagem errada na conversa parada.
 *
 * Este módulo é client-safe: só o cliente e tipos.
 */

export const ACTOR_FIELDS =
  "id, display_name, username, avatar_url, banner_url, avatar_position_x, avatar_position_y, banner_position_y, entity_type, character:characters(id, is_npc), organization:organizations(id, type)";

const MESSAGE_FIELDS = `id, content, created_at, actor_id, author:actors!dm_messages_actor_id_fkey(${ACTOR_FIELDS})`;

const CONVERSATION_FIELDS =
  "id, kind, title, last_message_at, participants:dm_participants(actor:actors!dm_participants_actor_id_fkey(" +
  ACTOR_FIELDS +
  "))";

export const MESSAGE_PAGE_SIZE = 30;

type InboxRow = {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  last_message_at: string;
  preview: string | null;
  unread: number;
  participants: Json;
};

type ConversationRow = {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  last_message_at: string;
  participants: { actor: Parameters<typeof toActorCard>[0] | null }[] | null;
};

type MessageRow = {
  id: string;
  content: string;
  created_at: string;
  actor_id: string;
  author: Parameters<typeof toActorCard>[0] | null;
};

/** Caixa de entrada: conversas com a última mensagem e as não lidas. */
export async function loadInbox(
  client: SupabaseClient<Database>,
  viewer: Viewer,
  limit = 50,
): Promise<ConversationCard[]> {
  const { data, error } = await client.rpc("dm_inbox", { p_limit: limit });
  if (error) {
    throw new Error(`Não foi possível carregar as conversas: ${error.message}`);
  }

  return ((data ?? []) as InboxRow[]).map((row) => toCard(row, viewer));
}

/**
 * Uma conversa aberta: participantes, cabeçalho e as mensagens mais recentes.
 *
 * `before` carrega a página anterior do histórico, no mesmo formato de cursor do
 * feed de publicações. A ausência de linha significa conversa inexistente ou
 * falta de participação — os dois casos são a mesma resposta para quem está na
 * tela, e é a melhor: confirmar a existência da conversa alheia seria vazamento.
 */
export async function loadConversation(
  client: SupabaseClient<Database>,
  viewer: Viewer,
  conversationId: string,
  options: { before?: string | null; limit?: number } = {},
): Promise<ConversationView | null> {
  const limit = options.limit ?? MESSAGE_PAGE_SIZE;
  const mine = identitySet(viewer);

  let query = client
    .from("dm_messages")
    .select(MESSAGE_FIELDS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (options.before) {
    const cursor = parseCursor(options.before);
    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
      );
    }
  }

  const [conversationResult, messageResult] = await Promise.all([
    client.from("dm_conversations").select(CONVERSATION_FIELDS).eq("id", conversationId).maybeSingle(),
    query,
  ]);

  if (conversationResult.error) {
    throw new Error(`Não foi possível carregar a conversa: ${conversationResult.error.message}`);
  }
  if (!conversationResult.data) return null;

  const conversation = conversationResult.data as unknown as ConversationRow;
  const participants = actorsOf(conversation.participants ?? []);
  const messages = (messageResult.data ?? []) as unknown as MessageRow[];

  return {
    id: conversation.id,
    kind: conversation.kind,
    title: titleOf(conversation, participants, mine),
    subtitle: subtitleOf(conversation, participants, mine),
    last_message_at: conversation.last_message_at,
    preview: messages[0]?.content ?? null,
    participants,
    unread: 0,
    messages: messages
      .slice(0, limit)
      .map((row) => toMessage(row, mine))
      .reverse(),
    hasMore: messages.length > limit,
  };
}

/**
 * Só o total de não lidas, para o selo da navegação.
 *
 * O Realtime avisa que algo mudou; quem conta é o banco, que conhece o
 * `last_read_at` de cada participante. Erro aqui vale zero: um selo errado é
 * melhor do que a navegação inteira fora do ar.
 */
export async function loadUnreadTotal(client: SupabaseClient<Database>): Promise<number> {
  const { data, error } = await client.rpc("dm_unread_counts");
  if (error) return 0;
  return ((data ?? []) as { conversation_id: string; unread: number }[]).reduce(
    (sum, row) => sum + Number(row.unread),
    0,
  );
}

/**
 * Quem pode ser convidado para uma conversa: as contas que a pessoa segue.
 *
 * A lista de quem já se segue é o universo razoável de um convite — o RLS só
 * recusa quem não existe, e convidar qualquer conta da mesa sem querer seria
 * abrir a conversa para o mundo.
 */
export async function loadMessageCandidates(
  client: SupabaseClient<Database>,
  viewer: Viewer,
  limit = 30,
): Promise<ActorSummary[]> {
  if (!viewer.activeActorId) return [];

  const { data } = await client
    .from("follows")
    .select(`following_id, actor:actors!follows_following_id_fkey(${ACTOR_FIELDS})`)
    .eq("follower_id", viewer.activeActorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as { actor: Parameters<typeof toActorCard>[0] | null }[])
    .filter((row) => row.actor)
    .map((row) => toActorCard(row.actor as Parameters<typeof toActorCard>[0]));
}

/**
 * O cursor do histórico é o mesmo do feed de publicações: created_at + id, do
 * mais novo para o mais antigo. Reaproveitado em vez de reescrito, para o
 * "carregar mais" da conversa ter a mesma semântica do feed.
 */
export function formatMessageCursor(createdAt: string, id: string): string {
  return formatCursor({ created_at: createdAt, id }) ?? "";
}

function toCard(row: InboxRow, viewer: Viewer): ConversationCard {
  const participants = parseParticipants(row.participants);
  return {
    id: row.id,
    kind: row.kind,
    title: titleOf(row, participants, identitySet(viewer)),
    last_message_at: row.last_message_at,
    preview: row.preview,
    participants,
    unread: Number(row.unread),
  };
}

function toMessage(row: MessageRow, mine: Set<string>): MessageView {
  return {
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    author: toActorCard(row.author ?? unknownActor),
    mine: mine.has(row.actor_id),
  };
}

function identitySet(viewer: Viewer): Set<string> {
  return new Set(viewer.identities.map((actor) => actor.id));
}

function parseParticipants(value: Json): ActorSummary[] {
  if (!Array.isArray(value)) return [];
  return (value as Parameters<typeof toActorCard>[0][]).filter(Boolean).map(toActorCard);
}

function actorsOf(rows: { actor: Parameters<typeof toActorCard>[0] | null }[]): ActorSummary[] {
  return rows.filter((row) => row.actor).map((row) => toActorCard(row.actor as Parameters<typeof toActorCard>[0]));
}

/**
 * Conversa direta mostra o nome de quem é o outro; grupo mostra o nome que quem
 * abriu deu. Num grupo também vale a lista de quem participa, que o subtítulo usa.
 */
export function titleOf(
  conversation: { kind: "direct" | "group"; title: string | null },
  participants: ActorSummary[],
  mine: Set<string>,
): string {
  if (conversation.kind === "group") return conversation.title ?? "Conversa";

  const others = participants.filter((actor) => !mine.has(actor.id));
  const other =
    others.length === 0
      ? "Conversa direta"
      : others.length === 1
        ? others[0].display_name
        : others.map((actor) => actor.display_name).join(", ");

  // O Mestre entra na mesma conversa por vários personagens, e a DM direta com
  // um deles fica idêntica à de qualquer jogador: a linha da caixa não dizia com
  // quem se está falando de verdade. O NPC que ele está usando entra entre
  // parênteses. Só o NPC, e só para quem o controla — uma DM entre jogadores
  // continua mostrando só o nome do outro, como sempre.
  const npcVoices = participants.filter((actor) => mine.has(actor.id) && actor.is_npc === true);
  if (npcVoices.length === 0) return other;
  return `${other} (${npcVoices.map((actor) => actor.display_name).join(", ")})`;
}

export function subtitleOf(
  conversation: { kind: "direct" | "group" },
  participants: ActorSummary[],
  mine: Set<string>,
): string {
  if (conversation.kind === "group") {
    if (participants.length === 0) return "Só você";
    const plural = participants.length === 1 ? "participante" : "participantes";
    return `${participants.map((actor) => actor.display_name).join(", ")} · ${participants.length} ${plural}`;
  }
  // Na DM direta o @ de quem lê não diz nada: ele sabe o próprio, e o do Mestre
  // era justamente o que embaralhava, porque "@Madn3S5 @henri" não diz qual dos
  // dois é ele. Fica o do outro, que é o que a tela precisa dizer.
  const others = participants.filter((actor) => !mine.has(actor.id));
  if (others.length === 0) return "";
  return others.map((actor) => `@${actor.username}`).join(" ");
}

const unknownActor: Parameters<typeof toActorCard>[0] = {
  id: "",
  display_name: "Conta removida",
  username: "removida",
  avatar_url: null,
  banner_url: null,
  avatar_position_x: 50,
  avatar_position_y: 50,
  banner_position_y: 50,
  entity_type: "character",
  character: null,
  organization: null,
};
