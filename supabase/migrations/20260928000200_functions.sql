-- =============================================================================
-- twitter espiritual — funções auxiliares de autorização e de domínio
-- =============================================================================
-- Todas as funções de autorização são SECURITY DEFINER com `search_path = ''`:
-- precisam consultar profiles/characters/actors ignorando RLS (para não
-- recursarem) e referenciam tudo de forma qualificada. `public.is_gm()` é a
-- única fonte de verdade sobre o papel do Mestre; a aplicação nunca confia num
-- valor enviado pelo cliente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Autorização
-- -----------------------------------------------------------------------------

-- O usuário autenticado atual (null quando anônimo).
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid();
$$;

-- O usuário atual é o Mestre da mesa?
create or replace function public.is_gm()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'gm'
  );
$$;

-- O usuário atual é dono deste personagem, sem autoridade de Mestre. Para
-- incluir o Mestre, use public.can_edit_character.
create or replace function public.owns_character(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.characters c
    where c.id = target
      and c.owner_id = auth.uid()
  );
$$;

-- O usuário atual pode editar este personagem: dono ou Mestre.
create or replace function public.can_edit_character(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_gm() or public.owns_character(target);
$$;

-- O usuário atual é dono deste actor, sem autoridade de Mestre.
create or replace function public.owns_actor(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.actors a
    where a.id = target
      and a.character_id is not null
      and exists (
        select 1
        from public.characters c
        where c.id = a.character_id
          and c.owner_id = auth.uid()
      )
  );
$$;

-- O usuário atual pode agir como este actor (dono do personagem ou Mestre).
create or replace function public.can_manage_actor(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_gm() or public.owns_actor(target);
$$;

-- O usuário atual controla o actor dono deste post (autor ou Mestre).
create or replace function public.can_manage_post(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = target
      and public.can_manage_actor(p.actor_id)
  );
$$;

-- IDs de todos os actors que o usuário atual pode usar como identidade. Usado
-- pela aplicação para montar o feed "quem eu sigo" e a lista de identidades.
-- SECURITY DEFINER porque depende de characters, cuja leitura anônima é pública
-- mas cujo filtro por owner_id é do próprio RLS.
create or replace function public.my_actor_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id
  from public.actors a
  where public.can_manage_actor(a.id);
$$;

-- -----------------------------------------------------------------------------
-- Domínio
-- -----------------------------------------------------------------------------

-- Extrai as hashtags de um texto, já normalizadas em minúsculas e sem
-- duplicatas (preservando a ordem da primeira aparição).
--
-- O espelho em TypeScript vive em `src/lib/text/hashtags.ts`, e a paridade
-- entre as duas implementações é verificada em `tests/hashtag-parity.test.ts`.
--
-- Regras do token: '#' precedido de início/fim de texto ou de um caractere
-- que NÃO seja letra, dígito, '_' ou '#'; seguido de 1..50 caracteres de
-- [A-Za-z0-9_] ou de qualquer letra acentuada (U+00C0–U+024F = Latim
-- estendido, U+0370–U+03FF = Grego, U+0400–U+04FF = Cirílico).
create or replace function public.extract_hashtags(source text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  found  text[];
  result text[] := '{}';
  seen   text[] := '{}';
  item   text;
begin
  if source is null or source = '' then
    return result;
  end if;

  select coalesce(array_agg(matches[2]), '{}')
  into found
  from regexp_matches(
    source,
    '(^|[^A-Za-z0-9_#\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF])#([A-Za-z0-9_\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]{1,50})',
    'g'
  ) as matches
  where matches[2] is not null;

  foreach item in array found loop
    if not (lower(item) = any (seen)) then
      seen := seen || lower(item);
      result := result || lower(item);
    end if;
  end loop;

  return result;
end;
$$;
