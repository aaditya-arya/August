begin;

-- Nullable ownership preserves pre-login records. They remain hidden until an
-- administrator assigns them to their verified owner; no first-login claiming.
alter table public.notes add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table public.extracted_items add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table public.graph_edges add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists extracted_items_user_id_idx on public.extracted_items(user_id);
create index if not exists graph_edges_user_id_idx on public.graph_edges(user_id);

alter table public.notes enable row level security;
alter table public.extracted_items enable row level security;
alter table public.graph_edges enable row level security;

-- Restrictive policies apply even if the project previously had permissive demo
-- policies. Anonymous access is explicitly removed as well.
revoke all on public.notes, public.extracted_items, public.graph_edges from public, anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.notes, public.extracted_items, public.graph_edges to authenticated;

drop policy if exists account_notes_allow on public.notes;
create policy account_notes_allow on public.notes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists account_notes_boundary on public.notes;
create policy account_notes_boundary on public.notes as restrictive for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists account_items_allow on public.extracted_items;
create policy account_items_allow on public.extracted_items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.notes n where n.id = note_id and n.user_id = (select auth.uid())));
drop policy if exists account_items_boundary on public.extracted_items;
create policy account_items_boundary on public.extracted_items as restrictive for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.notes n where n.id = note_id and n.user_id = (select auth.uid())));

drop policy if exists account_edges_allow on public.graph_edges;
create policy account_edges_allow on public.graph_edges for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.extracted_items a where a.id = source_node_id and a.user_id = (select auth.uid())) and exists (select 1 from public.extracted_items b where b.id = target_node_id and b.user_id = (select auth.uid())));
drop policy if exists account_edges_boundary on public.graph_edges;
create policy account_edges_boundary on public.graph_edges as restrictive for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.extracted_items a where a.id = source_node_id and a.user_id = (select auth.uid())) and exists (select 1 from public.extracted_items b where b.id = target_node_id and b.user_id = (select auth.uid())));

-- Keep ownership immutable so changing a parent cannot orphan another account's
-- records. New rows take ownership from the authenticated JWT.
create or replace function public.keep_journal_owner() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.user_id is distinct from new.user_id then
    raise exception 'Journal ownership cannot be changed by an application client';
  end if;
  return new;
end;
$$;
drop trigger if exists keep_notes_owner on public.notes;
create trigger keep_notes_owner before update of user_id on public.notes for each row when (current_user in ('anon', 'authenticated')) execute function public.keep_journal_owner();
drop trigger if exists keep_items_owner on public.extracted_items;
create trigger keep_items_owner before update of user_id on public.extracted_items for each row when (current_user in ('anon', 'authenticated')) execute function public.keep_journal_owner();
drop trigger if exists keep_edges_owner on public.graph_edges;
create trigger keep_edges_owner before update of user_id on public.graph_edges for each row when (current_user in ('anon', 'authenticated')) execute function public.keep_journal_owner();

-- This existing vector helper must run as the caller so RLS scopes its results.
alter function public.match_similar_nodes(vector, uuid, double precision, integer) security invoker;
alter function public.match_similar_nodes(vector, uuid, double precision, integer) set search_path = public, extensions;
revoke all on function public.match_similar_nodes(vector, uuid, double precision, integer) from public, anon;
grant execute on function public.match_similar_nodes(vector, uuid, double precision, integer) to authenticated;

create or replace function public.account_security_version() returns integer language sql security invoker set search_path = '' as $$
  select case when (select auth.uid()) is not null and
    (select count(*) = 3 and bool_and(c.relrowsecurity) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('notes', 'extracted_items', 'graph_edges')) and
    (select count(*) = 3 from pg_catalog.pg_policy p join pg_catalog.pg_class c on c.oid = p.polrelid join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not p.polpermissive and p.polname in ('account_notes_boundary', 'account_items_boundary', 'account_edges_boundary'))
  then 1 else 0 end;
$$;
revoke all on function public.account_security_version() from public, anon;
grant execute on function public.account_security_version() to authenticated;

commit;
