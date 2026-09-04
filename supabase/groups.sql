-- Group work — the four-person case, as a thing the app can hold.
--
-- Run this after classmates.sql, which it builds on: a group lives inside a
-- class room, and the same three gates apply — you are verified, you are in
-- that class, and a blocked person cannot reach you. Safe to run twice.
--
-- A group project is one deadline in the app and four people's worth of work
-- in life. Who has which section, what is done, and the answer to "are we
-- going to make this" a week out, which nobody asks until it is too late to
-- matter.
--
-- ## Why a group is not just a room
--
-- classmates.sql already gives every class a room. A group is smaller than a
-- room and outlives a conversation: it has members who are a subset of the
-- class, a deliverable with a date, and a list of parts with owners. Those
-- do not belong in a message stream, and a message stream cannot answer
-- "what is unclaimed".
--
-- ## The recursion trap, and the way round it
--
-- The obvious policy for a task is "visible to members of its group", and the
-- obvious policy for a membership row is "visible to members of that group" —
-- which is a policy that reads the table it is protecting, and Postgres
-- refuses it. `in_group` is security definer for exactly that reason, the
-- same shape `in_class` already uses in classmates.sql.

-- ── Groups ────────────────────────────────────────────────────────────────

create table if not exists public.groups (
  id          uuid        primary key default gen_random_uuid(),
  term        text        not null,
  code        text        not null,
  name        text        not null check (length(trim(name)) between 1 and 120),
  -- What it is for, in one line. Optional.
  about       text        not null default '' check (length(about) <= 400),
  -- ISO date the whole thing is due. Empty when the group has not set one.
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

-- Whether you are in a group. Security definer, so the policy on
-- group_members does not have to read group_members and deadlock on itself.
create or replace function public.in_group(want_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = want_group and m.user_id = auth.uid()
  );
$$;

-- Which room a group is in, for the class-membership check.
create or replace function public.group_room(want_group uuid)
returns table (term text, code text)
language sql
stable
security definer
set search_path = public
as $$
  select g.term, g.code from public.groups g where g.id = want_group;
$$;

create or replace function public.group_in_my_class(want_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups g
    where g.id = want_group and public.in_class(g.term, g.code)
  );
$$;

-- A group is visible to the class it sits in, so somebody can find theirs and
-- join it. Its tasks are not — those need membership.
drop policy if exists "groups are visible to the class" on public.groups;
create policy "groups are visible to the class" on public.groups
  for select
  using (public.verified_student() and public.in_class(term, code));

drop policy if exists "start a group in a class you are in" on public.groups;
create policy "start a group in a class you are in" on public.groups
  for insert
  with check (
    auth.uid() = created_by
    and public.verified_student()
    and public.in_class(term, code)
  );

-- Anyone in the group may set the name, the blurb and the date. A group whose
-- deadline only one person can correct is a group with a wrong deadline.
drop policy if exists "members may edit their group" on public.groups;
create policy "members may edit their group" on public.groups
  for update
  using (public.in_group(id))
  with check (public.in_group(id));

drop policy if exists "only the starter may delete a group" on public.groups;
create policy "only the starter may delete a group" on public.groups
  for delete
  using (auth.uid() = created_by);

-- ── Membership ────────────────────────────────────────────────────────────

drop policy if exists "see who is in a group in your class" on public.group_members;
create policy "see who is in a group in your class" on public.group_members
  for select
  using (public.verified_student() and public.group_in_my_class(group_id));

drop policy if exists "join a group yourself" on public.group_members;
create policy "join a group yourself" on public.group_members
  for insert
  with check (
    auth.uid() = user_id
    and public.verified_student()
    and public.group_in_my_class(group_id)
  );

-- You leave; nobody removes you. A group that can eject a member is a group
-- that can eject a member over a disagreement about the work.
drop policy if exists "leave a group yourself" on public.group_members;
create policy "leave a group yourself" on public.group_members
  for delete
  using (auth.uid() = user_id);

-- ── The parts ─────────────────────────────────────────────────────────────

create table if not exists public.group_tasks (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        not null references public.groups on delete cascade,
  title       text        not null check (length(trim(title)) between 1 and 200),
  -- Who has it. Null means nobody yet, which is the state worth counting.
  owner       uuid        references auth.users on delete set null,
  done        boolean     not null default false,
  -- ISO date this part is wanted by. Empty when only the group's date matters.
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
  using (public.in_group(group_id));

drop policy if exists "members add parts" on public.group_tasks;
create policy "members add parts" on public.group_tasks
  for insert
  with check (auth.uid() = created_by and public.in_group(group_id));

-- Any member may claim a part, tick one, or correct a title. Group work does
-- not survive a permission model where only the author of a line may fix it.
drop policy if exists "members change the parts" on public.group_tasks;
create policy "members change the parts" on public.group_tasks
  for update
  using (public.in_group(group_id))
  with check (public.in_group(group_id));

drop policy if exists "members remove parts" on public.group_tasks;
create policy "members remove parts" on public.group_tasks
  for delete
  using (public.in_group(group_id));

-- ── Keeping updated_at honest ─────────────────────────────────────────────

drop trigger if exists group_tasks_touch on public.group_tasks;
create trigger group_tasks_touch before insert or update on public.group_tasks
  for each row execute function public.touch_updated_at();
