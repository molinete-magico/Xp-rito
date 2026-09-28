-- =============================================================================
-- twitter espiritual — Supabase Storage
-- =============================================================================
-- Três buckets públicos de leitura (o conteúdo da rede é público dentro da mesa
-- e a URL não carrega segredo), com escrita restrita por política.
--
-- Layout de caminhos, o primeiro segmento é o dono do arquivo:
--   avatars/<actor_id>/<arquivo>
--   banners/<actor_id>/<arquivo>
--   post-media/<post_id>/<arquivo>
--
-- Os limites de tamanho e os quatro formatos aceitos são aplicados pelo bucket,
-- não pela aplicação.
-- =============================================================================

-- Helper: converte texto em uuid, devolvendo null quando o caminho não é um uuid.
create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception
  when others then
    return null;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',    'avatars',    true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('banners',    'banners',    true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('post-media', 'post-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Leitura
-- -----------------------------------------------------------------------------
create policy "storage: mídia da rede é legível"
  on storage.objects for select to public
  using (bucket_id in ('avatars', 'banners', 'post-media'));

-- -----------------------------------------------------------------------------
-- Escrita: cada identidade só escreve no próprio diretório
-- -----------------------------------------------------------------------------
create policy "storage: avatar do actor que controlo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "storage: banner do actor que controlo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'banners'
    and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "storage: mídia do post que controlo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and public.can_manage_post(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "storage: avatar do actor que controlo (substituição)"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'avatars'
    and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "storage: banner do actor que controlo (substituição)"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'banners'
    and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'banners'
    and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "storage: mídia do post que controlo (substituição)"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'post-media'
    and public.can_manage_post(public.try_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'post-media'
    and public.can_manage_post(public.try_uuid((storage.foldername(name))[1]))
  );

-- -----------------------------------------------------------------------------
-- Remoção
-- -----------------------------------------------------------------------------
create policy "storage: removo o que está no meu diretório"
  on storage.objects for delete to authenticated
  using (
    (bucket_id = 'avatars' and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1])))
    or (bucket_id = 'banners' and public.can_manage_actor(public.try_uuid((storage.foldername(name))[1])))
    or (bucket_id = 'post-media' and public.can_manage_post(public.try_uuid((storage.foldername(name))[1])))
  );
