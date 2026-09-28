-- =============================================================================
-- twitter espiritual — função de contagem e Realtime
--
-- A interface atualiza o contador de não lidas em tempo real. Com RLS o cliente
-- não tem um canal simples de "mudou aqui": ele é avisado pelo Realtime e refaz
-- a contagem por esta função, que roda com os privilégios de quem chama (sem
-- SECURITY DEFINER). O RLS já garante que só vêm as notificações das
-- identidades que a pessoa controla.
-- =============================================================================

create or replace function public.count_unread_notifications()
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.notifications n
  where n.read = false
    and public.can_manage_actor(n.recipient_actor_id);
$$;

comment on function public.count_unread_notifications() is
  'Quantas notificações não lidas existem para as identidades que a pessoa controla. Sujeita ao RLS.';

grant execute on function public.count_unread_notifications() to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime
--
-- A publicação só existe em um projeto Supabase de verdade; o bloco é guardado
-- para que as migrations continuem aplicáveis no Postgres de teste.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
      execute 'alter publication supabase_realtime add table public.notifications';
    end if;
  end if;
end;
$$;
