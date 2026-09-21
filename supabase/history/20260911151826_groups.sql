-- Group work — the four-person case, as a thing the app can hold.
-- Mirrors supabase/groups.sql in the repository. Safe to run twice.

create table if not exists public.groups (
  id          uuid        primary key default gen_random_uuid(),
  term        text        not null,
  code        text        not null,
  name        text        not null check (length(trim(name)) between 1 and 120),
  about       text        not null default '' check (length(about) <= 400),
  due         text        not null default '',
  created_by  uuid        not null references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists groups_by_room on public.groups (term, code, created_at desc);

alter table public.groups enable row level security;

create table if not exists public.group_members (
  group_id    uuid        not null references public.groups on delete cascade,
  user_id     uuid        not null references auth.users on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_members enable row level security;

create or replace function private.in_group(want_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = want_group and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.group_room(want_group uuid)
returns table (term text, code text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.term, g.code from public.groups g where g.id = want_group;
$$;

create or replace function private.group_in_my_class(want_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.groups g
    where g.id = want_group and private.in_class(g.term, g.code)
  );
$$;

revoke all on function private.in_group(uuid) from public;
revoke all on function private.group_room(uuid) from public;
revoke all on function private.group_in_my_class(uuid) from public;

grant execute on function private.in_group(uuid) to anon, authenticated;
grant execute on function private.group_room(uuid) to anon, authenticated;
grant execute on function private.group_in_my_class(uuid) to anon, authenticated;

drop policy if exists "groups are visible to the class" on public.groups;
create policy "groups are visible to the class" on public.groups
  for select
  using (private.verified_student() and private.in_class(term, code));

drop policy if exists "start a group in a class you are in" on public.groups;
create policy "start a group in a class you are in" on public.groups
  for insert
  with check (
    (select auth.uid()) = created_by
    and private.verified_student()
    and private.in_class(term, code)
  );

drop policy if exists "members may edit their group" on public.groups;
create policy "members may edit their group" on public.groups
  for update
  using (private.in_group(id))
  with check (private.in_group(id));

drop policy if exists "only the starter may delete a group" on public.groups;
create policy "only the starter may delete a group" on public.groups
  for delete
  using ((select auth.uid()) = created_by);

drop policy if exists "see who is in a group in your class" on public.group_members;
create policy "see who is in a group in your class" on public.group_members
  for select
  using (private.verified_student() and private.group_in_my_class(group_id));

drop policy if exists "join a group yourself" on public.group_members;
create policy "join a group yourself" on public.group_members
  for insert
  with check (
    (select auth.uid()) = user_id
    and private.verified_student()
    and private.group_in_my_class(group_id)
  );

drop policy if exists "leave a group yourself" on public.group_members;
create policy "leave a group yourself" on public.group_members
  for delete
  using ((select auth.uid()) = user_id);

create table if not exists public.group_tasks (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        not null references public.groups on delete cascade,
  title       text        not null check (length(trim(title)) between 1 and 200),
  owner       uuid        references auth.users on delete set null,
  done        boolean     not null default false,
  due         text        not null default '',
  created_by  uuid        not null references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists group_tasks_by_group on public.group_tasks (group_id, created_at);

alter table public.group_tasks enable row level security;

drop policy if exists "members read the parts" on public.group_tasks;
create policy "members read the parts" on public.group_tasks
  for select
  using (private.in_group(group_id));

drop policy if exists "members add parts" on public.group_tasks;
create policy "members add parts" on public.group_tasks
  for insert
  with check ((select auth.uid()) = created_by and private.in_group(group_id));

drop policy if exists "members change the parts" on public.group_tasks;
create policy "members change the parts" on public.group_tasks
  for update
  using (private.in_group(group_id))
  with check (private.in_group(group_id));

drop policy if exists "members remove parts" on public.group_tasks;
create policy "members remove parts" on public.group_tasks
  for delete
  using (private.in_group(group_id));

drop trigger if exists group_tasks_touch on public.group_tasks;
create trigger group_tasks_touch before insert or update on public.group_tasks
  for each row execute function public.touch_updated_at();
