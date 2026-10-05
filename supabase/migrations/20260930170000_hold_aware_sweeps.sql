-- A school hold or an account hold now reaches the AI-runtime and Community
-- sweeps, not only a platform-wide one.
--
-- 20260930130000_hold_gated_sweeps.sql put a dispatcher in front of these two
-- sweeps so a platform hold could pause them, and said the limit out loud: a
-- school or account hold did not reach them, because their tables were not
-- mapped to a hold's subject. Mapped now:
--
--   * **AI runtime metadata** is keyed by school (`tenant_id`): a school hold
--     keeps that school's reservations and monthly spend.
--   * **Community rows that belong to an account** are kept while that account
--     is held — directly, or because it is in a held school
--     (`private.account_is_held`): a post by its author, a report by its
--     reporter, a restriction, a hosted session (and one a held account joined),
--     a volunteer task, an image by its uploader, a safety entry. A case is kept
--     while its post's author or any of its reporters is held.
--
-- This is the whole of both functions restated, because a Postgres function is
-- replaced whole. Each is the original of its earlier migration with one
-- clause added per delete and nothing else changed:
--
--   * `private.sweep_ai_runtime_metadata` — 20260924163000_intelligence_provider_runtime.sql
--   * `private.sweep_community_retention` — 20260928032000_community.sql
--
-- so `retention.test.ts` now reads the *last* definition of each, the one that
-- runs, and holds it to the clauses below; a later edit that drops one fails
-- there instead of quietly dropping a hold.
--
-- What is still not covered, by design and by lack of a subject: the escalation
-- deliveries and the volunteer programme's own events carry no account, so they
-- follow the platform gate only, and a school hold does not keep them. Both
-- are records of the programme, not of a person.

create or replace function private.sweep_ai_runtime_metadata()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed bigint := 0;
  affected bigint := 0;
begin
  update private.ai_usage_reservation
     set status = 'released', settled_at = now()
   where status = 'reserved' and expires_at <= now();

  delete from private.ai_usage_reservation r
  using public.ai_policy p
   where r.tenant_id = p.tenant_id
     and r.created_at < now() - make_interval(days => p.retention_days)
     and not private.tenant_is_held(r.tenant_id);
  get diagnostics removed = row_count;

  delete from private.ai_usage_month m
  using public.ai_policy p
   where m.tenant_id = p.tenant_id
     -- Never erase the authoritative current-month spend while it still
     -- enforces the monthly ceiling, even when retention_days is zero.
     and m.period_start < date_trunc('month', timezone('UTC', now()))::date
     and m.period_start < (timezone('UTC', now()) - make_interval(days => p.retention_days))::date
     and not private.tenant_is_held(m.tenant_id);
  get diagnostics affected = row_count;
  return removed + affected;
end $$;

revoke all on function private.sweep_ai_runtime_metadata() from public, anon, authenticated;
grant execute on function private.sweep_ai_runtime_metadata() to service_role;

create or replace function private.sweep_community_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_cases integer;
  n_posts integer;
  n_reports integer;
  n_restrictions integer;
  n_sessions integer;
  n_volunteer integer;
begin
  delete from public.community_cases k
   where k.retain_until < now() and k.status not in ('open', 'appealed')
     -- Evidence of a known-abuse match is kept until the legal runbook says otherwise.
     and not exists (select 1 from public.community_media m where m.post_id = k.post_id and m.known_abuse_match)
     -- A legal hold keeps the case while its post's author or any reporter is held.
     and not exists (select 1 from public.community_posts hp where hp.id = k.post_id and private.account_is_held(hp.author_id))
     and not exists (select 1 from public.community_reports hr where hr.case_id = k.id and private.account_is_held(hr.reporter_id));
  get diagnostics n_cases = row_count;

  delete from public.community_posts p
   where p.status in ('withdrawn', 'removed')
     and not exists (select 1 from public.community_cases k where k.post_id = p.id)
     and not private.account_is_held(p.author_id);
  get diagnostics n_posts = row_count;

  delete from public.community_reports r
   where r.case_id is null and r.created_at < now() - interval '90 days'
     and not private.account_is_held(r.reporter_id);
  get diagnostics n_reports = row_count;

  delete from public.community_restrictions x
   where coalesce(least(x.lifted_at, x.until), x.until) < now() - interval '90 days'
     and not private.account_is_held(x.user_id);
  get diagnostics n_restrictions = row_count;

  delete from public.community_sessions s
   where s.ends_at < now() - interval '30 days'
     and not private.account_is_held(s.host_id)
     and not exists (select 1 from public.community_session_participants sp
                      where sp.session_id = s.id and private.account_is_held(sp.user_id));
  get diagnostics n_sessions = row_count;

  -- Volunteer work: a task never answered lapses after a day; an answered
  -- one, and the programme's own events, after a year.
  delete from public.community_volunteer_tasks t
   where ((t.answered_at is null and t.assigned_at < now() - interval '1 day')
      or t.answered_at < now() - interval '1 year')
     and not private.account_is_held(t.volunteer_id);
  get diagnostics n_volunteer = row_count;
  delete from public.community_volunteer_events e where e.occurred_at < now() - interval '1 year';
  -- An image reserved and never posted lapses after a day; an image whose post
  -- is gone goes with it — except a known-abuse match, which the legal runbook
  -- decides about.
  delete from public.community_media
   where status = 'awaiting_upload' and created_at < now() - interval '1 day'
     and not private.account_is_held(uploader_id);
  delete from public.community_media
   where post_id is null and status <> 'awaiting_upload' and not known_abuse_match
     and not private.account_is_held(uploader_id);
  -- The safety state forgets after a year, so it recovers.
  delete from public.community_safety_entries e
   where e.created_at < now() - interval '1 year'
     and not private.account_is_held(e.user_id);
  -- A delivered escalation's copy of the payload has done its job.
  delete from public.community_escalation_deliveries d where d.delivered_at < now() - interval '90 days';

  delete from public.community_retention_runs where ran_at < now() - interval '1 year';

  insert into public.community_retention_runs
    (cases_removed, posts_removed, reports_removed, restrictions_removed, sessions_removed, volunteer_tasks_removed)
  values (n_cases, n_posts, n_reports, n_restrictions, n_sessions, n_volunteer);

  return jsonb_build_object('cases', n_cases, 'posts', n_posts, 'reports', n_reports,
                            'restrictions', n_restrictions, 'sessions', n_sessions,
                            'volunteer_tasks', n_volunteer);
end $$;

revoke all on function private.sweep_community_retention() from public, anon, authenticated;
grant execute on function private.sweep_community_retention() to service_role;

-- ── Rollback ──────────────────────────────────────────────────────────────
--
-- Additive in effect: to undo, restore the two bodies from the migrations named
-- above. `private.run_sweep` and its platform gate are unchanged and stay.
