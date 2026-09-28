-- =============================================================================
-- twitter espiritual — estrutura inicial do schema
-- =============================================================================
-- Nota sobre multi-RPG: hoje há um único RPG e um único banco, e as tabelas não
-- possuem rpg_id. A migração para múltiplos RPGs consiste em criar
-- `rpgs`/`rpg_members`, adicionar `rpg_id` (default = rpg único) e particionar
-- as políticas por rpg_members. Nada aqui impede esse caminho: todas as
-- entidades são referenciadas por id e não carregam identificadores compostos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Domínios
-- -----------------------------------------------------------------------------
-- O formato do @handle é definido em um único lugar no banco. O espelho em
-- TypeScript vive em `src/lib/validation/username.ts`, e a paridade entre os
-- dois é verificada em `tests/username-parity.test.ts`.
create domain public.username_t as text
  constraint username_charset check (value ~ '^[a-z0-9._]{3,30}$')
  constraint username_no_edge_dot check (value !~ '^\.' and value !~ '\.$')
  constraint username_no_double_dot check (value !~ '\.\.');

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.organization_type as enum (
  'organization',
  'institution',
  'media',
  'company',
  'group',
  'other'
);

create type public.notification_type as enum (
  'like',
  'reply',
  'follow',
  'repost',
  'mention'
);

-- -----------------------------------------------------------------------------
-- profiles — a conta real (autenticada) do jogador ou do Mestre
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     public.username_t not null,
  display_name text not null constraint profiles_display_name_len check (char_length(display_name) between 1 and 80),
  avatar_url   text,
  role         text not null default 'player' constraint profiles_role check (role in ('player', 'gm')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_username_key unique (username)
);

comment on table public.profiles is 'Conta real do usuário. Não é a identidade pública dentro do RPG.';
comment on column public.profiles.role is 'Papel do usuário na mesa. Atribuído somente pelo Mestre.';

-- -----------------------------------------------------------------------------
-- characters — personagens de jogadores e NPCs
-- -----------------------------------------------------------------------------
create table public.characters (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references public.profiles (id) on delete cascade,
  name       text not null constraint characters_name_len check (char_length(name) between 1 and 80),
  username   public.username_t not null constraint characters_username_key unique,
  bio        text constraint characters_bio_len check (bio is null or char_length(bio) <= 300),
  avatar_url text,
  banner_url text,
  is_npc     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- owner_id nulo = controlado pelo Mestre, portanto marcado como NPC. A
  -- autorização nunca depende de is_npc: o personagem continua sendo do jogador
  -- mesmo que alguém marque is_npc.
  constraint characters_owner_shape check (owner_id is not null or is_npc)
);

comment on table public.characters is 'Personagens de jogadores (owner_id preenchido) e NPCs (owner_id nulo, sob controle do Mestre).';

create index characters_owner_id_idx on public.characters (owner_id) where owner_id is not null;

-- -----------------------------------------------------------------------------
-- organizations — organizações, instituições, veículos de mídia, empresas
-- -----------------------------------------------------------------------------
-- Sempre controladas pelo Mestre: não possuem owner_id.
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null constraint organizations_name_len check (char_length(name) between 1 and 80),
  username    public.username_t not null constraint organizations_username_key unique,
  description text constraint organizations_description_len check (description is null or char_length(description) <= 500),
  avatar_url  text,
  banner_url  text,
  type        public.organization_type not null default 'organization',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.organizations is 'Entidades narrativas sem avatar humano. Sempre sob controle do Mestre.';

-- -----------------------------------------------------------------------------
-- actors — a identidade social genérica (quem publica, curte, segue)
-- -----------------------------------------------------------------------------
-- Um actor representa exatamente uma entidade: um character OU uma
-- organization. As colunas de apresentação (display_name, username, bio,
-- avatar_url, banner_url) são espelho das colunas da entidade e são mantidas por
-- trigger. Clientes nunca escrevem diretamente nesta tabela, o que impede estado
-- inconsistente.
create table public.actors (
  id              uuid primary key default gen_random_uuid(),
  character_id    uuid references public.characters (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  display_name    text not null constraint actors_display_name_len check (char_length(display_name) between 1 and 80),
  username        public.username_t not null constraint actors_username_key unique,
  bio             text constraint actors_bio_len check (bio is null or char_length(bio) <= 500),
  avatar_url      text,
  banner_url      text,
  entity_type     text generated always as (
                    case when character_id is not null then 'character' else 'organization' end
                  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Consistência estrutural: exatamente uma entidade por actor.
  constraint actors_single_entity check (num_nonnulls(character_id, organization_id) = 1),
  -- Um actor por entidade.
  constraint actors_character_id_key unique (character_id),
  constraint actors_organization_id_key unique (organization_id)
);

comment on table public.actors is 'Identidade social. Espelho de presentation de characters/organizations, mantido por trigger.';
comment on column public.actors.entity_type is 'Coluna gerada: character | organization. Dispensa join para exibir o tipo da conta.';

-- -----------------------------------------------------------------------------
-- posts
-- -----------------------------------------------------------------------------
create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid not null references public.actors (id) on delete cascade,
  content    text constraint posts_content_len check (content is null or char_length(content) <= 1000),
  reply_to   uuid references public.posts (id) on delete cascade,
  repost_of  uuid references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ou é uma publicação com texto, ou é um repost.
  constraint posts_has_content_or_repost check (
    (reply_to is not null or repost_of is not null) or (content is not null and char_length(btrim(content)) > 0)
  ),
  -- Um post é resposta OU repost, nunca os dois.
  constraint posts_reply_xor_repost check (not (reply_to is not null and repost_of is not null)),
  constraint posts_not_self_reply check (reply_to is distinct from id),
  constraint posts_not_self_repost check (repost_of is distinct from id)
);

comment on table public.posts is 'Publicações. Respostas e reposts referenciam o post de origem; o conteúdo original nunca é duplicado.';

-- Feed principal: ordenação cronológica global, permite paginação por cursor.
create index posts_created_at_id_idx on public.posts (created_at desc, id desc);
-- Feed "quem sigo": filtro por actor + ordenação cronológica.
create index posts_actor_created_at_idx on public.posts (actor_id, created_at desc);
create index posts_reply_to_idx on public.posts (reply_to) where reply_to is not null;
create index posts_repost_of_idx on public.posts (repost_of) where repost_of is not null;

-- -----------------------------------------------------------------------------
-- post_media
-- -----------------------------------------------------------------------------
create table public.post_media (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  storage_path text not null constraint post_media_path_len check (char_length(storage_path) between 1 and 512),
  media_type   text not null constraint post_media_type check (media_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  width        integer constraint post_media_width check (width is null or width > 0),
  height       integer constraint post_media_height check (height is null or height > 0),
  alt_text     text not null default '' constraint post_media_alt_len check (char_length(alt_text) <= 300),
  position     smallint not null default 0 constraint post_media_position check (position between 0 and 3),
  created_at   timestamptz not null default now(),

  constraint post_media_post_position_key unique (post_id, position)
);

comment on table public.post_media is 'Referências a objetos do Supabase Storage. Nenhum blob é armazenado no PostgreSQL.';

-- -----------------------------------------------------------------------------
-- likes
-- -----------------------------------------------------------------------------
create table public.likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  actor_id   uuid not null references public.actors (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint likes_pkey primary key (post_id, actor_id)
);

comment on constraint likes_pkey on public.likes is 'Garante no banco que um actor só curte um post uma vez.';

create index likes_actor_id_idx on public.likes (actor_id);

-- -----------------------------------------------------------------------------
-- follows
-- -----------------------------------------------------------------------------
create table public.follows (
  follower_id  uuid not null references public.actors (id) on delete cascade,
  following_id uuid not null references public.actors (id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint follows_pkey primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index follows_following_id_idx on public.follows (following_id);

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  recipient_actor_id uuid not null references public.actors (id) on delete cascade,
  actor_id           uuid not null references public.actors (id) on delete cascade,
  type              public.notification_type not null,
  post_id           uuid references public.posts (id) on delete cascade,
  read              boolean not null default false,
  created_at        timestamptz not null default now(),

  constraint notifications_no_self check (recipient_actor_id <> actor_id),
  constraint notifications_mention_requires_post check (type <> 'mention' or post_id is not null)
);

comment on column public.notifications.read is 'true = lida. Usado para o badge de não lidas.';

-- Uma notificação por (destinatário, autor, tipo, post). O índice único parcial
-- para post_id nulo cobre o follow (que não tem post) e evita duplicatas.
create unique index notifications_unique_with_post_idx
  on public.notifications (recipient_actor_id, actor_id, type, post_id)
  where post_id is not null;
create unique index notifications_unique_without_post_idx
  on public.notifications (recipient_actor_id, actor_id, type)
  where post_id is null;

create index notifications_recipient_created_idx
  on public.notifications (recipient_actor_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (recipient_actor_id, created_at desc)
  where read = false;

-- -----------------------------------------------------------------------------
-- hashtags
-- -----------------------------------------------------------------------------
create table public.hashtags (
  id         bigint generated always as identity primary key,
  name       text not null constraint hashtags_name_len check (char_length(name) between 1 and 50),
  created_at timestamptz not null default now(),
  constraint hashtags_name_key unique (name)
);

create table public.post_hashtags (
  post_id    uuid not null references public.posts (id) on delete cascade,
  hashtag_id bigint not null references public.hashtags (id) on delete cascade,
  constraint post_hashtags_pkey primary key (post_id, hashtag_id)
);

create index post_hashtags_hashtag_id_idx on public.post_hashtags (hashtag_id, post_id);
