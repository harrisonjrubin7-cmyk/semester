-- Semester — a gradebook item has a due date, and an approved extension moves
-- it for the one student it was granted to.
--
-- Until this file a gradebook item had no due date at all, so an extension
-- approved through `course_request_decide` (20261021120000) was recorded as
-- the request's `granted_due` and moved nothing. This file gives an item an
-- optional due date and answers, per item and per student, the date that
-- student's work is due.
--
-- What it decides, and where:
--
--   * **Who sets a due date.** Whoever adds items: `grades:release` on the
--     item's course and term (`gradebook_add_item` checks the same). No new
--     capability. A teaching assistant, who holds `grades:enter`, does not.
--   * **On the item, versioned.** `gradebook_items.due_at` (timestamptz, null
--     for "no due date") and `due_version`, which every change bumps. A
--     change names the version the caller read; one that moved since is
--     refused with SQLSTATE 40001 and writes nothing, as course requests are.
--     Items are otherwise still append-only: only `gradebook_set_due` changes
--     a row, and only these two columns.
--   * **Idempotent and audited, on the gradebook's ledger.** The key spends
--     under the existing kind `item` — setting a due date is an edit of an
--     item — so the ledger's kind check is not redefined here (#1653 and
--     #1658 both redefine it already). The ledger row is the audit of the
--     change: who, when, the date asked for and the version expected.
--   * **The effective date.** `gradebook_due_dates` answers one row per item
--     for the course (`student_id` null: the item's own date) and one row per
--     student holding an approved extension on that item. It is
--     `security invoker`: row-level security on `gradebook_items` and
--     `course_requests` decides what it returns, so a student gets the
--     course's dates and their own extensions, the course's request readers
--     (faculty and teaching assistants, `course_requests:view`/`:decide`) get
--     every student's, and anybody else gets nothing. Approving an extension
--     changes the answer with no further step; a request that is open,
--     asking, denied or withdrawn changes nothing.
--   * **Owner decisions, as defaults (D-1658 §9).** A granted date is
--     honoured through the end of that day anywhere on Earth (23:59:59 at
--     UTC−12): schools have no time zone column, and a granted day must not
--     end early for a student west of the server. The latest approved
--     extension on an item (by decision time) is the one in force. An
--     extension never makes a date earlier: the effective date is the later
--     of the item's date and the granted one, and it reads as extended only
--     when the granted date is the later. An extension that names no item
--     moves no item's date.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── The columns ───────────────────────────────────────────────────────────

alter table public.gradebook_items add column if not exists due_at timestamptz;
alter table public.gradebook_items add column if not exists due_version integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gradebook_items_due_version_check') then
    alter table public.gradebook_items
      add constraint gradebook_items_due_version_check check (due_version >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gradebook_items_due_at_check') then
    alter table public.gradebook_items
      add constraint gradebook_items_due_at_check
      check (due_at is null or (due_at >= '2000-01-01T00:00:00Z' and due_at < '2100-01-01T00:00:00Z'));
  end if;
end $$;

comment on table public.gradebook_items is 'The graded items of a course and term, each in a scheme category. Append-only, except the due date, which only gradebook_set_due changes, each change versioned and keyed on the ledger.';
comment on column public.gradebook_items.due_at is 'When the item is due, or null for no due date. Set by gradebook_set_due; an approved extension moves it for one student (gradebook_due_dates).';
comment on column public.gradebook_items.due_version is 'How many times the due date has been set; a change names the version it read.';

-- ── Setting a due date ────────────────────────────────────────────────────
-- `want_due` null clears the date. Answers {item, due, version}.

create or replace function public.gradebook_set_due(want_item uuid, want_due timestamptz, want_expect integer, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
  it     public.gradebook_items;
  req    jsonb := jsonb_build_object('item', want_item, 'due', want_due, 'expect', want_expect);
  prior  jsonb;
  answer jsonb;
begin
  select * into it from public.gradebook_items i where i.id = want_item and i.tenant_id = school for update;
  if not found then raise exception 'semester: no such item here' using errcode = 'check_violation'; end if;
  perform private.gradebook_require(school, it.course_code, it.term, 'grades:release', false);
  prior := private.gradebook_replay(school, want_key, 'item', req);
  if prior is not null then return prior; end if;

  if want_expect is null or it.due_version <> want_expect then
    raise exception 'semester: this item''s due date changed since you read it (it is at version % now). Reload it and look again', it.due_version
      using errcode = 'serialization_failure';
  end if;
  if want_due is not null and (want_due < '2000-01-01T00:00:00Z' or want_due >= '2100-01-01T00:00:00Z') then
    raise exception 'semester: that due date is out of range' using errcode = 'check_violation';
  end if;
  if it.due_at is not distinct from want_due then
    raise exception 'semester: that is already the due date' using errcode = 'check_violation';
  end if;

  update public.gradebook_items
     set due_at = want_due, due_version = due_version + 1
   where id = it.id
  returning * into it;
  answer := jsonb_build_object('item', it.id, 'due', it.due_at, 'version', it.due_version);
  perform private.gradebook_spend(school, want_key, 'item', req, answer);
  return answer;
end $$;

revoke all on function public.gradebook_set_due(uuid, timestamptz, integer, text) from public, anon, authenticated;
grant execute on function public.gradebook_set_due(uuid, timestamptz, integer, text) to authenticated;

-- ── The effective date ────────────────────────────────────────────────────
-- Invoker: the caller's own row-level security decides every row. The course
-- is the caller's school's, from their profile.

create or replace function public.gradebook_due_dates(want_course text, want_term text)
returns table (item_id uuid, title text, student_id uuid, item_due timestamptz, due_version integer,
               granted_due date, request_id uuid, effective_due timestamptz, extended boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with items as (
    select i.id, i.title, i.due_at, i.due_version, i.created_at
      from public.gradebook_items i
      join public.profiles p on p.user_id = (select auth.uid()) and p.school_id = i.tenant_id
     where i.course_code = want_course and i.term = want_term
  ),
  granted as (
    -- The latest approved extension per item and student, by decision time.
    select distinct on (r.item_id, r.student_id)
           r.item_id, r.student_id, r.granted_due, r.id,
           ((r.granted_due + 1)::timestamp + interval '11 hours 59 minutes 59 seconds') at time zone 'UTC' as until
      from public.course_requests r
      join items i on i.id = r.item_id
     where r.kind = 'extension' and r.status = 'approved' and r.granted_due is not null
     order by r.item_id, r.student_id, r.decided_at desc, r.filed_at desc, r.id
  )
  select x.item_id, x.title, x.student_id, x.item_due, x.due_version, x.granted_due, x.request_id, x.effective_due, x.extended
    from (
      select i.id as item_id, i.title, null::uuid as student_id, i.due_at as item_due, i.due_version,
             null::date as granted_due, null::uuid as request_id, i.due_at as effective_due, false as extended,
             i.created_at as made
        from items i
      union all
      select i.id, i.title, g.student_id, i.due_at, i.due_version, g.granted_due, g.id,
             greatest(i.due_at, g.until),
             i.due_at is null or g.until > i.due_at,
             i.created_at
        from granted g
        join items i on i.id = g.item_id
    ) x
   order by x.made, x.title, x.item_id, x.student_id nulls first;
$$;

revoke all on function public.gradebook_due_dates(text, text) from public, anon, authenticated;
grant execute on function public.gradebook_due_dates(text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   drop function if exists public.gradebook_due_dates(text, text);
--   drop function if exists public.gradebook_set_due(uuid, timestamptz, integer, text);
--   alter table public.gradebook_items drop constraint if exists gradebook_items_due_at_check;
--   alter table public.gradebook_items drop constraint if exists gradebook_items_due_version_check;
--   alter table public.gradebook_items drop column if exists due_version;
--   alter table public.gradebook_items drop column if exists due_at;
--   comment on table public.gradebook_items is 'The graded items of a course and term, each in a scheme category. Append-only.';
--   commit;
--   -- Ledger rows spent under kind 'item' by gradebook_set_due stay; their
--   -- request names 'due' and 'expect', so they are told apart from adds.
