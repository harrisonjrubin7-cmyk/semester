-- Semester — forms: a form somebody else can actually answer.
--
-- Run this after schema.sql, in the Supabase dashboard: SQL Editor → New
-- query → paste → Run. It is safe to run again; every statement is guarded.
--
-- ## What was missing
--
-- `app/src/lib/creations.ts` has built a real form for a long time —
-- branching conditions, nine question types, marking, a CSV-safe export. What
-- it had no version of was the only thing a form is for: somebody else
-- answering it. `formResponse()` was called from exactly one place, the
-- owner's own builder, and the responses sat in a device library on the
-- owner's machine. A form nobody but its author can open is a questionnaire
-- with one respondent.
--
-- ## The answer key cannot travel with the questions
--
-- This is the decision the rest of the file follows from, and it is why
-- publishing is not simply "upload the project".
--
-- `formResponse()` scores at submit time, on the answering device, from the
-- `answer` and `points` on each question. That is correct when the author is
-- the one answering and impossible when they are not: a respondent's browser
-- would be handed the marking scheme for a quiz it is about to sit. And a
-- score computed on the respondent's device is a score the respondent chose,
-- which is not a scoring system.
--
-- So the row is split by who may see it rather than by what it is about:
--
--   * `questions` holds only what a respondent must be shown — id, title,
--     type, required, options, and the branching condition.
--   * `marking` holds the answer key, stays in the owner-only table, and
--     appears in no view and no grant.
--   * A response carries answers and nothing else. **The score is computed on
--     the owner's device when they read the responses**, which is the only
--     place both halves exist at once.
--
-- ## The id is the whole of the authentication
--
-- Like `calendar_feeds`, and for the same reason: a respondent has no account
-- and cannot be asked for one. `gen_random_uuid()` is 122 bits of randomness
-- and the link is the credential, so the deliberate hole must be exactly the
-- shape it was meant to be and no larger. `forms.check.sql` is where that is
-- asserted rather than hoped.

-- ── The form ──────────────────────────────────────────────────────────────

create table if not exists public.forms (
  id              uuid        primary key default gen_random_uuid(),
  owner           uuid        not null references auth.users on delete cascade,
  title           text        not null check (length(title) between 1 and 300),
  description     text        not null default '' check (length(description) <= 4000),
  -- What a respondent is shown. Never the answer key; see the header.
  questions       jsonb       not null default '[]'::jsonb,
  -- The answer key. In no view, in no grant, and read only by the owner.
  marking         jsonb       not null default '{}'::jsonb,
  accepting       boolean     not null default true,
  opens           timestamptz,
  closes          timestamptz,
  -- Null means no cap. A cap is the only defence a link-authenticated form
  -- has against somebody submitting a thousand times, so it is enforced in
  -- `private.form_open` rather than in the client that can be skipped.
  response_limit  integer     check (response_limit is null or response_limit > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists forms_by_owner on public.forms (owner, created_at desc);

alter table public.forms enable row level security;

-- Only the owner, for every verb. A respondent never touches this table: they
-- read the view below, which is a different relation with different grants.
drop policy if exists "read your own forms" on public.forms;
create policy "read your own forms" on public.forms
  for select using ((select auth.uid()) = owner);

drop policy if exists "publish your own forms" on public.forms;
create policy "publish your own forms" on public.forms
  for insert with check ((select auth.uid()) = owner);

drop policy if exists "change your own forms" on public.forms;
create policy "change your own forms" on public.forms
  for update using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);

drop policy if exists "withdraw your own forms" on public.forms;
create policy "withdraw your own forms" on public.forms
  for delete using ((select auth.uid()) = owner);

-- The publishable key in the shipped JavaScript maps to `anon`, so this is
-- the grant that decides whether a stranger can read every form ever made.
revoke all on public.forms from anon;

-- ── What a respondent sees ────────────────────────────────────────────────
--
-- A view rather than a policy, because the question here is not "which rows"
-- but "which columns": `marking` and `owner` must not be selectable at all,
-- and row-level security has nothing to say about columns. A policy plus
-- column grants would have worked too, and been split across two mechanisms
-- that have to agree — this is one relation whose definition *is* the answer.
--
-- It runs with the definer's rights (the Postgres default for a view, and
-- left that way deliberately), so it sees past `forms`' owner-only policies.
-- That makes the WHERE clause the entire gate, which is why it is short
-- enough to read in one breath and why the checks hammer it.

drop view if exists public.published_forms;
create view public.published_forms as
  select id, title, description, questions, opens, closes
    from public.forms
   where accepting
     and (opens is null or opens <= now())
     and (closes is null or closes >= now());

grant select on public.published_forms to anon, authenticated;

-- ── A response ────────────────────────────────────────────────────────────
--
-- No `score` column, and that absence is the point: see the header. No
-- `user_id` either — a respondent may be signed out, and asking a form's
-- respondents to identify themselves is a product decision the form's author
-- makes with a question, not one the schema makes for them.

create table if not exists public.form_responses (
  id          uuid        primary key default gen_random_uuid(),
  form_id     uuid        not null references public.forms on delete cascade,
  answers     jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- The owner's read, and the count `private.form_open` takes on every insert.
create index if not exists responses_by_form on public.form_responses (form_id, created_at desc);

alter table public.form_responses enable row level security;

-- ── Is this form open? ────────────────────────────────────────────────────
--
-- The same question the view asks, plus the cap, as a function — because the
-- insert policy below has to ask it about a form the inserting role cannot
-- read. It is defined here, after the table, rather than beside the view it
-- echoes: a `language sql` body is parsed when the function is created, so a
-- definition above `form_responses` fails on a relation that does not exist
-- yet. `security definer` for exactly that reason, and
-- it answers a boolean about one id rather than returning any of the row.
--
-- `search_path` is pinned: a definer function that resolves `forms` through
-- the caller's search path is a definer function the caller chooses the
-- meaning of.

create or replace function private.form_open(form uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.forms f
     where f.id = form
       and f.accepting
       and (f.opens is null or f.opens <= now())
       and (f.closes is null or f.closes >= now())
       and (
         f.response_limit is null
         or (select count(*) from public.form_responses r where r.form_id = f.id) < f.response_limit
       )
  );
$$;

-- Anybody holding the link, while the form is open and under its cap. This is
-- the one write in this schema that an unauthenticated role may perform, and
-- `private.form_open` is the whole of the gate.
drop policy if exists "answer an open form" on public.form_responses;
create policy "answer an open form" on public.form_responses
  for insert to anon, authenticated
  with check (private.form_open(form_id));

-- And only the form's owner may ever read one back.
drop policy if exists "read answers to your own forms" on public.form_responses;
create policy "read answers to your own forms" on public.form_responses
  for select using (
    exists (select 1 from public.forms f where f.id = form_responses.form_id and f.owner = (select auth.uid()))
  );

drop policy if exists "delete answers to your own forms" on public.form_responses;
create policy "delete answers to your own forms" on public.form_responses
  for delete using (
    exists (select 1 from public.forms f where f.id = form_responses.form_id and f.owner = (select auth.uid()))
  );

-- There is no update policy at all. A submitted answer is not editable by
-- anyone, including the owner: a response the form's author can rewrite is
-- not a response, and a respondent who could rewrite theirs after seeing a
-- mark is not sitting a quiz.

grant insert on public.form_responses to anon, authenticated;
grant select, delete on public.form_responses to authenticated;
