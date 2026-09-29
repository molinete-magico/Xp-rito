-- =============================================================================
-- twitter espiritual — foco de imagem (posição)
-- =============================================================================
-- Permite escolher de onde a foto e a capa "cortam" quando exibidas. A foto
-- guarda x e y (object-position; padrão centro 50/50); a capa só y, porque a
-- faixa é larga. As colunas vivem na entidade (characters/organizations) e o
-- trigger de espelho as copia para o actor, igual aos campos de apresentação.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- characters
-- -----------------------------------------------------------------------------
alter table public.characters
  add column avatar_position_x integer not null default 50,
  add column avatar_position_y integer not null default 50,
  add column banner_position_y integer not null default 50;

alter table public.characters
  add constraint characters_avatar_position_x_range check (
    avatar_position_x between 0 and 100
  ),
  add constraint characters_avatar_position_y_range check (
    avatar_position_y between 0 and 100
  ),
  add constraint characters_banner_position_y_range check (
    banner_position_y between 0 and 100
  );

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column avatar_position_x integer not null default 50,
  add column avatar_position_y integer not null default 50,
  add column banner_position_y integer not null default 50;

alter table public.organizations
  add constraint organizations_avatar_position_x_range check (
    avatar_position_x between 0 and 100
  ),
  add constraint organizations_avatar_position_y_range check (
    avatar_position_y between 0 and 100
  ),
  add constraint organizations_banner_position_y_range check (
    banner_position_y between 0 and 100
  );

-- -----------------------------------------------------------------------------
-- actors (espelho)
-- -----------------------------------------------------------------------------
alter table public.actors
  add column avatar_position_x integer not null default 50,
  add column avatar_position_y integer not null default 50,
  add column banner_position_y integer not null default 50;

alter table public.actors
  add constraint actors_avatar_position_x_range check (
    avatar_position_x between 0 and 100
  ),
  add constraint actors_avatar_position_y_range check (
    avatar_position_y between 0 and 100
  ),
  add constraint actors_banner_position_y_range check (
    banner_position_y between 0 and 100
  );

-- -----------------------------------------------------------------------------
-- triggers de espelho passam a copiar o foco
-- -----------------------------------------------------------------------------
create or replace function public.sync_actor_from_character()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.actors (
    character_id, display_name, username, bio, avatar_url, banner_url,
    avatar_position_x, avatar_position_y, banner_position_y
  )
  values (
    new.id, new.name, new.username, new.bio, new.avatar_url, new.banner_url,
    new.avatar_position_x, new.avatar_position_y, new.banner_position_y
  )
  on conflict (character_id) do update
    set display_name         = excluded.display_name,
        username             = excluded.username,
        bio                  = excluded.bio,
        avatar_url           = excluded.avatar_url,
        banner_url           = excluded.banner_url,
        avatar_position_x    = excluded.avatar_position_x,
        avatar_position_y    = excluded.avatar_position_y,
        banner_position_y    = excluded.banner_position_y;

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
  insert into public.actors (
    organization_id, display_name, username, bio, avatar_url, banner_url,
    avatar_position_x, avatar_position_y, banner_position_y
  )
  values (
    new.id, new.name, new.username, new.description, new.avatar_url, new.banner_url,
    new.avatar_position_x, new.avatar_position_y, new.banner_position_y
  )
  on conflict (organization_id) do update
    set display_name         = excluded.display_name,
        username             = excluded.username,
        bio                  = excluded.bio,
        avatar_url           = excluded.avatar_url,
        banner_url           = excluded.banner_url,
        avatar_position_x    = excluded.avatar_position_x,
        avatar_position_y    = excluded.avatar_position_y,
        banner_position_y    = excluded.banner_position_y;

  return new;
end;
$$;

drop trigger if exists characters_sync_actor on public.characters;
create trigger characters_sync_actor
  after insert or update of
    name, username, bio, avatar_url, banner_url,
    avatar_position_x, avatar_position_y, banner_position_y
  on public.characters
  for each row execute function public.sync_actor_from_character();

drop trigger if exists organizations_sync_actor on public.organizations;
create trigger organizations_sync_actor
  after insert or update of
    name, username, description, avatar_url, banner_url,
    avatar_position_x, avatar_position_y, banner_position_y
  on public.organizations
  for each row execute function public.sync_actor_from_organization();