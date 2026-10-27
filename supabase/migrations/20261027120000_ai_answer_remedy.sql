-- A human remedy path for an Ask Semester answer.
--
-- The answer body is deliberately not copied into this queue. The browser
-- supplies a SHA-256 evidence anchor plus the already-visible quality snapshot;
-- the server derives the reporter and tenant from the authenticated profile.
-- Only a human with an exact-school ai:remedy-review grant can claim or resolve
-- a report. Nothing here mutates an academic, enrollment, conduct or access
-- record, so a report cannot become an automated adverse decision.

insert into public.app_capabilities (capability, about) values
  ('ai:remedy-review', 'Claim and resolve student reports about Ask Semester answers for one school.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('trust_officer', 'ai:remedy-review')
on conflict (role, capability) do nothing;

create table if not exists public.ai_answer_remedy (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete restrict,
  reporter uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  category text not null check (category in ('incorrect', 'source', 'policy', 'accessibility', 'harmful')),
  summary text not null check (length(trim(summary)) between 1 and 2000),
  answer_sha256 text not null check (answer_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_reference text generated always as ('ask-semester:' || left(answer_sha256, 16)) stored,
  source_strength text not null check (source_strength in ('strong', 'limited', 'none')),
  policy_state text not null check (policy_state in ('allowed', 'limited', 'unavailable')),
  source_count integer not null check (source_count between 0 and 100),
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'resolved')),
  owner_seat text not null default 'trust_officer' check (owner_seat = 'trust_officer'),
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_at timestamptz,
  resolution_code text check (resolution_code in ('confirmed_issue', 'no_issue_found', 'more_information_needed', 'referred_to_owner')),
  resolution_evidence text check (resolution_evidence is null or resolution_evidence ~ '^[A-Za-z0-9._:/-]{3,200}$'),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  response_due_at timestamptz not null,
  escalation_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (reporter, idempotency_key),
  check (response_due_at > created_at and escalation_at >= response_due_at),
  check ((assigned_to is null) = (assigned_at is null)),
  check (
    (status = 'submitted' and assigned_to is null and resolution_code is null and resolved_at is null and resolved_by is null)
    or (status = 'in_review' and assigned_to is not null and resolution_code is null and resolved_at is null and resolved_by is null)
    or (status = 'resolved' and assigned_to is not null and resolution_code is not null and resolved_at is not null and resolved_by is not null)
  )
);

create index if not exists ai_answer_remedy_by_reporter
  on public.ai_answer_remedy (reporter, created_at desc);
create index if not exists ai_answer_remedy_by_tenant_status
  on public.ai_answer_remedy (tenant_id, status, escalation_at);
create index if not exists ai_answer_remedy_by_assignee
  on public.ai_answer_remedy (assigned_to) where assigned_to is not null;
create index if not exists ai_answer_remedy_by_resolver
  on public.ai_answer_remedy (resolved_by) where resolved_by is not null;

alter table public.ai_answer_remedy enable row level security;
revoke all on table public.ai_answer_remedy from public, anon, authenticated;

create or replace function private.keep_ai_answer_remedy_binding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.reporter is distinct from old.reporter
     or new.idempotency_key is distinct from old.idempotency_key
     or new.category is distinct from old.category
     or new.summary is distinct from old.summary
     or new.answer_sha256 is distinct from old.answer_sha256
     or new.source_strength is distinct from old.source_strength
     or new.policy_state is distinct from old.policy_state
     or new.source_count is distinct from old.source_count
     or new.owner_seat is distinct from old.owner_seat
     or new.response_due_at is distinct from old.response_due_at
     or new.escalation_at is distinct from old.escalation_at
     or new.created_at is distinct from old.created_at then
    raise exception 'AI answer remedy evidence and scope are immutable.' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function private.keep_ai_answer_remedy_binding() from public, anon, authenticated;
drop trigger if exists ai_answer_remedy_binding_immutable on public.ai_answer_remedy;
create trigger ai_answer_remedy_binding_immutable
  before update on public.ai_answer_remedy
  for each row execute function private.keep_ai_answer_remedy_binding();

create or replace function public.raise_ai_answer_remedy(
  want_key uuid,
  want_category text,
  want_summary text,
  want_answer_sha256 text,
  want_source_strength text,
  want_policy_state text,
  want_source_count integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  tenant text;
  existing public.ai_answer_remedy%rowtype;
  made public.ai_answer_remedy%rowtype;
  due_interval interval;
  escalate_interval interval;
begin
  if me is null then raise exception 'Sign in to request a review.' using errcode = '42501'; end if;
  select p.school_id into tenant from public.profiles p where p.user_id = me;
  if tenant is null then raise exception 'A verified school membership is required.' using errcode = '42501'; end if;

  select * into existing from public.ai_answer_remedy r
   where r.reporter = me and r.idempotency_key = want_key;
  if found then
    if existing.category is distinct from want_category
       or existing.summary is distinct from trim(want_summary)
       or existing.answer_sha256 is distinct from want_answer_sha256
       or existing.source_strength is distinct from want_source_strength
       or existing.policy_state is distinct from want_policy_state
       or existing.source_count is distinct from want_source_count then
      raise exception 'That request key is already bound to different evidence.' using errcode = '23505';
    end if;
    return existing.id;
  end if;

  if want_category not in ('incorrect', 'source', 'policy', 'accessibility', 'harmful')
     or length(trim(coalesce(want_summary, ''))) not between 1 and 2000
     or coalesce(want_answer_sha256, '') !~ '^[0-9a-f]{64}$'
     or want_source_strength not in ('strong', 'limited', 'none')
     or want_policy_state not in ('allowed', 'limited', 'unavailable')
     or want_source_count not between 0 and 100 then
    raise exception 'The review request is invalid.' using errcode = '23514';
  end if;

  due_interval := case when want_category = 'harmful' then interval '4 hours' else interval '2 days' end;
  escalate_interval := case when want_category = 'harmful' then interval '8 hours' else interval '3 days' end;

  insert into public.ai_answer_remedy (
    tenant_id, reporter, idempotency_key, category, summary, answer_sha256,
    source_strength, policy_state, source_count, response_due_at, escalation_at
  ) values (
    tenant, me, want_key, want_category, trim(want_summary), want_answer_sha256,
    want_source_strength, want_policy_state, want_source_count,
    now() + due_interval, now() + escalate_interval
  ) returning * into made;

  perform private.record_audit(
    tenant, 'ai_remedy.submitted', 'ai_answer_remedy', made.id::text, 'allowed',
    want_key::text,
    jsonb_build_object('category', want_category, 'evidence_reference', made.evidence_reference,
                       'owner_seat', made.owner_seat, 'response_due_at', made.response_due_at,
                       'escalation_at', made.escalation_at)
  );
  return made.id;
end $$;

create or replace function public.my_ai_answer_remedies()
returns table (
  id uuid, category text, evidence_reference text, status text, owner_seat text,
  response_due_at timestamptz, escalation_at timestamptz,
  resolution_code text, resolution_evidence text, created_at timestamptz, resolved_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.category, r.evidence_reference, r.status, r.owner_seat,
         r.response_due_at, r.escalation_at, r.resolution_code, r.resolution_evidence,
         r.created_at, r.resolved_at
    from public.ai_answer_remedy r
   where r.reporter = (select auth.uid())
   order by r.created_at desc;
$$;

create or replace function public.ai_answer_remedy_queue(want_tenant text)
returns table (
  id uuid, category text, summary text, evidence_reference text,
  source_strength text, policy_state text, source_count integer, status text,
  response_due_at timestamptz, escalation_at timestamptz, assigned_to uuid, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_capability('ai:remedy-review', 'school', want_tenant) then
    raise exception 'No AI remedy queue in your grant scope.' using errcode = '42501';
  end if;
  return query
    select r.id, r.category, r.summary, r.evidence_reference,
           r.source_strength, r.policy_state, r.source_count, r.status,
           r.response_due_at, r.escalation_at, r.assigned_to, r.created_at
      from public.ai_answer_remedy r
     where r.tenant_id = want_tenant and r.status <> 'resolved'
     order by (r.escalation_at <= now()) desc, r.escalation_at, r.created_at;
end $$;

create or replace function public.claim_ai_answer_remedy(want_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  item public.ai_answer_remedy%rowtype;
begin
  select * into item from public.ai_answer_remedy r where r.id = want_id for update;
  if not found or me is null or not private.has_capability('ai:remedy-review', 'school', item.tenant_id) then
    raise exception 'No AI remedy in your grant scope.' using errcode = '42501';
  end if;
  if item.status = 'resolved' then raise exception 'This review is already resolved.' using errcode = '23514'; end if;
  if item.assigned_to is not null and item.assigned_to <> me then
    raise exception 'This review is assigned to another human reviewer.' using errcode = '42501';
  end if;
  if item.assigned_to = me then return item.status; end if;

  update public.ai_answer_remedy
     set status = 'in_review', assigned_to = me, assigned_at = now()
   where id = item.id;
  perform private.record_audit(item.tenant_id, 'ai_remedy.claimed', 'ai_answer_remedy', item.id::text,
    'allowed', null, jsonb_build_object('owner_seat', item.owner_seat));
  return 'in_review';
end $$;

create or replace function public.resolve_ai_answer_remedy(
  want_id uuid,
  want_resolution text,
  want_evidence text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  item public.ai_answer_remedy%rowtype;
begin
  select * into item from public.ai_answer_remedy r where r.id = want_id for update;
  if not found or me is null or not private.has_capability('ai:remedy-review', 'school', item.tenant_id)
     or item.assigned_to is distinct from me then
    raise exception 'Claim this AI remedy before resolving it.' using errcode = '42501';
  end if;
  if item.status <> 'in_review' then raise exception 'This review is not open.' using errcode = '23514'; end if;
  if want_resolution not in ('confirmed_issue', 'no_issue_found', 'more_information_needed', 'referred_to_owner')
     or coalesce(want_evidence, '') !~ '^[A-Za-z0-9._:/-]{3,200}$' then
    raise exception 'A permitted human outcome and evidence reference are required.' using errcode = '23514';
  end if;

  update public.ai_answer_remedy
     set status = 'resolved', resolution_code = want_resolution,
         resolution_evidence = want_evidence, resolved_by = me, resolved_at = now()
   where id = item.id;
  perform private.record_audit(item.tenant_id, 'ai_remedy.resolved', 'ai_answer_remedy', item.id::text,
    'allowed', null, jsonb_build_object('resolution_code', want_resolution,
      'evidence_reference', want_evidence, 'human_reviewed', true));
  return 'resolved';
end $$;

revoke all on function public.raise_ai_answer_remedy(uuid, text, text, text, text, text, integer) from public, anon;
revoke all on function public.my_ai_answer_remedies() from public, anon;
revoke all on function public.ai_answer_remedy_queue(text) from public, anon;
revoke all on function public.claim_ai_answer_remedy(uuid) from public, anon;
revoke all on function public.resolve_ai_answer_remedy(uuid, text, text) from public, anon;
grant execute on function public.raise_ai_answer_remedy(uuid, text, text, text, text, text, integer) to authenticated;
grant execute on function public.my_ai_answer_remedies() to authenticated;
grant execute on function public.ai_answer_remedy_queue(text) to authenticated;
grant execute on function public.claim_ai_answer_remedy(uuid) to authenticated;
grant execute on function public.resolve_ai_answer_remedy(uuid, text, text) to authenticated;

comment on table public.ai_answer_remedy is
  'Tenant-scoped human review queue for Ask Semester answers. Stores an evidence hash, not answer content; cannot mutate an academic or conduct record.';
