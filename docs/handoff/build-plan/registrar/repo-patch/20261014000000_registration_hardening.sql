-- 20261014000000_registration_hardening.sql — additive changes to the existing registration transaction
-- (supabase/migrations/20260929300000_registration_transaction.sql). Gaps 1–4 and 6 in handoff/build-plan/registrar/PRODUCTION-DIFF.md.
-- NOT RUN. Apply on a branch after 20260929300000, run supabase/registration_transaction.check.sql + registration_hardening.check.sql.

-- ── Precondition: FORCE RLS applies to the table owner unless the owner can bypass RLS. Every writer here is
-- security definer and runs as the owner, with no insert/update policies — so if the owner can't bypass RLS,
-- forcing it would stop every registration, ledger and gradebook write. Refuse to continue in that case.
do $$ declare bad text; begin
  select string_agg(c.relname || ' (owner ' || r.rolname || ')', ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_roles r on r.oid = c.relowner
   where n.nspname = 'public' and c.relkind = 'r' and not (r.rolsuper or r.rolbypassrls)
     and (c.relname like 'registration\_%' or c.relname like 'academic\_record\_%' or c.relname like 'gradebook\_%'
          or c.relname in ('grade_entries','regrade_requests','regrade_resolutions','grade_passbacks'));
  if bad is not null then
    raise exception 'registration_hardening: owner cannot bypass RLS, so FORCE RLS would block definer writers: %', bad;
  end if;
end $$;

-- ── Gap 1: force RLS (definer writers run as an owner that bypasses RLS, checked above) ──
do $$ declare t text; begin
  foreach t in array array['registration_terms','registration_sections','registration_enrollments','registration_holds',
                           'registration_completions','registration_overrides','registration_requests','registration_audit_event'] loop
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ── Gap 2: tenant-consistent references ──
alter table public.registration_sections add constraint registration_sections_tenant_id_unique unique (tenant_id, id);
-- validate separately so a large table isn't locked for the whole check
alter table public.registration_enrollments
  add constraint registration_enrollments_section_same_tenant foreign key (tenant_id, section_id)
  references public.registration_sections (tenant_id, id) on delete cascade not valid;
alter table public.registration_overrides
  add constraint registration_overrides_section_same_tenant foreign key (tenant_id, section_id)
  references public.registration_sections (tenant_id, id) on delete cascade not valid;
alter table public.registration_enrollments validate constraint registration_enrollments_section_same_tenant;
alter table public.registration_overrides validate constraint registration_overrides_section_same_tenant;

-- ── Gap 6: effective vs recorded time (late corrections apply to an earlier date) ──
alter table public.registration_enrollments add column if not exists effective_at timestamptz;
update public.registration_enrollments set effective_at = created_at where effective_at is null;
alter table public.registration_enrollments alter column effective_at set default now(), alter column effective_at set not null;

-- ── Gap 4: overrides — expiry, use limit, separation of duties where the school requires it ──
alter table public.registration_overrides
  add column if not exists requested_by uuid references auth.users on delete set null,
  add column if not exists valid_until timestamptz,
  add column if not exists uses_allowed integer not null default 1 check (uses_allowed between 1 and 20),
  add column if not exists uses integer not null default 0 check (uses >= 0);
alter table public.registration_overrides add constraint registration_overrides_within_uses check (uses <= uses_allowed);
alter table public.registration_overrides add constraint registration_overrides_not_self_approved
  check (requested_by is null or granted_by is null or requested_by <> granted_by);
create index if not exists registration_overrides_by_requester on public.registration_overrides (requested_by);

-- Which waivers need a second person, per school. Empty = registrar may grant alone (today's behaviour).
create table if not exists public.registration_override_policy (
  tenant_id text not null references public.schools(id) on delete cascade,
  waiver    text not null check (waiver in ('capacity','prerequisite','time_conflict','credit_limit','approval','late_add')),
  needs_second_person boolean not null default false,
  primary key (tenant_id, waiver)
);
alter table public.registration_override_policy enable row level security;
alter table public.registration_override_policy force row level security;
revoke all on public.registration_override_policy from anon, authenticated;

-- A waiver counts only while unexpired and under its use limit.
create or replace function private.registration_waived(want_student uuid, want_section uuid, want_kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.registration_overrides o
     where o.student = want_student and o.section_id = want_section and want_kind = any(o.waives)
       and (o.valid_until is null or o.valid_until > now())
       and o.uses < o.uses_allowed);
$$;
revoke all on function private.registration_waived(uuid, uuid, text) from public, anon, authenticated;
-- Hand edit 1 — count override uses. Done as a trigger so registration_enroll and registration_promote stay untouched:
-- whenever an enrollment becomes 'enrolled' (a new seat, an approval, or a promotion off the waitlist), every override
-- in effect for that student and section is used once. Same transaction as the enrollment, so a rollback undoes the count.
create or replace function private.registration_count_override_use() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'enrolled' and (tg_op = 'INSERT' or old.state is distinct from 'enrolled') then
    update public.registration_overrides o set uses = o.uses + 1
     where o.student = new.student and o.section_id = new.section_id
       and (o.valid_until is null or o.valid_until > now()) and o.uses < o.uses_allowed;
  end if;
  return new;
end $$;
revoke all on function private.registration_count_override_use() from public, anon, authenticated;
drop trigger if exists registration_count_override_use on public.registration_enrollments;
create trigger registration_count_override_use after insert or update of state on public.registration_enrollments
  for each row execute function private.registration_count_override_use();

-- ── Gap 3: swap — drop + enroll atomically under the term lock ──
-- Enroll's refusals are jsonb (not exceptions), so swap checks the answer and raises to roll back the drop.
create or replace function public.registration_swap(want_from uuid, want_to uuid, want_key text, want_expect text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me     uuid := (select auth.uid());
  school text := private.registration_school();
  k      text := private.registration_key(want_key);
  print  text := md5(jsonb_build_array('swap', want_from, want_to, want_expect)::text);
  prior  jsonb; a jsonb; b jsonb; s_from public.registration_sections; s_to public.registration_sections;
begin
  prior := private.registration_replay(me, k, 'swap', print);
  if prior is not null then return prior; end if;
  select * into s_from from public.registration_sections where id = want_from and tenant_id = school;
  select * into s_to   from public.registration_sections where id = want_to   and tenant_id = school;
  if s_from.id is null or s_to.id is null then return private.registration_refusal('unknown_section', 'No such section this term.'); end if;
  if s_from.term <> s_to.term then return private.registration_refusal('different_terms', 'Both sections must be in the same term.'); end if;
  perform private.registration_lock_term(school, s_from.term);   -- re-entrant for the inner calls
  begin
    a := public.registration_drop(want_from, left(k, 120) || ':drop');
    if not (a->>'ok')::boolean then raise exception using errcode = 'P0001', message = 'swap_drop_refused', detail = a::text; end if;
    b := public.registration_enroll(want_to, left(k, 120) || ':add', want_expect);
    if not (b->>'ok')::boolean then raise exception using errcode = 'P0001', message = 'swap_add_refused', detail = b::text; end if;
  exception when sqlstate 'P0001' then
    -- both halves rolled back to the savepoint; the original enrollment is untouched
    return private.registration_refusal(case sqlerrm when 'swap_add_refused' then 'swap_add_refused' else 'swap_drop_refused' end,
      'The swap didn''t happen. You''re still in ' || s_from.course_code || ' ' || s_from.section || '.',
      jsonb_build_object('cause', coalesce(b, a)));
  end;
  return private.registration_commit(school, me, k, 'swap', print,
    jsonb_build_object('ok', true, 'outcome', 'swapped', 'reason', 'ok', 'replayed', false,
      'message', 'Swapped ' || s_from.course_code || ' ' || s_from.section || ' for ' || s_to.course_code || ' ' || s_to.section || '.',
      'from', a, 'to', b));
end $$;
revoke all on function public.registration_swap(uuid, uuid, text, text) from public, anon;
grant execute on function public.registration_swap(uuid, uuid, text, text) to authenticated;
-- registration_requests.action check must allow 'swap'
alter table public.registration_requests drop constraint if exists registration_requests_action_check;
alter table public.registration_requests add constraint registration_requests_action_check
  check (action in ('enroll', 'drop', 'withdraw', 'override', 'decide', 'swap'));

-- ── Ledger gaps L1, L2, L4 (academic_record_ledger) ──
do $$ declare t text; begin
  foreach t in array array['academic_record_subjects','academic_record_changes','academic_record_entries'] loop
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;
alter table public.academic_record_changes add column if not exists policy_version text;
alter table public.academic_record_entries add column if not exists policy_version text;
-- Hand edit 2 — store the policy version on every official entry. A BEFORE INSERT trigger on the ledger copies it from
-- the approved change, so private.academic_record_change_guard needs no edit. The append-only trigger only guards
-- UPDATE/DELETE, so this INSERT-time stamp doesn't conflict with it.
create or replace function private.academic_record_entry_policy_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select c.policy_version into new.policy_version from public.academic_record_changes c where c.id = new.change_id;
  return new;
end $$;
revoke all on function private.academic_record_entry_policy_version() from public, anon, authenticated;
drop trigger if exists academic_record_entry_policy_version on public.academic_record_entries;
create trigger academic_record_entry_policy_version before insert on public.academic_record_entries
  for each row execute function private.academic_record_entry_policy_version();
-- Policy version on grade, standing and conferral changes. A hard CHECK would break every existing writer and check
-- file (academic-record, human-overrides, ledger-chains, ledger-seals insert grades without one), so it's per school:
--   * off (default): a missing version is stamped 'unversioned', so the gap is visible on the entry, not hidden;
--   * tenant_feature_policy(capability 'records.require_policy_version', state 'production'): a missing version is refused.
create or replace function private.academic_record_change_policy_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('grade', 'standing', 'conferral') and nullif(trim(coalesce(new.policy_version, '')), '') is null then
    if exists (select 1 from public.tenant_feature_policy f
                where f.tenant_id = new.tenant_id and f.capability = 'records.require_policy_version' and f.state = 'production') then
      raise exception 'a % change must name its policy version', new.kind using errcode = '23514';
    end if;
    new.policy_version := 'unversioned';
  end if;
  return new;
end $$;
revoke all on function private.academic_record_change_policy_version() from public, anon, authenticated;
drop trigger if exists academic_record_change_policy_version on public.academic_record_changes;
create trigger academic_record_change_policy_version before insert on public.academic_record_changes
  for each row execute function private.academic_record_change_policy_version();
alter table public.academic_record_entries add constraint academic_record_entries_tenant_id_unique unique (tenant_id, id);
alter table public.academic_record_entries add constraint academic_record_entries_previous_same_tenant
  foreign key (tenant_id, previous_entry_id) references public.academic_record_entries (tenant_id, id) not valid;
alter table public.academic_record_entries validate constraint academic_record_entries_previous_same_tenant;
-- NOTE: the append-only trigger blocks UPDATE, so VALIDATE (read-only) is fine; ADD COLUMN with no default writes no rows.

-- ── Gradebook gaps G1, G3 ──
do $$ declare t text; begin
  foreach t in array array['gradebook_operations','gradebook_schemes','gradebook_items','grade_entries','regrade_requests','regrade_resolutions','grade_passbacks'] loop
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;
alter table public.gradebook_items add constraint gradebook_items_tenant_id_unique unique (tenant_id, id);
alter table public.grade_entries add constraint grade_entries_item_same_tenant
  foreign key (tenant_id, item_id) references public.gradebook_items (tenant_id, id) on delete cascade not valid;
alter table public.grade_entries validate constraint grade_entries_item_same_tenant;

-- ── G2: a released final grade proposes a ledger change (registrar approves; gradebook never writes entries) ──
-- Requires gradebook_items to mark which item is the final course grade. If no such column exists, add:
alter table public.gradebook_items add column if not exists is_final_course_grade boolean not null default false;
create or replace function private.gradebook_propose_final_grade() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ref text;
begin
  if new.status <> 'released' or new.score is null and new.mark is null then return new; end if;
  if not exists (select 1 from public.gradebook_items i where i.id = new.item_id and i.is_final_course_grade) then return new; end if;
  select s.student_ref into ref from public.academic_record_subjects s where s.tenant_id = new.tenant_id and s.user_id = new.student_id;
  if ref is null then return new; end if; -- no linked record: the registrar links it, then re-proposes from the export
  insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source, policy_version)
  values (new.tenant_id, ref, 'grade', new.course_code || ' ' || new.term, 'set', coalesce(new.mark, new.score::text), current_date,
          'Final grade released in the gradebook (operation ' || new.operation || ')', 'faculty',
          'gradebook:' || new.course_code || '/' || new.term);  -- TODO: replace with the school's approved grading-policy version once one exists
  return new;
end $$;
revoke all on function private.gradebook_propose_final_grade() from public, anon, authenticated;
drop trigger if exists gradebook_propose_final_grade on public.grade_entries;
create trigger gradebook_propose_final_grade after insert on public.grade_entries
  for each row when (new.status = 'released') execute function private.gradebook_propose_final_grade();
-- NOTE: the ledger guard sets proposed_by := auth.uid() (the releasing instructor), so the registrar — not the instructor — must approve.
-- The value mapping (score → letter) must use the school's approved scale before production; here it passes the raw value.
