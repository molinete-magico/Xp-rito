-- =============================================================================
-- twitter espiritual — Row Level Security
-- =============================================================================
-- Princípio: autorização é decidida pelo RLS, nunca pelo frontend.
--
-- `public.actors` é somente-leitura para o cliente: a escrita passa por
-- characters/organizations e o trigger espelha, de modo que um actor não pode
-- divergir da sua entidade.
--
-- A rede é privada: nenhuma tabela é legível por `anon`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfis
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.organizations enable row level security;
alter table public.actors enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.hashtags enable row level security;
alter table public.post_hashtags enable row level security;

-- -----------------------------------------------------------------------------
-- Perfis: cada um vê o próprio; o Mestre vê a mesa inteira. O insert/update
-- acontece por trigger no cadastro ou por revogação explícita do papel, por isso
-- não há política de insert aqui.
-- -----------------------------------------------------------------------------
create policy "profiles: ler o próprio ou, para o Mestre, toda a mesa"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_gm());

create policy "profiles: atualizar o próprio"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_gm())
  with check (id = (select auth.uid()) or public.is_gm());

-- A alteração de `role` é barrada em duas camadas: a trigger
-- public.guard_profile_role e o privilégio de coluna abaixo, que não inclui
-- `role` para writes do cliente, exceto via authenticated + guard.
revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar_url, role) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Personagens
-- -----------------------------------------------------------------------------
create policy "characters: perfis públicos são visíveis para a mesa"
  on public.characters for select to authenticated
  using (true);

-- Um jogador só cria personagens seus e nunca marcados como NPC. Um Mestre pode
-- criar NPC (owner_id nulo) ou personagem avulso.
create policy "characters: dono cria o próprio, Mestre cria qualquer"
  on public.characters for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    or (public.is_gm() and (owner_id is null or owner_id = (select auth.uid())))
  );

create policy "characters: dono ou Mestre editam"
  on public.characters for update to authenticated
  using (public.can_edit_character(id))
  with check (public.can_edit_character(id));

create policy "characters: dono ou Mestre removem"
  on public.characters for delete to authenticated
  using (public.can_edit_character(id));

-- -----------------------------------------------------------------------------
-- Organizações — sempre do Mestre
-- -----------------------------------------------------------------------------
create policy "organizations: perfis públicos são visíveis para a mesa"
  on public.organizations for select to authenticated
  using (true);

create policy "organizations: somente o Mestre cria"
  on public.organizations for insert to authenticated
  with check (public.is_gm());

create policy "organizations: somente o Mestre edita"
  on public.organizations for update to authenticated
  using (public.is_gm())
  with check (public.is_gm());

create policy "organizations: somente o Mestre remove"
  on public.organizations for delete to authenticated
  using (public.is_gm());

-- -----------------------------------------------------------------------------
-- Actors — leitura para todos, escrita só por trigger
-- -----------------------------------------------------------------------------
create policy "actors: perfis públicos são visíveis para a mesa"
  on public.actors for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- Publicações
-- -----------------------------------------------------------------------------
create policy "posts: feed público para a mesa"
  on public.posts for select to authenticated
  using (true);

create policy "posts: publica apenas como identidade que controla"
  on public.posts for insert to authenticated
  with check (public.can_manage_actor(actor_id));

create policy "posts: autor edita o próprio texto"
  on public.posts for update to authenticated
  using (public.can_manage_actor(actor_id))
  with check (public.can_manage_actor(actor_id));

create policy "posts: autor ou Mestre removem"
  on public.posts for delete to authenticated
  using (public.can_manage_actor(actor_id) or public.is_gm());

-- -----------------------------------------------------------------------------
-- Mídia das publicações
-- -----------------------------------------------------------------------------
create policy "post_media: visível junto do post"
  on public.post_media for select to authenticated
  using (true);

create policy "post_media: autor do post anexa"
  on public.post_media for insert to authenticated
  with check (public.can_manage_post(post_id));

create policy "post_media: autor do post remove"
  on public.post_media for delete to authenticated
  using (public.can_manage_post(post_id));

-- -----------------------------------------------------------------------------
-- Curtidas
-- -----------------------------------------------------------------------------
create policy "likes: visíveis para a mesa"
  on public.likes for select to authenticated
  using (true);

create policy "likes: curte como identidade que controla"
  on public.likes for insert to authenticated
  with check (public.can_manage_actor(actor_id));

create policy "likes: descurte como identidade que controla"
  on public.likes for delete to authenticated
  using (public.can_manage_actor(actor_id));

-- -----------------------------------------------------------------------------
-- Seguir
-- -----------------------------------------------------------------------------
create policy "follows: visíveis para a mesa"
  on public.follows for select to authenticated
  using (true);

create policy "follows: segue como identidade que controla"
  on public.follows for insert to authenticated
  with check (public.can_manage_actor(follower_id));

create policy "follows: deixa de seguir como identidade que controla"
  on public.follows for delete to authenticated
  using (public.can_manage_actor(follower_id));

-- -----------------------------------------------------------------------------
-- Notificações
-- -----------------------------------------------------------------------------
-- Notificações pertencem a um actor; quem pode gerir aquele actor pode lê-las.
create policy "notifications: apenas os identidades que controlo"
  on public.notifications for select to authenticated
  using (public.can_manage_actor(recipient_actor_id));

create policy "notifications: marcar como lida"
  on public.notifications for update to authenticated
  using (public.can_manage_actor(recipient_actor_id))
  with check (public.can_manage_actor(recipient_actor_id));

-- -----------------------------------------------------------------------------
-- Hashtags
-- -----------------------------------------------------------------------------
create policy "hashtags: navegação pública para a mesa"
  on public.hashtags for select to authenticated
  using (true);

create policy "post_hashtags: navegação pública para a mesa"
  on public.post_hashtags for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- Privilégios
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.characters to authenticated;
grant select, insert, update, delete on public.organizations to authenticated;
grant select on public.actors to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, delete on public.post_media to authenticated;
grant select, insert, delete on public.likes to authenticated;
grant select, insert, delete on public.follows to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.hashtags to authenticated;
grant select on public.post_hashtags to authenticated;

-- `anon` não lê nada: a rede é da mesa.
revoke all on all tables in schema public from anon;
