-- ── A group cannot be moved out from under the class it belongs to ────────
--
-- Run after groups.sql. Safe to run twice.
--
-- The update policy on `public.groups` is:
--
--     for update using (private.in_group(id)) with check (private.in_group(id))
--
-- and the comment above it says what it is for: "Anyone in the group may set
-- the name, the blurb and the date. A group whose deadline only one person can
-- correct is a group with a wrong deadline." That is right, and the policy does
-- not say it. It says any member may write any column, and three of those
-- columns are not the group's own business to change.
--
--   * **`term` and `code`** are the room the group sits in, and they are what
--     every other policy reads to decide who may see it. `groups` is selectable
--     by `private.in_class(term, code)` and `group_members` by
--     `private.group_in_my_class(group_id)` — so one member rewriting `code` to
--     a class of their own moves the group, its name and the list of everybody
--     in it in front of a room none of the other members chose, and takes it
--     out of sight of the room they did. Nothing warns them; the group simply
--     stops appearing where it was.
--
--   * **`created_by`** is the delete authority. The policy next to this one is
--     `for delete using ((select auth.uid()) = created_by)` — "only the starter
--     may delete a group". A member who may write `created_by` may make
--     themselves the starter and delete the group, or hand it to somebody who
--     has left so that nobody can.
--
-- None of that is reachable through the app; `lib/classmates.ts` sends the
-- three fields the comment names. It is reachable with the publishable key and
-- a signed-in account, which is the threat model row-level security is for —
-- the app is not the only client, it is just the polite one.
--
-- ## Why a trigger and not a better policy
--
-- A `with check` expression is evaluated against the new row alone. There is no
-- `OLD` in scope, so a policy cannot express "and this column is what it
-- already was" — the check would have to re-read the table it is protecting,
-- which is the recursion `in_group` exists to avoid. A `BEFORE UPDATE` trigger
-- has both rows and is the ordinary way to say a column is immutable.
--
-- It raises rather than quietly restoring the old value: a write that does not
-- do what it says is worse than one that is refused, and nothing in the app
-- sends these columns, so nothing is broken by the refusal.
--
-- Triggers apply to the service role as well, which is deliberate — a group
-- moving rooms should be a thing somebody decided to do, not something a
-- maintenance script does by rewriting a row. Where that really is wanted:
-- `alter table public.groups disable trigger groups_pinned;` for the duration.

create or replace function private.refuse_column_change()
returns trigger
language plpgsql
-- The body reads only its own arguments and the rows the trigger hands it, so
-- an empty search_path costs nothing and closes the usual hole.
set search_path = ''
as $$
declare
  col text;
begin
  foreach col in array tg_argv loop
    if to_jsonb(new) -> col is distinct from to_jsonb(old) -> col then
      raise exception '% cannot be changed after the row is created', col
        using errcode = 'restrict_violation';
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function private.refuse_column_change() from public, anon, authenticated;

-- `id` is in the list with the rest. It is the primary key and the thing every
-- other table's foreign key points at, and leaving it out because "nobody would"
-- is how the other three got left out.
drop trigger if exists groups_pinned on public.groups;
create trigger groups_pinned
  before update on public.groups
  for each row
  execute function private.refuse_column_change('id', 'term', 'code', 'created_by', 'created_at');

-- The same shape on the parts, for the same reason and with less at stake: a
-- part belongs to the group it was added to, and `group_id` is what
-- `private.in_group(group_id)` reads to decide who may see it. The update
-- policy there checks the *new* group, so a member could only move a part into
-- another group they are also in — which is not an exposure, but it is still a
-- part vanishing from one group's list without that group doing anything.
drop trigger if exists group_tasks_pinned on public.group_tasks;
create trigger group_tasks_pinned
  before update on public.group_tasks
  for each row
  execute function private.refuse_column_change('id', 'group_id', 'created_by', 'created_at');
