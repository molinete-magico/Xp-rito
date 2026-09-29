import type { NotificationType, OrganizationType, PostMediaRow } from "@/types/database";

export type {
  ActorRow,
  CharacterRow,
  DmConversationRow,
  DmMessageRow,
  DmParticipantRow,
  FollowRow,
  HashtagRow,
  LikeRow,
  NotificationRow,
  OrganizationRow,
  PostHashtagRow,
  PostMediaRow,
  PostRow,
  ProfileRow,
} from "@/types/database";

/**
 * Tipos de domínio: o que a interface realmente consome. São o resultado das
 * consultas de `src/lib/data`, já achatadas, porque os componentes nunca montam
 * joins por conta própria.
 */

export interface ActorSummary {
  id: string;
  /** Id da linha em `characters` ou `organizations` que originou este actor. */
  entity_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  /** Foco da foto, em % do `object-position` (50/50 = centro). */
  avatar_position_x: number;
  avatar_position_y: number;
  /** Foco vertical da capa, em % do `object-position` (50 = centro). */
  banner_position_y: number;
  entity_type: "character" | "organization";
  /** Preenchido quando o actor é um personagem. */
  is_npc: boolean | null;
  /** Preenchido quando o actor é uma entidade organizacional. */
  organization_type: OrganizationType | null;
}

export type PostMediaView = Pick<
  PostMediaRow,
  "id" | "storage_path" | "media_type" | "width" | "height" | "alt_text" | "position"
>;

export interface PostStats {
  replies: number;
  reposts: number;
  likes: number;
}

/** O que o leitor pode fazer com este post. */
export interface ViewerInteraction {
  liked: boolean;
  reposted: boolean;
  /** O autor (ou o Mestre) pode apagar. */
  canDelete: boolean;
  canEdit: boolean;
}

export interface PostCard {
  id: string;
  content: string | null;
  created_at: string;
  updated_at: string;
  reply_to: string | null;
  repost_of: string | null;
  author: ActorSummary;
  media: PostMediaView[];
  stats: PostStats;
  viewer: ViewerInteraction;
  /**
   * Preenchido quando o post é um repost: o original, com autor, mídia e
   * contadores próprios. Nunca há repost de repost, então o tipo é o mesmo.
   */
  reposted: { post: PostCard; author: ActorSummary } | null;
  /**
   * Preenchido quando o post é uma resposta: o post citado, desenhado acima da
   * resposta como o Twitter faz. O avô não entra — um nível só, como lá.
   */
  repliedTo: ReplyContext | null;
  edited: boolean;
}

/** O post ao qual uma resposta responde, para a prévia acima dela. */
export interface ReplyContext {
  post: {
    id: string;
    content: string | null;
    created_at: string;
    media: PostMediaView[];
    /** O citado também é resposta: a prévia não desenha o que vem antes dele. */
    isReply: boolean;
  };
  author: ActorSummary;
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
  /** Quem provocou. */
  actor: ActorSummary;
  /** Publicação citada, quando houver. */
  post: { id: string; content: string | null; exists: boolean } | null;
  /** Autor da publicação citada, para a linha de resumo. */
  target: ActorSummary | null;
}

/** Uma mensagem na conversa. */
export interface MessageView {
  id: string;
  content: string;
  created_at: string;
  author: ActorSummary;
  /** A mensagem sai com as identidades do próprio usuário à direita. */
  mine: boolean;
  status?: "pending" | "failed";
  error?: string;
}

export interface ConversationCard {
  id: string;
  kind: "direct" | "group";
  title: string;
  last_message_at: string;
  /** Última mensagem, para a linha de resumo da caixa. */
  preview: string | null;
  /** Quem participa, para o título e o avatar da conversa direta. */
  participants: ActorSummary[];
  unread: number;
}

/** Uma conversa aberta, com o que a thread precisa para se desenhar. */
export interface ConversationView extends ConversationCard {
  /** O que o cabeçalho mostra acima do histórico. */
  subtitle: string;
  messages: MessageView[];
  /** Tem conversa anterior para carregar com o "carregar mais". */
  hasMore: boolean;
}

export interface ActorProfile extends ActorSummary {
  bio: string | null;
  entity: {
    id: string;
    kind: "character" | "organization";
    name: string;
    bio: string | null;
    banner_url: string | null;
    /** Somente personagens. */
    is_npc: boolean | null;
    /** Somente organizações. */
    type: OrganizationType | null;
  };
  stats: {
    posts: number;
    followers: number;
    following: number;
    likesReceived: number;
  };
  viewer: {
    isSelf: boolean;
    /** Uma das identidades de quem olha. Para o Mestre, o próprio NPC. */
    isOwnIdentity: boolean;
    isFollowing: boolean;
    /** Pode editar: dono do personagem ou Mestre. */
    canEdit: boolean;
  };
}
