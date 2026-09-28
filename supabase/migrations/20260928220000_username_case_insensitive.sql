-- -----------------------------------------------------------------------------
-- Handles com caixa preservada, unicidade frente a caixa
-- -----------------------------------------------------------------------------
-- "Mesomorphie" e "mesomorphie" são a mesma conta: o que a pessoa digitou
-- (caixa alta/baixa) é o que aparece na tela, e a unicidade passa a comparar
-- pela forma em minúsculas. A ordem é a que importa para o Postgres: o domínio
-- aceitar letras maiúsculas primeiro, e depois as chaves únicas virarem índices
-- em lower(username).

alter domain public.username_t drop constraint username_charset;
alter domain public.username_t add constraint username_charset check (value ~ '^[a-zA-Z0-9._]{3,30}$');

alter table public.profiles drop constraint profiles_username_key;
alter table public.characters drop constraint characters_username_key;
alter table public.organizations drop constraint organizations_username_key;
alter table public.actors drop constraint actors_username_key;

create unique index profiles_username_ci_key on public.profiles (lower(username));
create unique index characters_username_ci_key on public.characters (lower(username));
create unique index organizations_username_ci_key on public.organizations (lower(username));
create unique index actors_username_ci_key on public.actors (lower(username));

-- O provisionamento no cadastro preserva a caixa que o usuário informou e
-- procura livre na forma em minúsculas, igual faz a unicidade do banco.
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
  base := regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'jogador'),
    '[^a-zA-Z0-9._]', '', 'g'
  );
  base := btrim(base, '.');
  if length(base) < 3 then
    base := base || 'jogador';
  end if;
  base := left(base, 26);

  handle := base;
  while exists (select 1 from public.profiles p where lower(p.username) = lower(handle)) loop
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