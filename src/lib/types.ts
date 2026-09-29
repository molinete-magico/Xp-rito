import type { NotificationType, OrganizationType, PostMediaRow } from "@/types/database";

export type {
  ActorRow,
  CharacterRow,
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
  /** Preenchido quando o post é uma resposta: quem é o autor do original. */
  replyContext: { username: string; display_name: string } | null;
  edited: boolean;
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
    isFollowing: boolean;
    /** Pode editar: dono do personagem ou Mestre. */
    canEdit: boolean;
  };
}
