-- =============================================================================
-- Realtime do feed
--
-- Migração da região estática (sa-east-1): o feed assina canais de publicação,
-- comentário e organização pelo Realtime (FeedStream), mas a publicação
-- `supabase_realtime` só continha `notifications` — ou seja, atualização "ao
-- vivo" do feed acontecia por polling. Este bloco registra as tabelas que o
-- cliente já escuta, tornando a atualização instantânea.
--
-- Idempotente: pode rodar quantas vezes for preciso.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    execute 'alter publication supabase_realtime add table public.posts';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'actors'
  ) then
    execute 'alter publication supabase_realtime add table public.actors';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'characters'
  ) then
    execute 'alter publication supabase_realtime add table public.characters';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'organizations'
  ) then
    execute 'alter publication supabase_realtime add table public.organizations';
  end if;
end;
$$;