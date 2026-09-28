-- =============================================================================
-- twitter espiritual — triggers
-- =============================================================================
-- Invariantes mantidas no banco (nunca no cliente):
--   1. todo character/organization tem exatamente um actor correspondente;
--   2. os campos de apresentação do actor espelham a entidade;
--   3. todo post tem hashtags extraídas do próprio texto;
--   4. toda interação relevante gera exatamente uma notificação;
--   5. role do profile só muda por autoridade do Mestre.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger characters_touch_updated_at before update on public.characters
  for each row execute function public.touch_updated_at();
create trigger organizations_touch_updated_at before update on public.organizations
  for each row execute function public.touch_updated_at();
create trigger actors_touch_updated_at before update on public.actors
  for each row execute function public.touch_updated_at();
create trigger posts_touch_updated_at before update on public.posts
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 1 e 2 — actor espelha a entidade
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER: o trigger roda como o dono do schema e ignora o RLS. É isso
-- que permite criar/atualizar actors a partir de uma escrita legítima em
-- characters/organizations, sem abrir INSERT/UPDATE de actors para o cliente.
create or replace function public.sync_actor_from_character()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.actors (character_id, display_name, username, bio, avatar_url, banner_url)
  values (new.id, new.name, new.username, new.bio, new.avatar_url, new.banner_url)
  on conflict (character_id) do update
    set display_name = excluded.display_name,
        username     = excluded.username,
        bio          = excluded.bio,
        avatar_url   = excluded.avatar_url,
        banner_url   = excluded.banner_url;

  return new;
end;
$$;

create or replace function public.sync_actor_from_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.actors (organization_id, display_name, username, bio, avatar_url, banner_url)
  values (new.id, new.name, new.username, new.description, new.avatar_url, new.banner_url)
  on conflict (organization_id) do update
    set display_name = excluded.display_name,
        username     = excluded.username,
        bio          = excluded.bio,
        avatar_url   = excluded.avatar_url,
        banner_url   = excluded.banner_url;

  return new;
end;
$$;

create trigger characters_sync_actor
  after insert or update of name, username, bio, avatar_url, banner_url
  on public.characters
  for each row execute function public.sync_actor_from_character();

create trigger organizations_sync_actor
  after insert or update of name, username, description, avatar_url, banner_url
  on public.organizations
  for each row execute function public.sync_actor_from_organization();

-- -----------------------------------------------------------------------------
-- Validação de referências de post
-- -----------------------------------------------------------------------------
-- Impede resposta a post inexistente, repost de um repost e auto-repost
-- indireto. Também normaliza: um repost nunca carrega texto.
create or replace function public.validate_post_references()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_repost_of uuid;
begin
  if new.reply_to is not null then
    if not exists (select 1 from public.posts p where p.id = new.reply_to) then
      raise exception 'post inexistente em reply_to' using errcode = 'foreign_key_violation';
    end if;
    if new.reply_to = new.id then
      raise exception 'um post não pode responder a si mesmo' using errcode = 'check_violation';
    end if;
  end if;

  if new.repost_of is not null then
    select p.repost_of into target_repost_of
    from public.posts p
    where p.id = new.repost_of;

    if not found then
      raise exception 'post inexistente em repost_of' using errcode = 'foreign_key_violation';
    end if;
    if target_repost_of is not null then
      raise exception 'não é possível repostar um repost' using errcode = 'check_violation';
    end if;
    if new.repost_of = new.id then
      raise exception 'um post não pode repostar a si mesmo' using errcode = 'check_violation';
    end if;

    new.content := null;
  end if;

  return new;
end;
$$;

-- Em todo update, não só quando reply_to/repost_of mudam: é o que impede que um
-- repost ganhe texto próprio por um `update set content`.
create trigger posts_validate_references
  before insert or update on public.posts
  for each row execute function public.validate_post_references();

-- -----------------------------------------------------------------------------
-- 3 — hashtags
-- -----------------------------------------------------------------------------
create or replace function public.sync_post_hashtags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tag text;
begin
  delete from public.post_hashtags ph where ph.post_id = new.id;

  foreach tag in array public.extract_hashtags(new.content) loop
    insert into public.hashtags (name)
    values (tag)
    on conflict (name) do nothing;

    insert into public.post_hashtags (post_id, hashtag_id)
    select new.id, h.id from public.hashtags h where h.name = tag
    on conflict (post_id, hashtag_id) do nothing;
  end loop;

  return new;
end;
$$;

create trigger posts_sync_hashtags
  after insert or update of content on public.posts
  for each row execute function public.sync_post_hashtags();

-- -----------------------------------------------------------------------------
-- 4 — notificações
-- -----------------------------------------------------------------------------
-- Um único ponto de criação. `on conflict do nothing` mais os índices únicos
-- parciais garantem que a mesma interação nunca produza duas notificações.
create or replace function public.notify_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.notifications n
    where n.actor_id = old.actor_id
      and n.post_id is not distinct from old.post_id;
    return old;
  end if;

  select p.actor_id into recipient from public.posts p where p.id = new.post_id;

  -- Sem notificação de si para si e sem notificação para post já removido.
  if recipient is null or recipient = new.actor_id then
    return new;
  end if;

  insert into public.notifications (recipient_actor_id, actor_id, type, post_id)
  values (recipient, new.actor_id, 'like', new.post_id)
  on conflict do nothing;

  return new;
end;
$$;

create trigger likes_notify after insert or delete on public.likes
  for each row execute function public.notify_actor();

create or replace function public.notify_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
begin
  if new.reply_to is null then
    return new;
  end if;

  select p.actor_id into recipient from public.posts p where p.id = new.reply_to;

  if recipient is null or recipient = new.actor_id then
    return new;
  end if;

  insert into public.notifications (recipient_actor_id, actor_id, type, post_id)
  values (recipient, new.actor_id, 'reply', new.id)
  on conflict do nothing;

  return new;
end;
$$;

create trigger posts_notify_reply after insert on public.posts
  for each row execute function public.notify_reply();

create or replace function public.notify_repost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
begin
  if new.repost_of is null then
    return new;
  end if;

  select p.actor_id into recipient from public.posts p where p.id = new.repost_of;

  if recipient is null or recipient = new.actor_id then
    return new;
  end if;

  insert into public.notifications (recipient_actor_id, actor_id, type, post_id)
  values (recipient, new.actor_id, 'repost', new.repost_of)
  on conflict do nothing;

  return new;
end;
$$;

create trigger posts_notify_repost after insert on public.posts
  for each row execute function public.notify_repost();

create or replace function public.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.follower_id = new.following_id then
    return new;
  end if;

  insert into public.notifications (recipient_actor_id, actor_id, type, post_id)
  values (new.following_id, new.follower_id, 'follow', null)
  on conflict do nothing;

  return new;
end;
$$;

create trigger follows_notify after insert on public.follows
  for each row execute function public.notify_follow();

-- -----------------------------------------------------------------------------
-- 5 — role do profile é território exclusivo do Mestre
-- -----------------------------------------------------------------------------
-- Defesa em profundidade: além da trava em RLS/colunas, o banco recusa a
-- alteração por qualquer caminho de cliente. Contexto privilegiado (SQL editor,
-- service_role) é permitido de propósito, porque é por ele que o primeiro Mestre
-- é nomeado.
--
-- SECURITY INVOKER de propósito: assim `current_user` reflete quem está de fato
-- escrevendo, e não o dono da função.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user in ('anon', 'authenticated')
     and not public.is_gm() then
    raise exception 'apenas o Mestre pode alterar o papel de um usuário'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- -----------------------------------------------------------------------------
-- Provisionamento de profile no cadastro
-- -----------------------------------------------------------------------------
-- Executado pelo Supabase Auth após o signup. Deriva um @handle único a partir do
-- que o usuário informou e nunca falha o cadastro.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text;
  handle text;
  suffix int := 0;
begin
  base := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'jogador'),
    '[^a-z0-9._]', '', 'g'
  ));
  base := btrim(base, '.');
  if length(base) < 3 then
    base := base || 'jogador';
  end if;
  base := left(base, 26);

  handle := base;
  while exists (select 1 from public.profiles p where p.username = handle) loop
    suffix := suffix + 1;
    handle := left(base, 30 - length(suffix::text) - 1) || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    handle,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', handle), 80),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
