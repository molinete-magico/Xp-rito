-- =============================================================================
-- twitter espiritual — correções de invariantes e privilégios
--
-- Migration de correção, escrita depois de revisar o schema à luz da
-- implementação da interface. Cada bloco corrige um problema concreto:
--
-- 1. `characters` tinha apenas `select`: as políticas de escrita existiam, mas
--    o privilégio não, então ninguém conseguia criar nem editar personagem.
-- 2. `notify_actor` apagava qualquer notificação do mesmo ator/post, de modo que
--    um "descurtir" apagava também a notificação de repost.
-- 3. `notifications` liberava `update` da tabela inteira; só `read` muda.
-- 4. A mídia de post era gravada em `post-media/<post_id>/`, mas o post ainda
--    não existe no momento do upload (a mídia sobe antes da publicação). A
--    política passou a autorizar pelo actor que publica, como nos outros buckets:
--    convenção "primeiro segmento é o dono".
-- 5. Um post sem texto e sem imagem era aceito se fosse resposta, e um repost
--    podia ganhar imagem. Ambos agora são recusados pelo banco.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Privilégio de escrita em `characters`
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.characters to authenticated;

-- -----------------------------------------------------------------------------
-- 3. `notifications`: só a coluna `read` é mutável pelo cliente
-- -----------------------------------------------------------------------------
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Descurtir remove só a notificação de curtida
-- -----------------------------------------------------------------------------
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
    -- O filtro por tipo importa: um repost do mesmo ator sobre o mesmo post tem
    -- notificação própria e precisa sobreviver ao descurtir.
    delete from public.notifications n
    where n.actor_id = old.actor_id
      and n.post_id is not distinct from old.post_id
      and n.type = 'like';
    return old;
  end if;

  select p.actor_id into recipient from public.posts p where p.id = new.post_id;

  if recipient is null or recipient = new.actor_id then
    return new;
  end if;

  insert into public.notifications (recipient_actor_id, actor_id, type, post_id)
  values (recipient, new.actor_id, 'like', new.post_id)
  on conflict do nothing;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Storage: `post-media` passa a ser escrito pelo actor que publica
-- -----------------------------------------------------------------------------
drop policy if exists "storage: mídia do post que controlo" on storage.objects;
drop policy if exists "storage: mídia do post que controlo (substituição)" on storage.objects;

create policy "storage: mídia que eu publico"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "storage: mídia que eu publico (substituição)"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'post-media'
    and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'post-media'
    and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "storage: removo a mídia que eu publiquei"
  on storage.objects for delete to authenticated
  using (
    (bucket_id = 'avatars'   and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1])))
    or (bucket_id = 'banners'   and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1])))
    or (bucket_id = 'post-media' and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1])))
  );

-- -----------------------------------------------------------------------------
-- 5. Invariantes de conteúdo
--
-- O post e a mídia nascem em duas chamadas (primeiro o post, depois as linhas de
-- `post_media`), então a regra "tem texto ou tem imagem" não cabe num CHECK: no
-- momento do INSERT do post a mídia ainda não foi anexada, e um CHECK que
-- exigisse texto recusaria justamente o post só com imagem. O CHECK antigo é
-- removido e a verificação passa a ser um constraint trigger adiado, que roda
-- no COMMIT, quando os dois lados da publicação já existem na mesma transação.
-- -----------------------------------------------------------------------------
alter table public.posts drop constraint if exists posts_has_content_or_repost;
create or replace function public.assert_post_has_content()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid := coalesce(new.id, old.id);
  has_content boolean;
  has_media boolean;
  is_repost boolean;
begin
  select p.content is not null and char_length(btrim(p.content)) > 0,
         p.repost_of is not null,
         exists (select 1 from public.post_media m where m.post_id = p.id)
  into has_content, is_repost, has_media
  from public.posts p
  where p.id = target;

  -- O post já não existe (exclusão em cascata): nada a exigir.
  if not found then
    return null;
  end if;

  if is_repost then
    if has_media then
      raise exception using
        errcode = 'check_violation',
        constraint = 'post_media_repost_not_allowed',
        message = 'Um repost não pode ter imagem própria.';
    end if;
    return null;
  end if;

  if not (has_content or has_media) then
    raise exception using
      errcode = 'check_violation',
      constraint = 'posts_has_content_or_media',
      message = 'A publicação precisa de texto ou de imagem.';
  end if;

  return null;
end;
$$;

drop trigger if exists posts_assert_content on public.posts;
create constraint trigger posts_assert_content
  after insert or update on public.posts
  deferrable initially deferred
  for each row execute function public.assert_post_has_content();

-- Anexar imagem a um repost é recusado na hora, sem esperar o COMMIT.
create or replace function public.assert_media_allowed()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_repost boolean;
begin
  select p.repost_of is not null into is_repost
  from public.posts p
  where p.id = new.post_id;

  if is_repost then
    raise exception using
      errcode = 'check_violation',
      constraint = 'post_media_repost_not_allowed',
      message = 'Um repost não pode ter imagem própria.';
  end if;

  return new;
end;
$$;

drop trigger if exists post_media_assert_allowed on public.post_media;
create trigger post_media_assert_allowed
  before insert on public.post_media
  for each row execute function public.assert_media_allowed();

-- -----------------------------------------------------------------------------
-- Publicação em uma transação só
--
-- Com o CHECK antigo, "post só com imagem" era impossível: o post era criado
-- antes de a mídia existir. A verificação diferida só resolve o problema se as
-- duas escritas forem da mesma transação, e publicação atômica é o comportamento
-- esperado. Antes disso, uma falha ao anexar a imagem deixava no feed um post sem
-- imagem.
--
-- A função não é SECURITY DEFINER: roda com os privilégios de quem chama, e o
-- RLS continua valendo linha a linha dentro dela. Quem não pode publicar como
-- determinada identidade é recusado pela mesma política.
-- -----------------------------------------------------------------------------
create or replace function public.publish_post(
  p_actor_id uuid,
  p_content text,
  p_reply_to uuid default null,
  p_repost_of uuid default null,
  p_media jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_id uuid;
  item jsonb;
  slot integer := 0;
begin
  insert into public.posts (actor_id, content, reply_to, repost_of)
  values (p_actor_id, p_content, p_reply_to, p_repost_of)
  returning id into new_id;

  for item in select value from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) loop
    insert into public.post_media (post_id, storage_path, media_type, width, height, alt_text, position)
    values (
      new_id,
      item->>'storagePath',
      item->>'mediaType',
      nullif(item->>'width', '')::integer,
      nullif(item->>'height', '')::integer,
      coalesce(item->>'altText', ''),
      slot
    );
    slot := slot + 1;
  end loop;

  return new_id;
end;
$$;

comment on function public.publish_post is
  'Cria a publicação e as mídias na mesma transação. Sem SECURITY DEFINER: o RLS do autor vale dentro da função.';

grant execute on function public.publish_post(uuid, text, uuid, uuid, jsonb) to authenticated;
