-- =============================================================================
-- twitter espiritual — correções de leitura e criação concorrente de DMs
-- =============================================================================
-- Leitura precisa representar uma posição observada pelo cliente, não o instante
-- em que o RPC foi executado. O par (created_at, id) é o mesmo cursor usado pelo
-- histórico e evita ambiguidades quando duas mensagens compartilham timestamp.
alter table public.dm_participants
  add column last_read_message_id uuid references public.dm_messages (id) on delete set null;

-- O trigger que marca a própria mensagem como lida também registra a posição exata.
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
  set last_read_at = new.created_at,
      last_read_message_id = new.id
  where conversation_id = new.conversation_id
    and actor_id = new.actor_id;

  return new;
end;
$$;

-- Contagem por cursor, e não apenas por timestamp.
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
   and (
     m.created_at > p.last_read_at
     or (
       m.created_at = p.last_read_at
       and (p.last_read_message_id is null or m.id > p.last_read_message_id)
     )
   )
   and not public.owns_dm_actor(m.actor_id)
  where not p.hidden
  group by c.id;
$$;

-- A inbox usa exatamente a mesma semântica de leitura do contador global.
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
  with mine as (
    select distinct on (p.conversation_id)
      p.conversation_id, p.last_read_at, p.last_read_message_id
    from public.dm_participants p
    where p.actor_id in (select public.my_dm_actor_ids())
      and not p.hidden
    order by p.conversation_id, p.last_read_at desc, p.last_read_message_id desc nulls last
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
      order by m.created_at desc, m.id desc
      limit 1
    ) as preview,
    (
      select count(*)
      from public.dm_messages m
      where m.conversation_id = c.id
        and (
          m.created_at > mine.last_read_at
          or (
            m.created_at = mine.last_read_at
            and (mine.last_read_message_id is null or m.id > mine.last_read_message_id)
          )
        )
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
  limit least(greatest(coalesce(p_limit, 50), 0), 200);
$$;

drop function if exists public.dm_mark_read(uuid);

-- O cliente informa a última mensagem que realmente carregou/visualizou.
-- Nunca usamos now(): uma mensagem que chegou depois do carregamento continua
-- não lida. O update é monotônico para impedir uma resposta antiga sobrescrever
-- uma posição de leitura mais nova.
create or replace function public.dm_mark_read(
  target uuid,
  through_created_at timestamptz,
  through_message_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if through_created_at is null or through_message_id is null then
    raise exception 'Ponto de leitura inválido';
  end if;

  if not exists (
    select 1
    from public.dm_messages m
    join public.dm_participants p on p.conversation_id = m.conversation_id
    where m.conversation_id = target
      and m.id = through_message_id
      and m.created_at = through_created_at
      and p.actor_id in (select public.my_dm_actor_ids())
  ) then
    raise exception 'Ponto de leitura inválido';
  end if;

  update public.dm_participants p
  set last_read_at = through_created_at,
      last_read_message_id = through_message_id
  where p.conversation_id = target
    and p.actor_id in (select public.my_dm_actor_ids())
    and (
      p.last_read_at < through_created_at
      or (
        p.last_read_at = through_created_at
        and (p.last_read_message_id is null or p.last_read_message_id < through_message_id)
      )
    );
end;
$$;

-- Depois de limpar, a conversa continua existindo: o marcador temporal volta
-- para a criação da conversa, o preview fica naturalmente nulo e o unread zera.
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

  update public.dm_conversations c
  set last_message_at = c.created_at
  where c.id = target;
end;
$$;

-- Get-or-create atômico. A unique(direct_key) é a autoridade contra dois
-- pedidos simultâneos; ON CONFLICT evita duplicate key e devolve a conversa
-- vencedora. Os participantes também usam ON CONFLICT para o caso existente.
create or replace function public.dm_start_direct(sender_actor uuid, target_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
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

  if target_actor in (select public.my_dm_actor_ids()) then
    raise exception 'Não se abre conversa consigo mesmo';
  end if;

  key := least(sender_actor::text, target_actor::text) || ':' ||
         greatest(sender_actor::text, target_actor::text);

  insert into public.dm_conversations (kind, created_by, direct_key)
  values ('direct', sender_actor, key)
  on conflict (direct_key) do update
    set direct_key = excluded.direct_key
  returning id into found_id;

  insert into public.dm_participants (conversation_id, actor_id)
  values (found_id, sender_actor), (found_id, target_actor)
  on conflict (conversation_id, actor_id) do update
    set hidden = false;

  return found_id;
end;
$$;

grant execute on function public.dm_mark_read(uuid, timestamptz, uuid) to authenticated;

drop index if exists public.dm_messages_conversa_data_idx;

create index dm_messages_conversa_cursor_idx
  on public.dm_messages (conversation_id, created_at desc, id desc);
