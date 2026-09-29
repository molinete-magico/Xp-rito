// =============================================================================
// Tipos do banco
// =============================================================================
// Mantidos no formato exato que `supabase gen types typescript` produz, para
// que o comando abaixo sobrescreva este arquivo sem deixar divergência:
//
//   supabase gen types typescript --project-id <ref> > src/types/database.ts
//   (atalho: npm run db:types)
//
// Um detalhe que custa caro se alguém "limpar" o arquivo: as formas de linha
// são `type`, nunca `interface`. O supabase-js exige que elas satisfaçam
// `Record<string, unknown>`, e só um type alias de objeto recebe índice
// implícito — com `interface`, o `Database` inteiro deixa de satisfazer
// `GenericSchema` e toda consulta passa a ser `never` sem erro visível.
// =============================================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrganizationType =
  | "organization"
  | "institution"
  | "media"
  | "company"
  | "group"
  | "other";

export type NotificationType = "like" | "reply" | "follow" | "repost" | "mention";

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: "player" | "gm";
  created_at: string;
  updated_at: string;
}

export type CharacterRow = {
  id: string;
  owner_id: string | null;
  name: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  avatar_position_x: number;
  avatar_position_y: number;
  banner_position_y: number;
  is_npc: boolean;
  created_at: string;
  updated_at: string;
}

export type OrganizationRow = {
  id: string;
  name: string;
  username: string;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  avatar_position_x: number;
  avatar_position_y: number;
  banner_position_y: number;
  type: OrganizationType;
  created_at: string;
  updated_at: string;
}

export type ActorRow = {
  id: string;
  character_id: string | null;
  organization_id: string | null;
  display_name: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  avatar_position_x: number;
  avatar_position_y: number;
  banner_position_y: number;
  entity_type: "character" | "organization";
  created_at: string;
  updated_at: string;
}

export type PostRow = {
  id: string;
  actor_id: string;
  content: string | null;
  reply_to: string | null;
  repost_of: string | null;
  created_at: string;
  updated_at: string;
}

export type PostMediaRow = {
  id: string;
  post_id: string;
  storage_path: string;
  media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  width: number | null;
  height: number | null;
  alt_text: string;
  position: number;
  created_at: string;
}

export type LikeRow = {
  post_id: string;
  actor_id: string;
  created_at: string;
}

export type FollowRow = {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export type NotificationRow = {
  id: string;
  recipient_actor_id: string;
  actor_id: string;
  type: NotificationType;
  post_id: string | null;
  read: boolean;
  created_at: string;
}

export type HashtagRow = {
  id: number;
  name: string;
  created_at: string;
}

export type PostHashtagRow = {
  post_id: string;
  hashtag_id: number;
}

export type DmConversationRow = {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string;
  direct_key: string | null;
}

export type DmParticipantRow = {
  conversation_id: string;
  actor_id: string;
  joined_at: string;
  last_read_at: string;
  hidden: boolean;
}

export type DmMessageRow = {
  id: string;
  conversation_id: string;
  actor_id: string;
  content: string;
  kind: "text" | "system";
  created_at: string;
}

/**
 * Uma tabela do schema, com os relacionamentos que o PostgREST sabe resolver.
 *
 * `Relationships` não é decoração: sem as chaves estrangeiras declaradas aqui,
 * `select("author:actors(...)")` deixa de compilar e vira
 * `SelectQueryError<"could not find the relation">`. Os nomes em
 * `foreignKeyName` são os que o Postgres gerou — é por isso que o hint
 * `posts!notifications_post_id_fkey` funciona.
 */
type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Insert, Update, Relationships extends Rel[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        { id: string; username: string; display_name: string; avatar_url?: string | null; role?: "player" | "gm" },
        { username?: string; display_name?: string; avatar_url?: string | null; role?: "player" | "gm" }
      >;
      characters: Table<
        CharacterRow,
        { owner_id?: string | null; name: string; username: string; bio?: string | null; avatar_url?: string | null; banner_url?: string | null; avatar_position_x?: number; avatar_position_y?: number; banner_position_y?: number; is_npc?: boolean },
        { owner_id?: string | null; name?: string; username?: string; bio?: string | null; avatar_url?: string | null; banner_url?: string | null; avatar_position_x?: number; avatar_position_y?: number; banner_position_y?: number; is_npc?: boolean },
        [
          {
            foreignKeyName: "characters_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      organizations: Table<
        OrganizationRow,
        { name: string; username: string; description?: string | null; avatar_url?: string | null; banner_url?: string | null; avatar_position_x?: number; avatar_position_y?: number; banner_position_y?: number; type?: OrganizationType },
        { name?: string; username?: string; description?: string | null; avatar_url?: string | null; banner_url?: string | null; avatar_position_x?: number; avatar_position_y?: number; banner_position_y?: number; type?: OrganizationType }
      >;
      actors: Table<
        ActorRow,
        { character_id?: string | null; organization_id?: string | null; display_name: string; username: string; bio?: string | null; avatar_url?: string | null; banner_url?: string | null; avatar_position_x?: number; avatar_position_y?: number; banner_position_y?: number },
        { display_name?: string; username?: string; bio?: string | null; avatar_url?: string | null; banner_url?: string | null; avatar_position_x?: number; avatar_position_y?: number; banner_position_y?: number },
        [
          {
            foreignKeyName: "actors_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: true;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "actors_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ]
      >;
      posts: Table<
        PostRow,
        { actor_id: string; content?: string | null; reply_to?: string | null; repost_of?: string | null },
        { content?: string | null; reply_to?: string | null; repost_of?: string | null },
        [
          {
            foreignKeyName: "posts_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "actors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_reply_to_fkey";
            columns: ["reply_to"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_repost_of_fkey";
            columns: ["repost_of"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ]
      >;
      post_media: Table<
        PostMediaRow,
        { post_id: string; storage_path: string; media_type: PostMediaRow["media_type"]; width?: number | null; height?: number | null; alt_text?: string; position?: number },
        { alt_text?: string },
        [
          {
            foreignKeyName: "post_media_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ]
      >;
      likes: Table<
        LikeRow,
        { post_id: string; actor_id: string },
        { post_id?: string; actor_id?: string },
        [
          {
            foreignKeyName: "likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "likes_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "actors";
            referencedColumns: ["id"];
          },
        ]
      >;
      follows: Table<
        FollowRow,
        { follower_id: string; following_id: string },
        { follower_id?: string; following_id?: string },
        [
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "actors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_following_id_fkey";
            columns: ["following_id"];
            isOneToOne: false;
            referencedRelation: "actors";
            referencedColumns: ["id"];
          },
        ]
      >;
      notifications: Table<
        NotificationRow,
        { recipient_actor_id: string; actor_id: string; type: NotificationType; post_id?: string | null },
        { read?: boolean },
        [
          {
            foreignKeyName: "notifications_recipient_actor_id_fkey";
            columns: ["recipient_actor_id"];
            isOneToOne: false;
            referencedRelation: "actors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "actors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ]
      >;
      hashtags: Table<HashtagRow, { name: string }, { name?: string }>;
      post_hashtags: Table<
        PostHashtagRow,
        { post_id: string; hashtag_id: number },
        { post_id?: string; hashtag_id?: number },
        [
          {
            foreignKeyName: "post_hashtags_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey";
            columns: ["hashtag_id"];
            isOneToOne: false;
            referencedRelation: "hashtags";
            referencedColumns: ["id"];
          },
        ]
      >;
      dm_conversations: Table<
        DmConversationRow,
        { kind?: "direct" | "group"; title?: string | null; created_by: string; direct_key?: string | null },
        { title?: string | null },
        [
          {
            foreignKeyName: "dm_conversations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "actors";
            referencedColumns: ["id"];
          },
        ]
      >;
      dm_messages: Table<
        DmMessageRow,
        { conversation_id: string; actor_id: string; content: string; kind?: "text" | "system" },
        Record<never, never>,
        [
          {
            foreignKeyName: "dm_messages_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "actors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dm_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "dm_conversations";
            referencedColumns: ["id"];
          },
        ]
      >;
      dm_participants: Table<
        DmParticipantRow,
        { conversation_id: string; actor_id: string; hidden?: boolean },
        { last_read_at?: string; hidden?: boolean },
        [
          {
            foreignKeyName: "dm_participants_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "actors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dm_participants_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "dm_conversations";
            referencedColumns: ["id"];
          },
        ]
      >;
    };
    Views: Record<never, never>;
    Functions: {
      current_user_id: { Args: Record<never, never>; Returns: string | null };
      is_gm: { Args: Record<never, never>; Returns: boolean };
      owns_character: { Args: { target: string }; Returns: boolean };
      can_edit_character: { Args: { target: string }; Returns: boolean };
      owns_actor: { Args: { target: string }; Returns: boolean };
      can_manage_actor: { Args: { target: string }; Returns: boolean };
      can_manage_post: { Args: { target: string }; Returns: boolean };
      my_actor_ids: { Args: Record<never, never>; Returns: string[] };
      extract_hashtags: { Args: { source: string }; Returns: string[] };
      try_uuid: { Args: { value: string }; Returns: string | null };
      publish_post: {
        Args: {
          p_actor_id: string;
          p_content: string | null;
          p_reply_to?: string | null;
          p_repost_of?: string | null;
          p_media?: Json;
        };
        Returns: string;
      };
      count_unread_notifications: { Args: Record<never, never>; Returns: number };
      my_dm_actor_ids: { Args: Record<never, never>; Returns: string[] };
      owns_dm_actor: { Args: { target: string }; Returns: boolean };
      is_dm_participant: { Args: { target: string }; Returns: boolean };
      dm_start_direct: { Args: { sender_actor: string; target_actor: string }; Returns: string };
      dm_create_group: {
        Args: { sender_actor: string; group_title: string; members: string[] };
        Returns: string;
      };
      dm_unread_counts: {
        Args: Record<never, never>;
        Returns: { conversation_id: string; unread: number }[];
      };
      dm_inbox: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          kind: string;
          title: string | null;
          last_message_at: string;
          preview: string | null;
          unread: number;
          participants: Json;
        }[];
      };
      dm_mark_read: { Args: { target: string }; Returns: void };
      dm_hide: { Args: { target: string }; Returns: void };
      dm_clear: { Args: { target: string }; Returns: void };
    };
    Enums: {
      organization_type: OrganizationType;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
