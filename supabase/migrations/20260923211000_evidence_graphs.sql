-- Tenant-isolated evidence for adaptive learning, verified skills and
-- consent-controlled course capture.

alter table public.consent_record
  add column if not exists expires_at timestamptz;

alter table public.consent_record
  drop constraint if exists consent_record_scoped_identity;
alter table public.consent_record
  add constraint consent_record_scoped_identity
  unique (id, tenant_id, subject_user_id);

create table if not exists public.evidence_reference (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  person_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null check (length(trim(course_id)) between 1 and 200),
  title text not null check (length(trim(title)) between 1 and 300),
  origin text not null check (origin in ('course', 'institution', 'student', 'web', 'inference')),
  authority text not null check (authority in ('authoritative', 'confirmed', 'unverified', 'inferred')),
  locator text not null check (length(trim(locator)) between 1 and 500),
  excerpt text not null default '' check (length(excerpt) <= 8000),
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, tenant_id, person_id)
);

create index if not exists evidence_reference_by_tenant_person
  on public.evidence_reference (tenant_id, person_id, course_id);
create index if not exists evidence_reference_by_person
  on public.evidence_reference (person_id, created_at desc);
create index if not exists evidence_reference_by_creator
  on public.evidence_reference (created_by);

create table if not exists public.concept_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  person_id uuid not null,
  evidence_id uuid not null,
  course_id text not null check (length(trim(course_id)) between 1 and 200),
  concept_id text not null check (length(trim(concept_id)) between 1 and 200),
  kind text not null check (kind in ('diagnostic', 'practice', 'assignment', 'self_report')),
  score numeric(5,4) check (score between 0 and 1),
  observed_at timestamptz not null default now(),
  foreign key (evidence_id, tenant_id, person_id)
    references public.evidence_reference(id, tenant_id, person_id) on delete cascade
);

create index if not exists concept_evidence_by_reference
  on public.concept_evidence (evidence_id, tenant_id, person_id);
create index if not exists concept_evidence_by_learner
  on public.concept_evidence (tenant_id, person_id, course_id, concept_id, observed_at desc);

create table if not exists public.mistake_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  person_id uuid not null,
  evidence_id uuid not null,
  course_id text not null check (length(trim(course_id)) between 1 and 200),
  concept_id text not null check (length(trim(concept_id)) between 1 and 200),
  classification text not null check (classification in (
    'concept', 'calculation', 'reading', 'procedure', 'memory', 'careless', 'unclassified'
  )),
  detail text not null default '' check (length(detail) <= 4000),
  observed_at timestamptz not null default now(),
  foreign key (evidence_id, tenant_id, person_id)
    references public.evidence_reference(id, tenant_id, person_id) on delete cascade
);

create index if not exists mistake_evidence_by_reference
  on public.mistake_evidence (evidence_id, tenant_id, person_id);
create index if not exists mistake_evidence_by_learner
  on public.mistake_evidence (tenant_id, person_id, course_id, concept_id, observed_at desc);

create table if not exists public.skill_claim (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  person_id uuid not null references auth.users(id) on delete cascade,
  skill_name text not null check (length(trim(skill_name)) between 1 and 200),
  verification_state text not null default 'suggested' check (verification_state in (
    'suggested', 'student_confirmed', 'institution_verified', 'rejected'
  )),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id, person_id),
  constraint skill_claim_verifier_matches_state check (
    (verification_state = 'institution_verified' and verified_by is not null and verified_at is not null)
    or (verification_state <> 'institution_verified' and verified_by is null and verified_at is null)
  )
);

create index if not exists skill_claim_by_tenant_person
  on public.skill_claim (tenant_id, person_id, verification_state);
create index if not exists skill_claim_by_person
  on public.skill_claim (person_id, updated_at desc);
create index if not exists skill_claim_by_verifier
  on public.skill_claim (verified_by);

create table if not exists public.skill_claim_evidence (
  tenant_id text not null,
  person_id uuid not null,
  skill_claim_id uuid not null,
  evidence_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (skill_claim_id, evidence_id),
  foreign key (skill_claim_id, tenant_id, person_id)
    references public.skill_claim(id, tenant_id, person_id) on delete cascade,
  foreign key (evidence_id, tenant_id, person_id)
    references public.evidence_reference(id, tenant_id, person_id) on delete cascade
);

create index if not exists skill_claim_evidence_by_claim
  on public.skill_claim_evidence (skill_claim_id, tenant_id, person_id);
create index if not exists skill_claim_evidence_by_reference
  on public.skill_claim_evidence (evidence_id, tenant_id, person_id);
create index if not exists skill_claim_evidence_by_learner
  on public.skill_claim_evidence (tenant_id, person_id);

create table if not exists public.capture_asset (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  person_id uuid not null,
  course_id text not null check (length(trim(course_id)) between 1 and 200),
  consent_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 500),
  mime text not null check (length(trim(mime)) between 1 and 200),
  content_hash text not null check (length(trim(content_hash)) between 8 and 200),
  storage_key text,
  state text not null default 'active' check (state in ('active', 'removed')),
  retained_until timestamptz,
  created_at timestamptz not null default now(),
  unique (id, tenant_id, person_id),
  unique (tenant_id, person_id, content_hash),
  foreign key (consent_id, tenant_id, person_id)
    references public.consent_record(id, tenant_id, subject_user_id) on delete cascade
);

create index if not exists capture_asset_by_consent
  on public.capture_asset (consent_id, tenant_id, person_id);
create index if not exists capture_asset_by_learner
  on public.capture_asset (tenant_id, person_id, course_id, created_at desc);

create table if not exists public.capture_segment (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  person_id uuid not null,
  capture_id uuid not null,
  locator text not null check (length(trim(locator)) between 1 and 500),
  body text not null check (length(trim(body)) between 1 and 16000),
  state text not null default 'active' check (state in ('active', 'withdrawn')),
  created_at timestamptz not null default now(),
  foreign key (capture_id, tenant_id, person_id)
    references public.capture_asset(id, tenant_id, person_id) on delete cascade
);

create index if not exists capture_segment_by_capture
  on public.capture_segment (capture_id, tenant_id, person_id, locator);
create index if not exists capture_segment_by_learner
  on public.capture_segment (tenant_id, person_id, created_at desc);

create table if not exists public.capture_artifact (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  person_id uuid not null,
  capture_id uuid not null,
  kind text not null check (kind in ('notes', 'cards', 'quiz', 'audio-review', 'summary', 'action', 'deadline')),
  body jsonb not null default '{}'::jsonb,
  state text not null default 'suggested' check (state in ('suggested', 'confirmed', 'withdrawn')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (capture_id, tenant_id, person_id)
    references public.capture_asset(id, tenant_id, person_id) on delete cascade
);

create index if not exists capture_artifact_by_capture
  on public.capture_artifact (capture_id, tenant_id, person_id);
create index if not exists capture_artifact_by_learner
  on public.capture_artifact (tenant_id, person_id, created_at desc);
create index if not exists capture_artifact_by_creator
  on public.capture_artifact (created_by);

alter table public.evidence_reference enable row level security;
alter table public.concept_evidence enable row level security;
alter table public.mistake_evidence enable row level security;
alter table public.skill_claim enable row level security;
alter table public.skill_claim_evidence enable row level security;
alter table public.capture_asset enable row level security;
alter table public.capture_segment enable row level security;
alter table public.capture_artifact enable row level security;

revoke all on table public.evidence_reference, public.concept_evidence,
  public.mistake_evidence, public.skill_claim, public.skill_claim_evidence,
  public.capture_asset, public.capture_segment, public.capture_artifact
  from anon, authenticated;
grant select, insert, update, delete on table public.evidence_reference,
  public.concept_evidence, public.mistake_evidence, public.skill_claim,
  public.skill_claim_evidence, public.capture_asset, public.capture_segment,
  public.capture_artifact to authenticated;

create or replace function private.owns_evidence_scope(want_tenant text, want_person uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select want_person = (select auth.uid())
     and want_tenant = (select p.school_id from public.profiles p where p.user_id = (select auth.uid()));
$$;
revoke all on function private.owns_evidence_scope(text, uuid) from public, anon, authenticated;
grant execute on function private.owns_evidence_scope(text, uuid) to authenticated;

create policy "people own evidence references" on public.evidence_reference
  for all to authenticated
  using (private.owns_evidence_scope(tenant_id, person_id))
  with check (private.owns_evidence_scope(tenant_id, person_id) and created_by = (select auth.uid()));
create policy "people own concept evidence" on public.concept_evidence
  for all to authenticated
  using (private.owns_evidence_scope(tenant_id, person_id))
  with check (private.owns_evidence_scope(tenant_id, person_id));
create policy "people own mistake evidence" on public.mistake_evidence
  for all to authenticated
  using (private.owns_evidence_scope(tenant_id, person_id))
  with check (private.owns_evidence_scope(tenant_id, person_id));

create policy "people read and remove their skill claims" on public.skill_claim
  for select to authenticated using (private.owns_evidence_scope(tenant_id, person_id));
create policy "source approvers read skill claims" on public.skill_claim
  for select to authenticated using (private.has_capability('source:approve', 'school', tenant_id));
create policy "people insert unverified skill claims" on public.skill_claim
  for insert to authenticated with check (
    private.owns_evidence_scope(tenant_id, person_id)
    and verification_state <> 'institution_verified'
    and verified_by is null and verified_at is null
  );
create policy "people update unverified skill claims" on public.skill_claim
  for update to authenticated
  using (private.owns_evidence_scope(tenant_id, person_id) and verification_state <> 'institution_verified')
  with check (
    private.owns_evidence_scope(tenant_id, person_id)
    and verification_state <> 'institution_verified'
    and verified_by is null and verified_at is null
  );
create policy "people delete their skill claims" on public.skill_claim
  for delete to authenticated using (private.owns_evidence_scope(tenant_id, person_id));
create policy "source approvers verify skill claims" on public.skill_claim
  for update to authenticated
  using (private.has_capability('source:approve', 'school', tenant_id))
  with check (
    private.has_capability('source:approve', 'school', tenant_id)
    and verification_state = 'institution_verified'
    and verified_by = (select auth.uid()) and verified_at is not null
  );
create policy "people own skill evidence links" on public.skill_claim_evidence
  for all to authenticated
  using (private.owns_evidence_scope(tenant_id, person_id))
  with check (private.owns_evidence_scope(tenant_id, person_id));

create or replace function private.capture_consent_is_active(
  want_capture uuid, want_tenant text, want_person uuid
) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.capture_asset a
    join public.consent_record c
      on c.id = a.consent_id and c.tenant_id = a.tenant_id and c.subject_user_id = a.person_id
    where a.id = want_capture and a.tenant_id = want_tenant and a.person_id = want_person
      and a.state = 'active'
      and (a.retained_until is null or a.retained_until > now())
      and c.status = 'consented' and c.revoked_at is null
      and (c.expires_at is null or c.expires_at > now())
  );
$$;
revoke all on function private.capture_consent_is_active(uuid, text, uuid) from public, anon, authenticated;
grant execute on function private.capture_consent_is_active(uuid, text, uuid) to authenticated;

create or replace function private.assert_capture_asset_consent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ok boolean;
begin
  select exists (
    select 1 from public.consent_record c
    where c.id = new.consent_id and c.tenant_id = new.tenant_id and c.subject_user_id = new.person_id
      and c.status = 'consented' and c.revoked_at is null
      and (c.expires_at is null or c.expires_at > now())
  ) into ok;
  if not ok then raise exception 'Active capture consent is required'; end if;
  return new;
end $$;

create or replace function private.assert_derived_capture_consent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.capture_consent_is_active(new.capture_id, new.tenant_id, new.person_id) then
    raise exception 'Active capture consent is required for derived material';
  end if;
  return new;
end $$;

create or replace function private.withdraw_capture_derivatives()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'consented' or new.revoked_at is not null or (new.expires_at is not null and new.expires_at <= now()) then
    update public.capture_segment s set state = 'withdrawn'
      from public.capture_asset a where a.consent_id = new.id and s.capture_id = a.id;
    update public.capture_artifact d set state = 'withdrawn'
      from public.capture_asset a where a.consent_id = new.id and d.capture_id = a.id;
    update public.capture_asset set state = 'removed' where consent_id = new.id;
  end if;
  return new;
end $$;

revoke all on function private.assert_capture_asset_consent() from public, anon, authenticated;
revoke all on function private.assert_derived_capture_consent() from public, anon, authenticated;
revoke all on function private.withdraw_capture_derivatives() from public, anon, authenticated;

create trigger capture_asset_requires_consent
  before insert or update of consent_id, tenant_id, person_id, state, retained_until on public.capture_asset
  for each row when (new.state = 'active') execute function private.assert_capture_asset_consent();
create trigger capture_segment_requires_consent
  before insert or update of capture_id, tenant_id, person_id, state on public.capture_segment
  for each row when (new.state = 'active') execute function private.assert_derived_capture_consent();
create trigger capture_artifact_requires_consent
  before insert or update of capture_id, tenant_id, person_id, state on public.capture_artifact
  for each row when (new.state <> 'withdrawn') execute function private.assert_derived_capture_consent();
create trigger consent_withdraws_capture_derivatives
  after update of status, revoked_at, expires_at on public.consent_record
  for each row execute function private.withdraw_capture_derivatives();

create policy "people own capture assets" on public.capture_asset
  for all to authenticated
  using (private.owns_evidence_scope(tenant_id, person_id))
  with check (private.owns_evidence_scope(tenant_id, person_id));
create policy "people own active capture segments" on public.capture_segment
  for all to authenticated
  using (private.owns_evidence_scope(tenant_id, person_id) and private.capture_consent_is_active(capture_id, tenant_id, person_id))
  with check (private.owns_evidence_scope(tenant_id, person_id) and private.capture_consent_is_active(capture_id, tenant_id, person_id));
create policy "people own active capture artifacts" on public.capture_artifact
  for all to authenticated
  using (private.owns_evidence_scope(tenant_id, person_id) and private.capture_consent_is_active(capture_id, tenant_id, person_id))
  with check (
    private.owns_evidence_scope(tenant_id, person_id)
    and created_by = (select auth.uid())
    and private.capture_consent_is_active(capture_id, tenant_id, person_id)
  );

comment on table public.evidence_reference is 'Tenant- and person-scoped provenance cited by learning and skills evidence.';
comment on table public.skill_claim is 'Explainable skill claims; students cannot self-promote a claim to institution verified.';
comment on table public.capture_asset is 'Original course capture bound to a versioned consent record and retention limit.';
comment on table public.capture_artifact is 'Derived capture material; inserts and reads require active capture consent.';
