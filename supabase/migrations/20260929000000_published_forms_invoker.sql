-- Semester — `published_forms` answers to the caller's row-level security.
--
-- ## The finding
--
-- Supabase's advisor, lint 0010 `security_definer_view`, level ERROR, on the
-- live project on 28 September 2026: "View `public.published_forms` is
-- defined with the SECURITY DEFINER property". It was the only view in the
-- schema, and the only finding at that level.
--
-- `20260921143455_forms.sql` made it that way on purpose and says so: the view
-- runs with its owner's rights so that its WHERE clause can stand in front of
-- `forms`' owner-only policies, and it hides `marking` and `owner` by not
-- selecting them. That design worked, and it cost a P0 on the day it shipped —
-- the owner's rights plus Supabase's default ALL grant made the view a write
-- path that met no policy at all (the foot of that file has the measurement).
-- The revoke closed the write. What it could not close is the shape: a
-- relation a signed-out visitor reads, whose only gate is a WHERE clause that
-- runs as somebody who is not them. Any later edit to that clause, or any
-- grant that comes back, is unguarded by row-level security by construction.
--
-- ## Why not simply `security_invoker = true` on the same view
--
-- Because as the caller, the view would need to read `forms`, and every way
-- of letting it do that hands out something the old view kept back:
--
--   * A policy on `forms` letting anybody read open rows, plus column grants
--     that leave out `marking`. `authenticated` needs table-level SELECT on
--     `forms` today (the owner's `delete … where owner = me` in `lib/cloud.ts`
--     needs SELECT on `owner`), so a signed-in stranger would read `owner` —
--     the author's account id — off every open form, which `forms.check.sql`
--     exists to refuse. Take `owner` off the grant and account deletion stops
--     working. Policies are per row; this question is per column.
--   * A definer function behind an invoker view. That satisfies the linter
--     and changes nothing: the gate is still a WHERE running as the owner.
--
-- ## What this does instead
--
-- The respondent's half of a form moves into a relation of its own,
-- `public.form_publications`, which holds only what a respondent may be shown
-- — no `marking`, no `owner`, no `response_limit` — so there is no column in
-- it to hide. It has row-level security like any table, one read policy that
-- is the open-window test the view's WHERE used to be, and no write grant or
-- write policy for any client role. A trigger on `forms` keeps it in step, and
-- the foreign key takes a row with its form.
--
-- `published_forms` stays, with the same name and the same six columns, so
-- `lib/formshare.ts` does not change, and is now `security_invoker = true`
-- over that table: a signed-out respondent reads it as `anon`, under the
-- policy, and the policy is the gate.
--
-- `private.form_open` — the insert gate on `form_responses` — is untouched. It
-- is a definer function in `private`, which PostgREST does not expose, and it
-- has to count responses the inserting role cannot read.

-- ── The respondent's half ─────────────────────────────────────────────────

create table if not exists public.form_publications (
  id           uuid        primary key references public.forms on delete cascade,
  title        text        not null,
  description  text        not null default '',
  questions    jsonb       not null default '[]'::jsonb,
  accepting    boolean     not null,
  opens        timestamptz,
  closes       timestamptz
);

alter table public.form_publications enable row level security;

-- The gate. The same test the definer view's WHERE was, now a policy that runs
-- as whoever is asking.
drop policy if exists "read an open form" on public.form_publications;
create policy "read an open form" on public.form_publications
  for select to anon, authenticated
  using (
    accepting
    and (opens is null or opens <= now())
    and (closes is null or closes >= now())
  );

-- Revoke first: see the foot of `20260921143455_forms.sql` for what a bare
-- grant on top of Supabase's default ALL cost. Read-only for both roles; the
-- only writer is the trigger below.
revoke all on public.form_publications from anon, authenticated;
grant select on public.form_publications to anon, authenticated;

-- ── Kept in step with `forms` ─────────────────────────────────────────────
--
-- `security definer` because the author writing `forms` holds no write on
-- `form_publications`, and must not: a client that could write this table
-- could publish a form it does not own. A trigger function is not callable
-- through the API (PostgREST will not call a function returning `trigger`),
-- and EXECUTE is revoked from every client role regardless — it is checked
-- when the trigger is created, not when it fires, so the author's insert still
-- runs it.

create or replace function private.sync_form_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.form_publications (id, title, description, questions, accepting, opens, closes)
  values (new.id, new.title, new.description, new.questions, new.accepting, new.opens, new.closes)
  on conflict (id) do update
     set title       = excluded.title,
         description = excluded.description,
         questions   = excluded.questions,
         accepting   = excluded.accepting,
         opens       = excluded.opens,
         closes      = excluded.closes;
  return null;
end;
$$;

revoke all on function private.sync_form_publication() from public, anon, authenticated;

drop trigger if exists forms_sync_publication on public.forms;
create trigger forms_sync_publication
  after insert or update of title, description, questions, accepting, opens, closes
  on public.forms
  for each row execute function private.sync_form_publication();

-- Every form that exists already. Idempotent: a second run rewrites each row
-- with the values it already holds.
insert into public.form_publications (id, title, description, questions, accepting, opens, closes)
select id, title, description, questions, accepting, opens, closes
  from public.forms
on conflict (id) do update
   set title       = excluded.title,
       description = excluded.description,
       questions   = excluded.questions,
       accepting   = excluded.accepting,
       opens       = excluded.opens,
       closes      = excluded.closes;

-- ── The view, as the caller ───────────────────────────────────────────────
--
-- Same name, same columns in the same order, so `create or replace` keeps
-- every dependency and the client does not notice. No WHERE of its own: the
-- policy is the gate, and a second copy of it here would be a second place for
-- the two to disagree — and would leave `forms.check.sql` unable to tell which
-- one it was testing.

create or replace view public.published_forms
  with (security_invoker = true)
  as select id, title, description, questions, opens, closes
       from public.form_publications;

revoke all on public.published_forms from anon, authenticated;
grant select on public.published_forms to anon, authenticated;
