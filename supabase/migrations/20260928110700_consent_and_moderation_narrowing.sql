-- Two narrowings, both decisions left open when the features landed.
--
-- ── 1. A mentor assignment needs the mentor's yes ─────────────────────────
-- `peer_mentor_assignments` has let a student insert an assignment naming any
-- peer mentor in their cohort, with no word from the mentor — and an
-- assignment is what `private.mentors()` reads to let a mentor see a
-- student's onboarding progress. Launchpad promises the opposite: a match is
-- proposed to both people, and nothing happens until both accept.
-- `mentor_requests` (20260928021700) already carries that two-sided consent,
-- so an assignment is now created only there: when the mentor accepts a peer
-- request, inside `answer_mentor_request`. The student's insert policy and
-- the insert grant go. Ending an assignment is unchanged — either end may set
-- `revoked_at`, and the student may delete it.

drop policy if exists "a student accepts a mentor in their cohort" on public.peer_mentor_assignments;
revoke insert on table public.peer_mentor_assignments from authenticated;

create or replace function public.answer_mentor_request(want uuid, want_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  uuid := auth.uid();
  r   public.mentor_requests;
  cap integer;
  taken integer;
begin
  select * into r from public.mentor_requests where id = want for update;
  if r.id is null or r.status <> 'pending' then raise exception 'That request is not open.'; end if;
  if want_status in ('accepted', 'declined') then
    if r.recipient <> me then raise exception 'Only the person asked can answer.'; end if;
  elsif want_status = 'withdrawn' then
    if r.requester <> me then raise exception 'Only the person who asked can withdraw.'; end if;
  else
    raise exception 'Not an answer: %', want_status;
  end if;
  if want_status = 'accepted' then
    -- Lock the offer before counting: two acceptances against the last slot
    -- each lock a different request, so without this both read the same count
    -- and both pass. The second now waits, then counts the first's accept.
    -- A peer offer is per cohort, so its capacity counts that cohort only.
    if r.kind = 'peer' then
      -- A request can wait a long time. At acceptance, both ends must still be
      -- where the request put them — the student at the school and in the
      -- cohort, the mentor holding mentee:read over it — the same test the
      -- retired direct-insert policy made, or the assignment below would give
      -- a mentor a student who has left.
      if not exists (
        select 1 from public.profiles p where p.user_id = r.requester and p.school_id = r.tenant_id
      ) or not exists (
        select 1 from public.role_grants g
         where g.subject = r.requester and g.scope_kind = 'cohort' and g.scope_id = r.cohort_scope
           and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
      ) then
        raise exception 'That student is no longer in this cohort.';
      end if;
      if not private.subject_has_capability(me, 'mentee:read', 'cohort', r.cohort_scope) then
        raise exception 'You no longer mentor this cohort.';
      end if;
      select capacity into cap from public.peer_mentor_offers
       where user_id = me and cohort_scope = r.cohort_scope for update;
      -- Capacity is live mentorships in this cohort, whichever way they began
      -- (an assignment from before 20260928110700 counts too). Re-accepting a
      -- student whose earlier assignment ended does not count them twice.
      select count(*) into taken from public.peer_mentor_assignments a
       where a.mentor_id = me and a.cohort_scope = r.cohort_scope and a.student_id <> r.requester
         and a.revoked_at is null and a.expires_at > now();
    else
      select capacity into cap from public.alumni_mentor_offers where user_id = me for update;
      select count(*) into taken from public.mentor_requests
       where recipient = me and kind = r.kind and status = 'accepted';
    end if;
    if cap is null or taken >= cap then raise exception 'You are at your mentoring capacity.'; end if;
  end if;
  update public.mentor_requests set status = want_status, decided_at = now() where id = want;

  -- Both have now said yes: the student by asking, the mentor by accepting.
  -- Only here does a peer assignment come into being. A pair that ended an
  -- earlier assignment in this cohort starts a fresh one.
  if want_status = 'accepted' and r.kind = 'peer' then
    insert into public.peer_mentor_assignments (tenant_id, cohort_scope, mentor_id, student_id, accepted_at, expires_at)
    values (r.tenant_id, r.cohort_scope, me, r.requester, now(), now() + interval '180 days')
    on conflict (mentor_id, student_id, cohort_scope) do update
      set accepted_at = excluded.accepted_at, expires_at = excluded.expires_at, revoked_at = null;
  end if;
end $$;

-- Peer requests accepted between 20260928021700 and this migration made no
-- assignment. Both people said yes to those, so they get one now — the
-- mentor had nothing to see before, and capacity now counts assignments.
insert into public.peer_mentor_assignments (tenant_id, cohort_scope, mentor_id, student_id, accepted_at, expires_at)
select r.tenant_id, r.cohort_scope, r.recipient, r.requester, coalesce(r.decided_at, now()), coalesce(r.decided_at, now()) + interval '180 days'
  from public.mentor_requests r
 where r.kind = 'peer' and r.status = 'accepted'
   and coalesce(r.decided_at, now()) + interval '180 days' > now()
on conflict (mentor_id, student_id, cohort_scope) do nothing;

-- ── 2. A moderator changes a listing's status, and nothing else ───────────
-- "a moderator publishes or removes" was an UPDATE policy with no column
-- limit, so a moderator could rewrite a listing's title, body, link,
-- deadline or eligibility and publish words the publisher never wrote under
-- the publisher's name. A column grant cannot separate the two roles —
-- publishers edit those columns on their own drafts through the same
-- `authenticated` grant — so moderation moves to one function that writes
-- `status` only, as `reports.check.sql` established for reports. The
-- publisher's own policy is unchanged.

drop policy if exists "a moderator publishes or removes" on public.opportunities;

create or replace function public.moderate_opportunity(want uuid, want_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_capability('opportunity:moderate') then
    raise exception 'Only a listings moderator can do that.';
  end if;
  if want_status not in ('published', 'removed') then
    raise exception 'A moderator publishes or removes: %', want_status;
  end if;
  update public.opportunities set status = want_status
   where id = want and status in ('pending_review', 'published');
  if not found then raise exception 'That listing is not waiting for review or published.'; end if;
end $$;

revoke all on function public.moderate_opportunity(uuid, text) from public, anon;
grant execute on function public.moderate_opportunity(uuid, text) to authenticated;
