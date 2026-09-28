-- =============================================================================
-- Bootstrap SOMENTE PARA TESTES LOCAIS (PGlite)
-- =============================================================================
-- O PGlite é um Postgres real em WASM, mas não traz os schemas `auth` e
-- `storage` que o Supabase cria. Este arquivo recria o mínimo necessário para
-- que as migrations rodem e para que as políticas RLS sejam exercitadas de
-- verdade.
--
-- NÃO rode este arquivo no seu projeto Supabase. Lá, `auth.uid()`,
-- `storage.objects` e `storage.buckets` já existem.
-- =============================================================================

create role anon nologin noinherit;
create role authenticated nologin noinherit;

-- -----------------------------------------------------------------------------
-- auth
-- -----------------------------------------------------------------------------
create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb
);

-- Espelha o comportamento do Supabase: o sub do JWT da requisição.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select case
    when current_setting('request.jwt.claims', true) is null then null
    else nullif(
      current_setting('request.jwt.claims')::jsonb ->> 'sub',
      ''
    )::uuid
  end;
$$;

-- -----------------------------------------------------------------------------
-- storage
-- -----------------------------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now()
);

-- Mesma semântica do Supabase: descarta o primeiro segmento (o bucket) e devolve
-- o restante do caminho.
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select case
    when name is null then null
    when strpos(name, '/') = 0 then '{}'::text[]
    else string_to_array(substr(name, strpos(name, '/') + 1), '/')
  end;
$$;

-- -----------------------------------------------------------------------------
-- Ambiente
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant usage on schema storage to anon, authenticated;
