-- =============================================================================
-- twitter espiritual — mensagens privadas
-- =============================================================================
-- Conversas diretas e em grupo, com um participante por identidade (actor).
--
-- Decisões que valem registrar:
--
-- * Texto only, sem mídia. Uma mensagem de texto com índice custa ~500 bytes;
--   foto custa ~300 KB. Com 1 GB no bucket, mídia é o que estoura o projeto — e é
--   o que exigiria Edge Function para apagar direito. O histórico de texto fica.
-- * Nenhuma expiração por tempo. Quem quer limpar pede na hora; automático só
--   volta se um dia fizer sentido, pela coluna expires_at, que dá para acrescentar
--   sem reescrever nada.
-- * `hidden` é "some da minha caixa", sem apagar: cada participante decide se
--   quer ver aquela conversa, e o histórico dos outros fica intacto.
-- * Identidade de DM é o personagem DONO do usuário (my_dm_actor_ids), não
--   qualquer actor que ele consiga gerenciar: o Mestre gerencia a mesa inteira e,
--   se valesse, leria a conversa privada dos jogadores. NPC e organização não têm
--   dono, portanto não têm caixa de entrada.
-- * A criação de conversa é RPC e não insert do cliente: quem inicia precisa
--   colocar na conversa identidades que não controla, e a política de participante
--   só autoriza a própria identidade.
-- =============================================================================

create table public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct',
  title text,
  created_by uuid not null references public.actors (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint dm_conversations_kind check (kind in ('direct', 'group')),
  constraint dm_conversations_grupo_com_nome check (kind = 'direct' or title is not null),
  -- Par ordenado dos dois lados da conversa direta: garante uma conversa por par
  -- sem trigger. Grupos usam null, e null não colide no unique.
  direct_key text unique
);

create table public.dm_participants (
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  actor_id uuid not null references public.actors (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  hidden boolean not null default false,
  primary key (conversation_id, actor_id)
);

create table public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  actor_id uuid not null references public.actors (id) on delete cascade,
  content text not null,
  kind text not null default 'text',
  created_at timestamptz not null default now(),
  constraint dm_messages_kind check (kind in ('text', 'system')),
  constraint dm_messages_conteudo check (char_length(content) between 1 and 4000)
);

create index dm_messages_conversa_data_idx
  on public.dm_messages (conversation_id, created_at desc);
create index dm_participants_actor_idx
  on public.dm_participants (actor_id);

-- -----------------------------------------------------------------------------
-- Autorização
-- -----------------------------------------------------------------------------
--
-- Um usuário fala como os personagens que possui. O Mestre fala também como os
-- NPCs da mesa — é o trabalho dele — mas a voz é sempre POR CONVERSA: só dá para
-- falar como um NPC que JÁ está naquela conversa.
--
-- Essa última condição é o que segura a conversa privada dos jogadores. Sem ela,
-- o Mestre poderia falar como qualquer NPC e, ao entrar na conversa, ler o que
-- quisesse.
--
-- `dm_speaker_ids` devolve só quem é personagem; organização não tem boca, e
-- quem não é personagem não entra na lista.

-- O usuário pode dar voz a este ator, em qualquer lugar?
-- Dono do personagem sempre; NPC apenas para o Mestre. Não depende da conversa,
-- então serve para validar quem entra numa conversa nova.
create or replace function public.can_voice_actor(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.actors a
    join public.characters c on c.id = a.character_id
    where a.id = target
      and (c.owner_id = auth.uid() or (c.is_npc and public.is_gm()))
  );
$$;

-- Identidades com que o usuário convive: as próprias e, para o Mestre, os NPCs
-- da mesa. Abrir conversa, listar na caixa e ler são a mesma pergunta — "eu
-- participo de alguma dessas conversas?" — e a resposta mora aqui, num lugar só.
create or replace function public.my_dm_actor_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id
  from public.actors a
  join public.characters c on c.id = a.character_id
  where c.owner_id = auth.uid()
     or (c.is_npc and public.is_gm());
$$;

-- O usuário pode falar como este ator, nesta conversa?
-- Igual a lista acima, mas exige que o ator esteja na conversa: é o que impede o
-- Mestre de aparecer numa conversa de jogadores.
create or replace function public.dm_can_speak_as(target uuid, speaker uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dm_participants p
    where p.conversation_id = target
      and p.actor_id = speaker
      and p.actor_id in (select public.my_dm_actor_ids())
  );
$$;

-- Personagens com que o usuário pode falar na conversa, para o seletor da tela.
create or replace function public.dm_speaker_ids(target uuid)
returns table (id uuid, display_name text, username text, avatar_url text, is_npc boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.display_name, a.username, a.avatar_url, c.is_npc
  from public.actors a
  join public.dm_participants p
    on p.actor_id = a.id
   and p.conversation_id = target
  join public.characters c on c.id = a.character_id
  where p.actor_id in (select public.my_dm_actor_ids())
  order by a.display_name;
$$;

-- O usuário é dono desta identidade de DM? Continua sendo só o dono: é o que
-- impede o Mestre de abrir conversa no nome de personagem alheio.
create or replace function public.owns_dm_actor(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.actors a
    join public.characters c on c.id = a.character_id
    where a.id = target
      and c.owner_id = auth.uid()
  );
$$;

-- O usuário participa desta conversa por alguma das suas identidades.
create or replace function public.is_dm_participant(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dm_participants p
    where p.conversation_id = target
      and p.actor_id in (select public.my_dm_actor_ids())
  );
$$;

-- Quantas mensagens não lidas o usuário tem em cada conversa. Uma função porque
-- a lista de conversas e o contador precisam bater, e N+1 aqui seria fácil.
create or replace function public.dm_unread_counts()
returns table (conversation_id uuid, unread bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, count(distinct m.id)
  from public.dm_conversations c
  join public.dm_participants p
    on p.conversation_id = c.id
   and p.actor_id in (select public.my_dm_actor_ids())
  left join public.dm_messages m
    on m.conversation_id = c.id
   and m.created_at > p.last_read_at
   and not public.owns_dm_actor(m.actor_id)
  where not p.hidden
  group by c.id;
$$;

-- A caixa inteira numa consulta. Trazer a última mensagem de cada conversa pelo
-- PostgREST daria uma consulta por linha, e a conversa que ficou parada some do
-- limite: quem manda é o banco, que sabe escolher a última por conversa.
create or replace function public.dm_inbox(p_limit integer default 50)
returns table (
  id uuid,
  kind text,
  title text,
  last_message_at timestamptz,
  preview text,
  unread bigint,
  participants jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  -- O Mestre pode ter vários personagens na mesma conversa, uma linha por
  -- identidade. `distinct on` achata numa só, senão a conversa apareceria repetida
  -- na caixa; a mais recente manda, porque é o último ponto de leitura.
  with mine as (
    select distinct on (p.conversation_id)
      p.conversation_id, p.last_read_at
    from public.dm_participants p
    where p.actor_id in (select public.my_dm_actor_ids())
      and not p.hidden
    order by p.conversation_id, p.last_read_at desc
  )
  select
    c.id,
    c.kind,
    c.title,
    c.last_message_at,
    (
      select m.content
      from public.dm_messages m
      where m.conversation_id = c.id
      order by m.created_at desc
      limit 1
    ) as preview,
    (
      select count(*)
      from public.dm_messages m
      where m.conversation_id = c.id
        and m.created_at > mine.last_read_at
        and not public.owns_dm_actor(m.actor_id)
    ) as unread,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'display_name', a.display_name,
            'username', a.username,
            'avatar_url', a.avatar_url,
            'banner_url', a.banner_url,
            'avatar_position_x', a.avatar_position_x,
            'avatar_position_y', a.avatar_position_y,
            'banner_position_y', a.banner_position_y,
            'entity_type', a.entity_type,
            'character', (
              select jsonb_build_object('id', ch.id, 'is_npc', ch.is_npc)
              from public.characters ch
              where ch.id = a.character_id
            ),
            'organization', (
              select jsonb_build_object('id', o.id, 'type', o.type)
              from public.organizations o
              where o.id = a.organization_id
            )
          )
          order by a.display_name
        ),
        '[]'::jsonb
      )
      from public.dm_participants p2
      join public.actors a on a.id = p2.actor_id
      where p2.conversation_id = c.id
    ) as participants
  from public.dm_conversations c
  join mine on mine.conversation_id = c.id
  order by c.last_message_at desc
  -- O default cobre a chamada sem argumento; o teto impede alguém de pedir a
  -- caixa inteira. Quem pede 0 recebe 0, que é o que o número diz.
  limit least(greatest(coalesce(p_limit, 50), 0), 200);
$$;

-- -----------------------------------------------------------------------------
-- Domínio
-- -----------------------------------------------------------------------------

-- Mensagem nova: a conversa sobe para o topo da caixa e o autor já conta como
-- tendo lido a própria mensagem.
create or replace function public.dm_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.dm_conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;

  update public.dm_participants
  set last_read_at = new.created_at
  where conversation_id = new.conversation_id
    and actor_id = new.actor_id;

  return new;
end;
$$;

create trigger dm_messages_touch
  after insert on public.dm_messages
  for each row execute function public.dm_touch_conversation();

-- Conversa direta entre duas identidades. Reaproveita a existente quando há.
-- O remetente vem do cliente de propósito: quem está com o personagem X aberto
-- fala como X, e não como "a primeira identidade que o banco achar".
create or replace function public.dm_start_direct(sender_actor uuid, target_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine uuid;
  key text;
  found_id uuid;
begin
  if target_actor is null then
    raise exception 'Conversa sem destinatário';
  end if;

  if sender_actor is null or not public.can_voice_actor(sender_actor) then
    raise exception 'Escolha um personagem seu para enviar a mensagem';
  end if;

  if not exists (select 1 from public.actors where id = target_actor) then
    raise exception 'Essa conta não existe';
  end if;

  -- O destinatário é uma das identidades do próprio usuário? Comparamos por id,
  -- não por autoridade, senão o Mestre veria "si mesmo" em toda conta.
  if target_actor in (select public.my_dm_actor_ids()) then
    raise exception 'Não se abre conversa consigo mesmo';
  end if;

  mine := sender_actor;

  key := least(mine::text, target_actor::text) || ':' || greatest(mine::text, target_actor::text);

  select c.id into found_id
  from public.dm_conversations c
  where c.direct_key = key;

  if found_id is not null then
    -- Uma conversa que eu escondi volta para a caixa quando peço de novo.
    update public.dm_participants set hidden = false
    where conversation_id = found_id and actor_id = mine;
    return found_id;
  end if;

  insert into public.dm_conversations (kind, created_by, direct_key)
  values ('direct', mine, key)
  returning id into found_id;

  insert into public.dm_participants (conversation_id, actor_id)
  values (found_id, mine), (found_id, target_actor);

  return found_id;
end;
$$;

-- Conversa em grupo: quem abre escolhe o nome e os participantes.
create or replace function public.dm_create_group(sender_actor uuid, group_title text, members uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_actor uuid;
  found_id uuid;
  member uuid;
  others uuid[];
begin
  if group_title is null or char_length(trim(group_title)) < 1 then
    raise exception 'Dê um nome à conversa';
  end if;

  if members is null or array_length(members, 1) is null then
    raise exception 'Escolha quem participa';
  end if;

  if sender_actor is null or not public.can_voice_actor(sender_actor) then
    raise exception 'Escolha um personagem seu para abrir a conversa';
  end if;

  owner_actor := sender_actor;

  foreach member in array members loop
    if not exists (select 1 from public.actors where id = member) then
      raise exception 'Participante não encontrado';
    end if;
  end loop;

  -- Grupo de uma pessoa só não é conversa, é rascunho. O próprio criador não
  -- conta como "outro" participante.
  select coalesce(array_agg(distinct guest), '{}'::uuid[])
  into others
  from unnest(members) as guest
  where guest <> owner_actor;

  if array_length(others, 1) is null then
    raise exception 'Convide pelo menos uma pessoa';
  end if;

  insert into public.dm_conversations (kind, title, created_by)
  values ('group', trim(group_title), owner_actor)
  returning id into found_id;

  insert into public.dm_participants (conversation_id, actor_id)
  values (found_id, owner_actor);

  insert into public.dm_participants (conversation_id, actor_id)
  select found_id, guest
  from unnest(others) as guest
  on conflict do nothing;

  return found_id;
end;
$$;

-- Limpar a conversa vale para todos os participantes.
--
-- Diferente de ler e falar, apagar fica só para quem tem personagem próprio na
-- conversa. `is_dm_participant` agora é verdadeiro também para o Mestre que
-- entrou como NPC, e apagar é de todos: deixar valendo ali daria ao Mestre o
-- poder de reescrever a história de uma conversa em que ele é apenas uma das
-- vozes. Ele sai da conversa, mas não apaga a conversa dos outros.
create or replace function public.dm_clear(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.dm_participants p
    where p.conversation_id = target
      and p.actor_id in (
        select a.id
        from public.actors a
        join public.characters c on c.id = a.character_id
        where c.owner_id = auth.uid()
      )
  ) then
    raise exception 'Você não participa dessa conversa';
  end if;

  delete from public.dm_messages where conversation_id = target;
end;
$$;

-- "Some da minha caixa": oculta para as identidades do usuário, sem apagar o que
-- os outros têm.
create or replace function public.dm_hide(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.dm_participants
  set hidden = true
  where conversation_id = target
    and actor_id in (select public.my_dm_actor_ids());
end;
$$;

-- Marcar como lida até agora.
create or replace function public.dm_mark_read(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.dm_participants
  set last_read_at = now()
  where conversation_id = target
    and actor_id in (select public.my_dm_actor_ids());
end;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.dm_conversations enable row level security;
alter table public.dm_participants enable row level security;
alter table public.dm_messages enable row level security;

create policy "dm_conversations: só quem participa"
  on public.dm_conversations for select to authenticated
  using (public.is_dm_participant(id));

create policy "dm_participants: só quem participa"
  on public.dm_participants for select to authenticated
  using (public.is_dm_participant(conversation_id));

create policy "dm_messages: só quem participa"
  on public.dm_messages for select to authenticated
  using (public.is_dm_participant(conversation_id));

-- Publicar exige estar na conversa E falar como alguém que está nela. As duas
-- condições numa política só, porque "participa" sem "fala como" deixaria o
-- Mestre escrever num NPC que ele não comanda.
create policy "dm_messages: fala como identidade que controlo"
  on public.dm_messages for insert to authenticated
  with check (
    public.dm_can_speak_as(conversation_id, actor_id)
  );

-- Limpar, ocultar e marcar lida são as RPC SECURITY DEFINER acima: nada de
-- update ou delete direto nestas tabelas.

grant select on public.dm_conversations to authenticated;
grant select on public.dm_participants to authenticated;
grant select, insert on public.dm_messages to authenticated;

grant execute on function public.my_dm_actor_ids to authenticated;
grant execute on function public.owns_dm_actor to authenticated;
grant execute on function public.can_voice_actor to authenticated;
grant execute on function public.dm_can_speak_as(uuid, uuid) to authenticated;
grant execute on function public.dm_speaker_ids(uuid) to authenticated;
grant execute on function public.is_dm_participant to authenticated;
grant execute on function public.dm_unread_counts to authenticated;
grant execute on function public.dm_start_direct to authenticated;
grant execute on function public.dm_create_group to authenticated;
grant execute on function public.dm_clear to authenticated;
grant execute on function public.dm_hide to authenticated;
grant execute on function public.dm_mark_read to authenticated;
grant execute on function public.dm_inbox(integer) to authenticated;

revoke all on public.dm_conversations from anon;
revoke all on public.dm_participants from anon;
revoke all on public.dm_messages from anon;

-- Realtime: a thread aberta assina inserções desta conversa. A publicação só
-- existe em um projeto Supabase de verdade; o guarda mantém a migration
-- aplicável no Postgres de teste, que não tem Realtime.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dm_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.dm_messages';
  end if;
end;
$$;
