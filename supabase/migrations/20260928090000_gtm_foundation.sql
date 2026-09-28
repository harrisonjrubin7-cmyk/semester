-- Semester — the go-to-market foundation (GTM plan §17, backlog phase 0).
--
-- The tables behind `app/src/lib/gtm/`: a school's recruitment contacts and
-- their consent, campaigns and their reviews, the send and conversion logs,
-- sponsor placements, and Semester's own institutional pipeline (accounts,
-- buying committee, decision log, pilots). Everything is off: the campaign and
-- sponsorship modules answer to `module.campaign_manager` and
-- `module.sponsorship` in `tenant_feature_policy`, which no school has.
--
-- The rules `lib/gtm` states are enforced here too, so no screen or worker can
-- skip them:
--
--   1. There is nothing sensitive to target on. `gtm_prospects` has a column
--      for each field the TypeScript allow-list names (TARGETABLE_FIELDS) and
--      no other targetable column: no grade, aid, health, disability, conduct
--      or protected-trait column exists to select. An audience may only name
--      those columns (`private.gtm_audience_ok`).
--   2. A campaign cannot go active without its release gate (§13.3): the
--      module in production, `kill.sharing` released, an approver who is not
--      the owner, all three reviews approved after the last edit by someone
--      other than the owner, consent requirements, a frequency cap, a
--      standard-attribution landing page, a review date after the end, and
--      the three tested checks. Content cannot change after draft.
--   3. A send is recorded before it is sent, and the record refuses what
--      `decideSend` refuses: no campaign, no template version, suppressed,
--      no current consent, topic withdrawn, quiet hours in the recipient's
--      zone, over the cap. Workers insert the decision and send only if the
--      insert succeeded.
--   4. Nobody signed in reads a prospect, a consent row, or a send. Staff get
--      counts through `gtm_campaign_report`, suppressed below ten, and every
--      call is logged.
--   5. A sponsor never appears on a protected surface or in a prohibited
--      category, and goes live only on the school's own policy, with a
--      reviewer who is not its author.
--   6. A pilot cannot start without the §6.2 elements, and its outcome cannot
--      convert over an open high-severity issue.
--
-- Recruitment contacts are not Semester accounts, so their consent is not
-- `public.consent_record` (which keys on `auth.users`); it is an append-only
-- ledger of its own here. Audit reuses `public.tenant_policy_audit_event`.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Roles and capabilities ─────────────────────────────────────────────

insert into public.app_roles (role, global) values
  ('marketing_admin',    false),
  ('campaign_reviewer',  false),
  ('marketing_analyst',  false),
  ('account_executive',  true)
on conflict (role) do nothing;

insert into public.app_capabilities (capability, about) values
  ('campaign:manage', 'Create and change one school''s recruitment and adoption campaigns and links. Cannot review or approve its own campaign, and never reads a contact.'),
  ('campaign:review', 'Record a privacy, accessibility or brand review of one school''s campaign.'),
  ('campaign:report', 'Read one school''s campaign results as suppressed counts. Never a contact, a consent row or a send.'),
  ('sponsor:review',  'Approve or remove one school''s sponsor placements under that school''s sponsorship policy.'),
  ('account:manage',  'Semester''s own institutional pipeline: accounts, buying committees, decision logs and pilots.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('marketing_admin',   'campaign:manage'),
  ('marketing_admin',   'campaign:report'),
  ('campaign_reviewer', 'campaign:review'),
  ('marketing_analyst', 'campaign:report'),
  ('university_admin',  'sponsor:review'),
  ('account_executive', 'account:manage')
on conflict (role, capability) do nothing;

-- ── 2. Vocabularies, shared with lib/gtm and held to it by a test ─────────

-- A slug part: what `slugPart` in lib/gtm/utm.ts produces.
create or replace function private.gtm_slug_ok(v text)
returns boolean language sql immutable set search_path = '' as $$
  select v ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(v) <= 60;
$$;

-- `hasStandardAttribution` in lib/gtm/utm.ts: https, only the five UTM keys and
-- `loc`, source and medium present, and a four-part campaign name.
create or replace function private.gtm_attribution_ok(url text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  query text;
  pair text;
  k text;
  v text;
  seen jsonb := '{}'::jsonb;
begin
  if url is null or url !~ '^https://[^/?#\s]+[^?#\s]*\?[^#\s]+$' then return false; end if;
  query := split_part(url, '?', 2);
  foreach pair in array string_to_array(query, '&') loop
    k := split_part(pair, '=', 1);
    v := substr(pair, length(k) + 2);
    if k not in ('utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'loc') then return false; end if;
    if v !~ '^[a-z0-9_-]+$' then return false; end if;
    seen := seen || jsonb_build_object(k, v);
  end loop;
  return seen ? 'utm_source' and seen ? 'utm_medium'
     and (seen ->> 'utm_campaign') ~ '^[a-z0-9]+(-[a-z0-9]+)*(_[a-z0-9]+(-[a-z0-9]+)*){3}$';
end $$;

-- `checkAudience` in lib/gtm/campaign.ts, as a constraint: an array of
-- {field, op, value}, each field one of the prospect columns below.
create or replace function private.gtm_audience_ok(criteria jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare c jsonb;
begin
  if jsonb_typeof(criteria) <> 'array' then return false; end if;
  for c in select * from jsonb_array_elements(criteria) loop
    if jsonb_typeof(c) <> 'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(c)) <> 3 then return false; end if;
    if not (c ->> 'field') = any (array['lifecycle_stage', 'entry_term', 'program_interest', 'declared_interest',
                                         'learner_type', 'region', 'event_registered', 'preferred_language']) then
      return false;
    end if;
    if not coalesce(c ->> 'op', '') in ('eq', 'in') then return false; end if;
    if c ->> 'op' = 'eq' and jsonb_typeof(c -> 'value') <> 'string' then return false; end if;
    if c ->> 'op' = 'in' and (jsonb_typeof(c -> 'value') <> 'array'
        or exists (select 1 from jsonb_array_elements(c -> 'value') x where jsonb_typeof(x) <> 'string')) then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- ── 3. Recruitment contacts, consent and suppression ──────────────────────
--
-- A contact is the school's CRM record, referenced, not copied: no name, no
-- address, no phone. The columns are the declared or public fields an
-- audience may use, plus the time zone quiet hours need.

create table if not exists public.gtm_prospects (
  id                 uuid        primary key default gen_random_uuid(),
  tenant_id          text        not null references public.schools(id) on delete cascade,
  public_id          text        not null unique default private.public_id('pro'),
  crm_reference      text        not null check (length(trim(crm_reference)) between 1 and 200),
  lifecycle_stage    smallint    not null check (lifecycle_stage between 1 and 10),
  entry_term         text        check (private.gtm_slug_ok(entry_term)),
  program_interest   text[]      not null default '{}',
  declared_interest  text[]      not null default '{}',
  learner_type       text        check (learner_type in ('first_year', 'transfer', 'adult', 'graduate',
                                                         'international', 'current_student')),
  region             text        check (private.gtm_slug_ok(region)),
  event_registered   text[]      not null default '{}',
  preferred_language text        check (preferred_language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'),
  time_zone          text        not null default 'America/Chicago',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, crm_reference),
  unique (id, tenant_id)
);
create index if not exists gtm_prospects_by_tenant_stage on public.gtm_prospects (tenant_id, lifecycle_stage);

create or replace function private.gtm_prospect_zone_ok()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'Unknown time zone %', new.time_zone using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists gtm_prospect_zone on public.gtm_prospects;
create trigger gtm_prospect_zone before insert or update on public.gtm_prospects
  for each row execute function private.gtm_prospect_zone_ok();

-- Append-only. The latest row for a channel (and topic) is the answer, read at
-- send time, so a STOP or a preference change applies to the next decision.
create table if not exists public.gtm_consent (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null,
  prospect_id  uuid        not null,
  channel      text        not null check (channel in ('email', 'sms', 'push')),
  topic        text        check (private.gtm_slug_ok(topic)),
  granted      boolean     not null,
  version      text        not null check (length(trim(version)) between 1 and 60),
  source       text        not null check (source in ('form', 'preference_center', 'sms_keyword', 'staff_import')),
  -- clock_timestamp, not now(): two rows in one transaction (a STOP right
  -- after an opt-in) must still have an order.
  recorded_at  timestamptz not null default clock_timestamp(),
  foreign key (prospect_id, tenant_id) references public.gtm_prospects (id, tenant_id) on delete cascade
);
create index if not exists gtm_consent_latest on public.gtm_consent (prospect_id, channel, topic, recorded_at desc);
create index if not exists gtm_consent_by_tenant on public.gtm_consent (tenant_id);
create index if not exists gtm_consent_by_prospect_tenant on public.gtm_consent (prospect_id, tenant_id);

-- Whether an update does nothing but clear the named person-reference
-- columns to null — the update `on delete set null` makes when an account is
-- deleted. Every guard below lets exactly that through: a staff member's
-- account deletion must never be refused because they once wrote a row.
create or replace function private.gtm_only_cleared(o jsonb, n jsonb, cols text[])
returns boolean language sql immutable set search_path = '' as $$
  select (o - cols) = (n - cols)
     and not exists (select 1 from unnest(cols) c where n -> c <> 'null'::jsonb and n -> c is distinct from o -> c);
$$;

-- Append-only, except for the person-reference columns named as trigger
-- arguments, which account deletion may clear.
create or replace function private.gtm_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_nargs > 0 and to_jsonb(new) <> to_jsonb(old)
     and private.gtm_only_cleared(to_jsonb(old), to_jsonb(new), tg_argv::text[]) then
    return new;
  end if;
  raise exception '% is append-only; record a new row instead', tg_table_name using errcode = '42501';
end $$;
drop trigger if exists gtm_consent_append_only on public.gtm_consent;
create trigger gtm_consent_append_only before update on public.gtm_consent
  for each row execute function private.gtm_append_only();

create table if not exists public.gtm_suppression (
  prospect_id  uuid        primary key,
  tenant_id    text        not null,
  reason       text        not null check (reason in ('bounced', 'complaint', 'requested', 'legal')),
  created_at   timestamptz not null default now(),
  foreign key (prospect_id, tenant_id) references public.gtm_prospects (id, tenant_id) on delete cascade
);
create index if not exists gtm_suppression_by_tenant on public.gtm_suppression (tenant_id);
create index if not exists gtm_suppression_by_prospect_tenant on public.gtm_suppression (prospect_id, tenant_id);

-- ── 4. Campaigns, links and reviews ───────────────────────────────────────

create table if not exists public.gtm_campaigns (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             text        not null references public.schools(id) on delete cascade,
  public_id             text        not null unique default private.public_id('cmp'),
  name                  text        not null check (length(trim(name)) between 1 and 200),
  objective             text        not null check (private.gtm_slug_ok(objective)),
  cycle                 text        not null check (private.gtm_slug_ok(cycle)),
  audience              text        not null check (private.gtm_slug_ok(audience)),
  funnel_stage          smallint    not null check (funnel_stage between 1 and 10),
  audience_criteria     jsonb       not null default '[]'::jsonb check (private.gtm_audience_ok(audience_criteria)),
  channels              text[]      not null check (cardinality(channels) > 0 and channels <@ array[
                          'email', 'sms', 'push', 'tiktok', 'instagram', 'webinar', 'alumni', 'other']),
  start_date            date        not null,
  end_date              date        not null,
  review_date           date,
  primary_cta           text        not null default '' check (length(primary_cta) <= 200),
  budget                numeric(12, 2) check (budget >= 0),
  -- Cleared if the owner's account is deleted; the campaign stays with the school.
  owner_id              uuid        default auth.uid() references auth.users(id) on delete set null,
  approver_id           uuid        references auth.users(id) on delete set null,
  privacy_basis         text        not null default '' check (length(privacy_basis) <= 500),
  consent_requirements  text[]      not null default '{}',
  frequency_max         smallint    check (frequency_max between 1 and 50),
  frequency_window_days smallint    check (frequency_window_days between 1 and 90),
  quiet_start           smallint    not null default 21 check (quiet_start between 0 and 23),
  quiet_end             smallint    not null default 8 check (quiet_end between 0 and 23),
  landing_page          text        check (landing_page is null or private.gtm_attribution_ok(landing_page)),
  success_metric        text        not null default '' check (length(success_metric) <= 200),
  baseline              text        check (length(baseline) <= 200),
  escalation_path       text        not null default '' check (length(escalation_path) <= 200),
  claims_substantiated  boolean     not null default false,
  opt_out_tested        boolean     not null default false,
  conversion_instrumentation_tested boolean not null default false,
  status                text        not null default 'draft' check (status in (
                          'draft', 'in_review', 'approved', 'active', 'paused', 'completed', 'retired')),
  content_changed_at    timestamptz not null default now(),
  activated_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint gtm_campaign_dates check (end_date > start_date),
  constraint gtm_campaign_born_draft check (status <> 'active' or activated_at is not null),
  unique (id, tenant_id)
);
create index if not exists gtm_campaigns_by_tenant on public.gtm_campaigns (tenant_id, status);
create index if not exists gtm_campaigns_by_owner on public.gtm_campaigns (owner_id);
create index if not exists gtm_campaigns_by_approver on public.gtm_campaigns (approver_id);

create table if not exists public.gtm_campaign_links (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null,
  campaign_id  uuid        not null,
  url          text        not null check (private.gtm_attribution_ok(url)),
  placement    text        check (private.gtm_slug_ok(placement)),
  created_at   timestamptz not null default now(),
  foreign key (campaign_id, tenant_id) references public.gtm_campaigns (id, tenant_id) on delete cascade
);
create index if not exists gtm_campaign_links_by_campaign on public.gtm_campaign_links (campaign_id, tenant_id);
create index if not exists gtm_campaign_links_by_tenant on public.gtm_campaign_links (tenant_id);

create table if not exists public.gtm_campaign_reviews (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null,
  campaign_id  uuid        not null,
  kind         text        not null check (kind in ('privacy', 'accessibility', 'brand')),
  reviewer_id  uuid        default auth.uid() references auth.users(id) on delete set null,
  decision     text        not null check (decision in ('approved', 'changes_requested')),
  note         text        not null default '' check (length(note) <= 2000),
  recorded_at  timestamptz not null default now(),
  foreign key (campaign_id, tenant_id) references public.gtm_campaigns (id, tenant_id) on delete cascade
);
create index if not exists gtm_campaign_reviews_latest on public.gtm_campaign_reviews (campaign_id, kind, recorded_at desc);
create index if not exists gtm_campaign_reviews_by_tenant on public.gtm_campaign_reviews (tenant_id);
create index if not exists gtm_campaign_reviews_by_reviewer on public.gtm_campaign_reviews (reviewer_id);
create index if not exists gtm_campaign_reviews_by_campaign_tenant on public.gtm_campaign_reviews (campaign_id, tenant_id);

drop trigger if exists gtm_campaign_reviews_append_only on public.gtm_campaign_reviews;
create trigger gtm_campaign_reviews_append_only before update on public.gtm_campaign_reviews
  for each row execute function private.gtm_append_only('reviewer_id');

-- The reviews still owed: a kind whose latest review, since the last content
-- change, is not an approval by someone other than the owner.
create or replace function private.gtm_reviews_outstanding(want_campaign uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(k order by k), '{}')
    from unnest(array['accessibility', 'brand', 'privacy']) k
   where not exists (
     select 1
       from public.gtm_campaigns c
       cross join lateral (
         select r.decision, r.reviewer_id
           from public.gtm_campaign_reviews r
          where r.campaign_id = c.id and r.kind = k and r.recorded_at >= c.content_changed_at
          order by r.recorded_at desc, r.id desc
          limit 1
       ) latest
      where c.id = want_campaign
        and latest.decision = 'approved'
        and latest.reviewer_id <> c.owner_id
   );
$$;
revoke all on function private.gtm_reviews_outstanding(uuid) from public, anon;
grant execute on function private.gtm_reviews_outstanding(uuid) to authenticated;

-- `activationGate`, minus what only the app knows (the audience count).
-- Returns the failures; empty means the campaign may go active.
create or replace function public.gtm_activation_failures(want_campaign uuid)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare
  c public.gtm_campaigns;
  out text[] := '{}';
  outstanding text[];
begin
  select * into c from public.gtm_campaigns where id = want_campaign;
  if not found then return array['not_found']; end if;
  if auth.uid() is not null
     and not private.has_capability('campaign:manage', 'school', c.tenant_id)
     and not private.has_capability('campaign:review', 'school', c.tenant_id) then
    return array['not_found'];
  end if;
  if public.feature_state('module.campaign_manager', c.tenant_id) <> 'production' then out := out || 'flag'::text; end if;
  if public.kill_switch_engaged('kill.sharing', c.tenant_id) then out := out || 'kill_switch'::text; end if;
  if c.status not in ('approved', 'paused') then out := out || ('status:' || c.status); end if;
  if c.owner_id is null then out := out || 'owner'::text; end if;
  if c.approver_id is null or c.approver_id = c.owner_id then out := out || 'approver'::text; end if;
  if length(trim(c.privacy_basis)) = 0 then out := out || 'privacy_basis'::text; end if;
  if length(trim(c.primary_cta)) = 0 then out := out || 'primary_cta'::text; end if;
  if length(trim(c.success_metric)) = 0 then out := out || 'success_metric'::text; end if;
  if length(trim(c.escalation_path)) = 0 then out := out || 'escalation_path'::text; end if;
  if cardinality(c.consent_requirements) = 0 then out := out || 'consent_requirements'::text; end if;
  if c.frequency_max is null or c.frequency_window_days is null then out := out || 'frequency_cap'::text; end if;
  if c.landing_page is null then out := out || 'landing_page'::text; end if;
  if c.review_date is null or c.review_date < c.end_date then out := out || 'review_date'::text; end if;
  if not c.claims_substantiated then out := out || 'claims_substantiated'::text; end if;
  if not c.opt_out_tested then out := out || 'opt_out_tested'::text; end if;
  if not c.conversion_instrumentation_tested then out := out || 'conversion_instrumentation_tested'::text; end if;
  outstanding := private.gtm_reviews_outstanding(c.id);
  if cardinality(outstanding) > 0 then out := out || ('review:' || array_to_string(outstanding, ',')); end if;
  return out;
end $$;
revoke all on function public.gtm_activation_failures(uuid) from public, anon;
grant execute on function public.gtm_activation_failures(uuid) to authenticated;

-- Status moves (`canMove` in lib/gtm/campaign.ts), who may make them, and the
-- rule that content changes only in draft.
create or replace function private.gtm_campaign_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  failures text[];
  content_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'A campaign is created as a draft' using errcode = '42501';
    end if;
    new.content_changed_at := clock_timestamp();
    new.activated_at := null;
    return new;
  end if;

  if private.gtm_only_cleared(to_jsonb(old), to_jsonb(new), array['owner_id', 'approver_id'])
     and to_jsonb(new) <> to_jsonb(old) then
    return new;
  end if;

  if new.tenant_id <> old.tenant_id or new.owner_id is distinct from old.owner_id or new.public_id <> old.public_id then
    raise exception 'A campaign''s school, owner and id do not change' using errcode = '42501';
  end if;

  content_changed := (to_jsonb(new) - array['status', 'updated_at', 'content_changed_at', 'activated_at'])
                     is distinct from (to_jsonb(old) - array['status', 'updated_at', 'content_changed_at', 'activated_at']);
  if content_changed then
    if old.status <> 'draft' or new.status <> 'draft' then
      raise exception 'Only a draft campaign can be changed; return it to draft first' using errcode = '42501';
    end if;
    new.content_changed_at := clock_timestamp();
  end if;

  if new.status <> old.status then
    if not (
      (old.status = 'draft'     and new.status in ('in_review', 'retired')) or
      (old.status = 'in_review' and new.status in ('draft', 'approved')) or
      (old.status = 'approved'  and new.status in ('draft', 'retired', 'active')) or
      (old.status = 'active'    and new.status in ('paused', 'completed')) or
      (old.status = 'paused'    and new.status in ('active', 'completed', 'retired')) or
      (old.status = 'completed' and new.status = 'retired')
    ) then
      raise exception 'A campaign cannot move from % to %', old.status, new.status using errcode = '42501';
    end if;

    if new.status = 'approved' then
      if auth.uid() is distinct from old.approver_id then
        raise exception 'Only the named approver approves a campaign' using errcode = '42501';
      end if;
      if old.approver_id = old.owner_id then
        raise exception 'A campaign''s owner does not approve it' using errcode = '42501';
      end if;
      if cardinality(private.gtm_reviews_outstanding(old.id)) > 0 then
        raise exception 'Reviews outstanding: %', array_to_string(private.gtm_reviews_outstanding(old.id), ', ')
          using errcode = '42501';
      end if;
    end if;

    if new.status = 'active' then
      failures := public.gtm_activation_failures(old.id);
      if cardinality(failures) > 0 then
        raise exception 'This campaign cannot activate: %', array_to_string(failures, ', ') using errcode = '42501';
      end if;
      new.activated_at := now();
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;
drop trigger if exists gtm_campaign_guard on public.gtm_campaigns;
create trigger gtm_campaign_guard before insert or update on public.gtm_campaigns
  for each row execute function private.gtm_campaign_guard();

-- A review is recorded while the campaign is in review, by a reviewer who is
-- not its owner.
create or replace function private.gtm_review_guard()
returns trigger language plpgsql set search_path = '' as $$
declare c public.gtm_campaigns;
begin
  select * into c from public.gtm_campaigns where id = new.campaign_id;
  if c.status <> 'in_review' then
    raise exception 'A campaign is reviewed while it is in review' using errcode = '42501';
  end if;
  if new.reviewer_id = c.owner_id then
    raise exception 'A campaign''s owner does not review it' using errcode = '42501';
  end if;
  new.recorded_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists gtm_review_guard on public.gtm_campaign_reviews;
create trigger gtm_review_guard before insert on public.gtm_campaign_reviews
  for each row execute function private.gtm_review_guard();

-- ── 5. The send log and the conversion log ────────────────────────────────

create table if not exists public.gtm_communication_events (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        text        not null,
  campaign_id      uuid        not null,
  prospect_id      uuid        not null,
  kind             text        not null check (kind in (
                     'decision', 'delivered', 'bounced', 'opened', 'clicked', 'replied', 'opted_out')),
  channel          text        not null check (channel in ('email', 'sms', 'push')),
  purpose          text        not null check (purpose in ('transactional', 'marketing')),
  topic            text        not null check (private.gtm_slug_ok(topic)),
  template_id      text        not null check (length(trim(template_id)) between 1 and 100),
  template_version text        not null check (length(trim(template_version)) between 1 and 40),
  consent_version  text        check (length(trim(consent_version)) between 1 and 60),
  allowed          boolean,
  refusal          text        check (refusal in ('missing_identifiers', 'suppressed', 'no_consent', 'topic_unsubscribed',
                                                   'quiet_hours', 'frequency_cap', 'campaign_inactive', 'module_off',
                                                   'kill_switch', 'channel_not_in_campaign',
                                                   'consent_version_not_required')),
  occurred_at      timestamptz not null default now(),
  constraint gtm_event_decision_shape check (
    (kind = 'decision') = (allowed is not null)
    and (allowed is distinct from true or refusal is null)
    and (allowed is distinct from false or refusal is not null)),
  constraint gtm_event_consent_version check (
    allowed is distinct from true
    or (channel = 'email' and purpose = 'transactional')
    or consent_version is not null),
  foreign key (campaign_id, tenant_id) references public.gtm_campaigns (id, tenant_id) on delete cascade,
  foreign key (prospect_id, tenant_id) references public.gtm_prospects (id, tenant_id) on delete cascade
);
create index if not exists gtm_events_by_campaign on public.gtm_communication_events (campaign_id, kind);
create index if not exists gtm_events_cap on public.gtm_communication_events (prospect_id, channel, occurred_at desc)
  where kind = 'decision' and allowed;
create index if not exists gtm_events_by_tenant on public.gtm_communication_events (tenant_id);
create index if not exists gtm_events_by_campaign_tenant on public.gtm_communication_events (campaign_id, tenant_id);
create index if not exists gtm_events_by_prospect_tenant on public.gtm_communication_events (prospect_id, tenant_id);

drop trigger if exists gtm_events_append_only on public.gtm_communication_events;
create trigger gtm_events_append_only before update on public.gtm_communication_events
  for each row execute function private.gtm_append_only();

-- `decideSend`, as a refusal on insert. An allowed decision is only written
-- if every check `decideSend` makes would have allowed it, and its consent
-- version must be the one that allowed it.
create or replace function private.gtm_send_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  c public.gtm_campaigns;
  p public.gtm_prospects;
  channel_consent public.gtm_consent;
  topic_consent public.gtm_consent;
  local_hour int;
  sent int;
begin
  new.occurred_at := now();
  if new.kind <> 'decision' or not new.allowed then return new; end if;

  select * into c from public.gtm_campaigns where id = new.campaign_id;
  select * into p from public.gtm_prospects where id = new.prospect_id;

  if new.purpose = 'marketing' and c.status <> 'active' then
    raise exception 'refused: campaign_inactive' using errcode = '42501';
  end if;
  -- Read on every decision, not only at activation: switching the module off
  -- or engaging kill.sharing stops the next send of a campaign already live.
  if public.feature_state('module.campaign_manager', c.tenant_id) <> 'production' then
    raise exception 'refused: module_off' using errcode = '42501';
  end if;
  if public.kill_switch_engaged('kill.sharing', c.tenant_id) then
    raise exception 'refused: kill_switch' using errcode = '42501';
  end if;
  -- Only the channels the campaign was reviewed and approved with.
  if not new.channel = any (c.channels) then
    raise exception 'refused: channel_not_in_campaign' using errcode = '42501';
  end if;
  if exists (select 1 from public.gtm_suppression s where s.prospect_id = p.id) then
    raise exception 'refused: suppressed' using errcode = '42501';
  end if;
  if new.channel = 'email' and new.purpose = 'transactional' then
    new.consent_version := null;
    return new;
  end if;

  select * into channel_consent from public.gtm_consent g
   where g.prospect_id = p.id and g.channel = new.channel and g.topic is null
   order by g.recorded_at desc, g.id desc limit 1;
  if not found or not channel_consent.granted then
    raise exception 'refused: no_consent' using errcode = '42501';
  end if;
  if new.consent_version is distinct from channel_consent.version then
    raise exception 'refused: the consent version recorded is not the current one' using errcode = '42501';
  end if;
  -- The campaign names the consent language it was approved against; an
  -- older (or other) version on file does not cover it.
  if not channel_consent.version = any (c.consent_requirements) then
    raise exception 'refused: consent_version_not_required' using errcode = '42501';
  end if;

  select * into topic_consent from public.gtm_consent g
   where g.prospect_id = p.id and g.channel = new.channel and g.topic = new.topic
   order by g.recorded_at desc, g.id desc limit 1;
  if found and not topic_consent.granted then
    raise exception 'refused: topic_unsubscribed' using errcode = '42501';
  end if;

  if new.channel in ('sms', 'push') then
    local_hour := extract(hour from (now() at time zone p.time_zone))::int;
    if c.quiet_start <> c.quiet_end and (
         (c.quiet_start < c.quiet_end and local_hour >= c.quiet_start and local_hour < c.quiet_end) or
         (c.quiet_start > c.quiet_end and (local_hour >= c.quiet_start or local_hour < c.quiet_end))) then
      raise exception 'refused: quiet_hours' using errcode = '42501';
    end if;
  end if;

  -- The cap counts every message on this channel except transactional email
  -- (which returned above), as `decideSend` does: a transactional SMS still
  -- interrupts someone.
  --
  -- Two workers deciding for the same contact and channel at once would
  -- each count the same committed rows and both pass at cap minus one. The
  -- lock serializes the count and the insert per contact and channel until
  -- this transaction ends.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p.id::text || ':' || new.channel, 0));
  select count(*) into sent from public.gtm_communication_events e
   where e.prospect_id = p.id and e.channel = new.channel and e.kind = 'decision' and e.allowed
     and not (e.channel = 'email' and e.purpose = 'transactional')
     and e.occurred_at > now() - make_interval(days => coalesce(c.frequency_window_days, 7));
  if sent >= coalesce(c.frequency_max, 0) then
    raise exception 'refused: frequency_cap' using errcode = '42501';
  end if;

  return new;
end $$;
drop trigger if exists gtm_send_guard on public.gtm_communication_events;
create trigger gtm_send_guard before insert on public.gtm_communication_events
  for each row execute function private.gtm_send_guard();

create table if not exists public.gtm_conversion_events (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null,
  prospect_id   uuid        not null,
  stage         smallint    not null check (stage between 1 and 10),
  campaign_id   uuid,
  utm_source    text        check (utm_source ~ '^[a-z0-9_-]{1,60}$'),
  utm_medium    text        check (utm_medium ~ '^[a-z0-9_-]{1,60}$'),
  utm_campaign  text        check (utm_campaign ~ '^[a-z0-9]+(-[a-z0-9]+)*(_[a-z0-9]+(-[a-z0-9]+)*){3}$'),
  utm_content   text        check (utm_content ~ '^[a-z0-9_-]{1,100}$'),
  placement     text        check (private.gtm_slug_ok(placement)),
  occurred_at   timestamptz not null default now(),
  foreign key (prospect_id, tenant_id) references public.gtm_prospects (id, tenant_id) on delete cascade,
  foreign key (campaign_id, tenant_id) references public.gtm_campaigns (id, tenant_id) on delete set null (campaign_id)
);
create index if not exists gtm_conversions_by_campaign on public.gtm_conversion_events (campaign_id, stage);
create index if not exists gtm_conversions_by_tenant on public.gtm_conversion_events (tenant_id, stage);
create index if not exists gtm_conversions_by_prospect_tenant on public.gtm_conversion_events (prospect_id, tenant_id);
create index if not exists gtm_conversions_by_campaign_tenant on public.gtm_conversion_events (campaign_id, tenant_id);

drop trigger if exists gtm_conversions_append_only on public.gtm_conversion_events;
create trigger gtm_conversions_append_only before update on public.gtm_conversion_events
  for each row execute function private.gtm_append_only();

-- Every read of campaign results, by whom (§16.4: dashboard access is logged).
create table if not exists public.gtm_report_access (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  campaign_id  uuid        not null,
  actor_id     uuid        references auth.users(id) on delete set null,
  accessed_at  timestamptz not null default now(),
  foreign key (campaign_id, tenant_id) references public.gtm_campaigns (id, tenant_id) on delete cascade
);
create index if not exists gtm_report_access_by_tenant on public.gtm_report_access (tenant_id, accessed_at desc);
create index if not exists gtm_report_access_by_actor on public.gtm_report_access (actor_id);
create index if not exists gtm_report_access_by_campaign on public.gtm_report_access (campaign_id, tenant_id);

-- Counts for one campaign, each suppressed below ten, and the call logged.
-- Volatile because it writes the access row.
create or replace function public.gtm_campaign_report(want_campaign uuid)
returns table (metric text, value bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare c public.gtm_campaigns;
begin
  select * into c from public.gtm_campaigns where id = want_campaign;
  if not found or not (private.has_capability('campaign:report', 'school', c.tenant_id)
                       or private.has_capability('campaign:manage', 'school', c.tenant_id)) then
    raise exception 'No such campaign' using errcode = '42501';
  end if;
  insert into public.gtm_report_access (tenant_id, campaign_id, actor_id) values (c.tenant_id, c.id, auth.uid());
  return query
    with raw as (
      select 'sent'::text as m, count(*) filter (where e.kind = 'decision' and e.allowed) as n
        from public.gtm_communication_events e where e.campaign_id = c.id
      union all
      select 'refused', count(*) filter (where e.kind = 'decision' and not e.allowed)
        from public.gtm_communication_events e where e.campaign_id = c.id
      union all
      select e.kind, count(distinct e.prospect_id)
        from public.gtm_communication_events e where e.campaign_id = c.id and e.kind <> 'decision'
       group by e.kind
      union all
      select 'stage_' || v.stage, count(distinct v.prospect_id)
        from public.gtm_conversion_events v where v.campaign_id = c.id
       group by v.stage
    )
    select raw.m, case when raw.n >= 10 then raw.n end from raw order by raw.m;
end $$;
revoke all on function public.gtm_campaign_report(uuid) from public, anon;
grant execute on function public.gtm_campaign_report(uuid) to authenticated;

-- The exact audience count a campaign must show (§16.2), for its staff.
create or replace function public.gtm_audience_count(want_campaign uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare
  c public.gtm_campaigns;
  n bigint;
begin
  select * into c from public.gtm_campaigns where id = want_campaign;
  if not found or not (private.has_capability('campaign:manage', 'school', c.tenant_id)
                       or private.has_capability('campaign:review', 'school', c.tenant_id)) then
    raise exception 'No such campaign' using errcode = '42501';
  end if;
  select count(*) into n
    from public.gtm_prospects p
   where p.tenant_id = c.tenant_id
     and not exists (select 1 from public.gtm_suppression s where s.prospect_id = p.id)
     and not exists (
       select 1 from jsonb_array_elements(c.audience_criteria) k
        where not (
          case k ->> 'field'
            when 'lifecycle_stage'    then p.lifecycle_stage::text
            when 'entry_term'         then p.entry_term
            when 'learner_type'       then p.learner_type
            when 'region'             then p.region
            when 'preferred_language' then p.preferred_language
          end = any (case when k ->> 'op' = 'eq' then array[k ->> 'value']
                          else array(select jsonb_array_elements_text(k -> 'value')) end)
          or case k ->> 'field'
               when 'program_interest'  then p.program_interest
               when 'declared_interest' then p.declared_interest
               when 'event_registered'  then p.event_registered
             end && (case when k ->> 'op' = 'eq' then array[k ->> 'value']
                          else array(select jsonb_array_elements_text(k -> 'value')) end)
        ) is true
     );
  return n;
end $$;
revoke all on function public.gtm_audience_count(uuid) from public, anon;
grant execute on function public.gtm_audience_count(uuid) to authenticated;

-- ── 6. Sponsorship ────────────────────────────────────────────────────────

create table if not exists public.gtm_sponsor_policy (
  tenant_id   text        primary key references public.schools(id) on delete cascade,
  enabled     boolean     not null default false,
  categories  text[]      not null default '{}' check (categories <@ array[
                'education_career', 'student_services', 'scholarships_verified', 'wellness_nonclinical',
                'housing_transport_verified', 'campus_community']),
  surfaces    text[]      not null default '{}' check (not (surfaces && array[
                'ai_answer', 'advising', 'course_recommendation', 'ranking', 'degree_plan', 'registration',
                'financial_aid_deadline', 'add_drop', 'crisis_support', 'accommodation', 'grades'])),
  segments    text[]      not null default '{}',
  updated_at  timestamptz not null default now()
);

-- Category is an allow-list; the prohibited list in lib/gtm/sponsor.ts is
-- named there for the message, and none of it is in this list.
create table if not exists public.gtm_sponsor_placements (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        text        not null references public.schools(id) on delete cascade,
  sponsor_name     text        not null check (length(trim(sponsor_name)) between 1 and 200),
  category         text        not null check (category in (
                     'education_career', 'student_services', 'scholarships_verified', 'wellness_nonclinical',
                     'housing_transport_verified', 'campus_community')),
  surface          text        not null check (private.gtm_slug_ok(replace(surface, '_', '-')) and surface not in (
                     'ai_answer', 'advising', 'course_recommendation', 'ranking', 'degree_plan', 'registration',
                     'financial_aid_deadline', 'add_drop', 'crisis_support', 'accommodation', 'grades')),
  targeting        text        not null default 'contextual' check (targeting in ('contextual', 'segment')),
  segment          text,
  label            text        not null check (label ~* '\m(sponsored|promoted|paid partnership)\M'),
  why_shown        text        not null check (length(trim(why_shown)) between 1 and 500),
  complaint_route  text        not null check (length(trim(complaint_route)) between 1 and 300),
  status           text        not null default 'draft' check (status in ('draft', 'approved', 'live', 'removed')),
  created_by       uuid        default auth.uid() references auth.users(id) on delete set null,
  approved_by      uuid        references auth.users(id) on delete set null,
  approved_at      timestamptz,
  audit_due        date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint gtm_placement_segment check ((targeting = 'segment') = (segment is not null))
);
create index if not exists gtm_placements_by_tenant on public.gtm_sponsor_placements (tenant_id, status);
create index if not exists gtm_placements_by_creator on public.gtm_sponsor_placements (created_by);
create index if not exists gtm_placements_by_approver on public.gtm_sponsor_placements (approved_by);

create or replace function private.gtm_placement_guard()
returns trigger language plpgsql set search_path = '' as $$
declare pol public.gtm_sponsor_policy;
begin
  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'A placement is created as a draft' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and to_jsonb(new) <> to_jsonb(old)
     and private.gtm_only_cleared(to_jsonb(old), to_jsonb(new), array['created_by', 'approved_by']) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'removed' then
    raise exception 'A removed placement stays removed; write a new one' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status in ('approved', 'live') and old.status = 'draft' or new.status = 'live' then
      if auth.uid() is not null and (auth.uid() = new.created_by
          or not private.has_capability('sponsor:review', 'school', new.tenant_id)) then
        raise exception 'A placement is approved by a sponsor reviewer who did not write it' using errcode = '42501';
      end if;
      new.approved_by := coalesce(auth.uid(), new.approved_by);
      new.approved_at := now();
    end if;
    if new.status = 'live' then
      select * into pol from public.gtm_sponsor_policy where tenant_id = new.tenant_id;
      if public.feature_state('module.sponsorship', new.tenant_id) <> 'production'
         or public.kill_switch_engaged('kill.sharing', new.tenant_id)
         or pol is null or not pol.enabled
         or not new.category = any (pol.categories)
         or not new.surface = any (pol.surfaces)
         or (new.targeting = 'segment' and not new.segment = any (pol.segments))
         or new.audit_due is null
         or new.approved_by is null then
        raise exception 'This placement cannot go live under this school''s policy' using errcode = '42501';
      end if;
    end if;
  end if;
  if tg_op = 'UPDATE' and old.status in ('approved', 'live')
     and (to_jsonb(new) - array['status', 'updated_at', 'approved_by', 'approved_at'])
         is distinct from (to_jsonb(old) - array['status', 'updated_at', 'approved_by', 'approved_at']) then
    raise exception 'An approved placement is not edited; remove it and write a new one' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists gtm_placement_guard on public.gtm_sponsor_placements;
create trigger gtm_placement_guard before insert or update on public.gtm_sponsor_placements
  for each row execute function private.gtm_placement_guard();

-- ── 7. Semester's institutional pipeline (platform scope) ─────────────────

create table if not exists public.gtm_accounts (
  id          uuid        primary key default gen_random_uuid(),
  public_id   text        not null unique default private.public_id('acct'),
  name        text        not null check (length(trim(name)) between 1 and 200),
  segment     text        not null check (segment in ('research', 'regional', 'community_college', 'liberal_arts',
                                                     'system', 'online', 'other')),
  -- Set once the institution is a school in Semester; its configurers can
  -- then read this account's committee, decision log and pilots.
  tenant_id   text        references public.schools(id) on delete set null,
  status      text        not null default 'target' check (status in (
                'target', 'engaged', 'pilot', 'customer', 'paused', 'closed_lost')),
  owner_id    uuid        default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists gtm_accounts_by_tenant on public.gtm_accounts (tenant_id);
create index if not exists gtm_accounts_by_owner on public.gtm_accounts (owner_id);

create table if not exists public.gtm_stakeholders (
  id              uuid        primary key default gen_random_uuid(),
  account_id      uuid        not null references public.gtm_accounts(id) on delete cascade,
  committee_role  text        not null check (committee_role in (
                    'executive_sponsor', 'operational_owner', 'cio', 'ciso_privacy', 'accessibility',
                    'registrar_data_governance', 'procurement', 'legal', 'finance', 'champion')),
  display_name    text        not null check (length(trim(display_name)) between 1 and 200),
  title           text        not null default '' check (length(title) <= 200),
  created_at      timestamptz not null default now()
);
create index if not exists gtm_stakeholders_by_account on public.gtm_stakeholders (account_id, committee_role);

create table if not exists public.gtm_decision_log (
  id               uuid        primary key default gen_random_uuid(),
  account_id       uuid        not null references public.gtm_accounts(id) on delete cascade,
  stakeholder_id   uuid        references public.gtm_stakeholders(id) on delete set null,
  committee_role   text        not null check (committee_role in (
                     'executive_sponsor', 'operational_owner', 'cio', 'ciso_privacy', 'accessibility',
                     'registrar_data_governance', 'procurement', 'legal', 'finance', 'champion')),
  question         text        not null check (length(trim(question)) between 1 and 2000),
  category         text        not null check (category in ('security', 'privacy', 'accessibility', 'legal',
                                                            'integration', 'budget', 'procurement', 'implementation')),
  status           text        not null default 'open' check (status in ('open', 'in_review', 'blocked', 'approved', 'declined')),
  owner            text        not null check (length(trim(owner)) between 1 and 200),
  requested_date   date        not null default current_date,
  target_date      date        not null,
  resolution_date  date,
  evidence_links   text[]      not null default '{}',
  risk_level       text        not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  notes            text        not null default '' check (length(notes) <= 4000),
  updated_at       timestamptz not null default now(),
  constraint gtm_decision_resolved check ((status in ('approved', 'declined')) = (resolution_date is not null)),
  constraint gtm_decision_evidence check (status <> 'approved' or cardinality(evidence_links) > 0)
);
create index if not exists gtm_decision_log_by_account on public.gtm_decision_log (account_id, status, target_date);
create index if not exists gtm_decision_log_by_stakeholder on public.gtm_decision_log (stakeholder_id);

create table if not exists public.gtm_pilots (
  id                         uuid        primary key default gen_random_uuid(),
  account_id                 uuid        not null references public.gtm_accounts(id) on delete cascade,
  workflow                   text        not null check (length(trim(workflow)) between 1 and 200),
  cohort                     text        not null default '' check (length(cohort) <= 200),
  baseline                   text        check (length(baseline) <= 500),
  executive_sponsor          text,
  operational_champion       text,
  start_date                 date        not null,
  end_date                   date        not null,
  midpoint_review_date       date,
  conversion_date            date,
  annual_price_agreed        boolean     not null default false,
  minimum_necessary_data     boolean     not null default false,
  read_only_first            boolean     not null default false,
  source_labelled            boolean     not null default false,
  production_data_approved   boolean     not null default false,
  status                     text        not null default 'proposed' check (status in ('proposed', 'active', 'decided')),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index if not exists gtm_pilots_by_account on public.gtm_pilots (account_id);

create table if not exists public.gtm_pilot_metrics (
  id        uuid primary key default gen_random_uuid(),
  pilot_id  uuid not null references public.gtm_pilots(id) on delete cascade,
  name      text not null check (length(trim(name)) between 1 and 200),
  target    text not null check (length(trim(target)) between 1 and 200),
  baseline  text check (length(trim(baseline)) between 1 and 200)
);
create index if not exists gtm_pilot_metrics_by_pilot on public.gtm_pilot_metrics (pilot_id);

create table if not exists public.gtm_pilot_outcomes (
  pilot_id                  uuid        primary key references public.gtm_pilots(id) on delete cascade,
  decision                  text        not null check (decision in ('convert', 'expand', 'pause', 'stop')),
  signed_by                 text        not null check (length(trim(signed_by)) between 1 and 200),
  signed_at                 date        not null,
  unresolved_high_severity  int         not null check (unresolved_high_severity >= 0),
  recorded_at               timestamptz not null default now(),
  constraint gtm_outcome_no_convert_over_open_issue check (
    decision not in ('convert', 'expand') or unresolved_high_severity = 0)
);

-- `pilotReadiness` in lib/gtm/pilot.ts, at the move to active.
create or replace function public.gtm_pilot_problems(want_pilot uuid)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare
  p public.gtm_pilots;
  out text[] := '{}';
  n int;
  days int;
begin
  select * into p from public.gtm_pilots where id = want_pilot;
  if not found then return array['not_found']; end if;
  days := p.end_date - p.start_date;
  if days < 60 or days > 120 then out := out || 'duration'::text; end if;
  if length(trim(p.cohort)) = 0 then out := out || 'no_cohort'::text; end if;
  if p.baseline is null then out := out || 'no_baseline'::text; end if;
  if p.executive_sponsor is null then out := out || 'no_sponsor'::text; end if;
  if p.operational_champion is null then out := out || 'no_champion'::text; end if;
  if not (p.minimum_necessary_data and p.read_only_first and p.source_labelled) then out := out || 'data_plan'::text; end if;
  select count(*) into n from public.gtm_pilot_metrics m where m.pilot_id = p.id;
  if n < 3 or n > 5 then out := out || 'metric_count'::text; end if;
  if exists (select 1 from public.gtm_pilot_metrics m where m.pilot_id = p.id and m.baseline is null) then
    out := out || 'metric_baseline'::text;
  end if;
  if p.conversion_date is null then out := out || 'no_conversion_date'::text;
  elsif p.conversion_date < p.end_date - 14 or p.conversion_date > p.end_date + 30 then
    out := out || 'conversion_outside_window'::text;
  end if;
  if not p.annual_price_agreed then out := out || 'no_price'::text; end if;
  if p.midpoint_review_date is null then out := out || 'no_midpoint'::text; end if;
  return out;
end $$;
revoke all on function public.gtm_pilot_problems(uuid) from public, anon;
grant execute on function public.gtm_pilot_problems(uuid) to authenticated;

create or replace function private.gtm_pilot_guard()
returns trigger language plpgsql set search_path = '' as $$
declare problems text[];
begin
  if tg_op = 'INSERT' and new.status <> 'proposed' then
    raise exception 'A pilot is created as a proposal' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not ((old.status = 'proposed' and new.status = 'active') or (old.status = 'active' and new.status = 'decided')) then
      raise exception 'A pilot cannot move from % to %', old.status, new.status using errcode = '42501';
    end if;
    if new.status = 'active' then
      problems := public.gtm_pilot_problems(new.id);
      if cardinality(problems) > 0 then
        raise exception 'This pilot is not ready: %', array_to_string(problems, ', ') using errcode = '42501';
      end if;
    end if;
    if new.status = 'decided' and not exists (select 1 from public.gtm_pilot_outcomes o where o.pilot_id = new.id) then
      raise exception 'A pilot is decided by a signed outcome' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists gtm_pilot_guard on public.gtm_pilots;
create trigger gtm_pilot_guard before insert or update on public.gtm_pilots
  for each row execute function private.gtm_pilot_guard();

-- ── 8. Row-level security ─────────────────────────────────────────────────

alter table public.gtm_prospects            enable row level security;
alter table public.gtm_consent              enable row level security;
alter table public.gtm_suppression          enable row level security;
alter table public.gtm_campaigns            enable row level security;
alter table public.gtm_campaign_links       enable row level security;
alter table public.gtm_campaign_reviews     enable row level security;
alter table public.gtm_communication_events enable row level security;
alter table public.gtm_conversion_events    enable row level security;
alter table public.gtm_report_access        enable row level security;
alter table public.gtm_sponsor_policy       enable row level security;
alter table public.gtm_sponsor_placements   enable row level security;
alter table public.gtm_accounts             enable row level security;
alter table public.gtm_stakeholders         enable row level security;
alter table public.gtm_decision_log         enable row level security;
alter table public.gtm_pilots               enable row level security;
alter table public.gtm_pilot_metrics        enable row level security;
alter table public.gtm_pilot_outcomes       enable row level security;

-- Contacts, consent, suppression, sends and conversions: workers only. Staff
-- see counts through the functions above, never a row.
revoke all on table public.gtm_prospects, public.gtm_consent, public.gtm_suppression,
                    public.gtm_communication_events, public.gtm_conversion_events
  from anon, authenticated;

revoke all on table public.gtm_campaigns, public.gtm_campaign_links, public.gtm_campaign_reviews,
                    public.gtm_report_access, public.gtm_sponsor_policy, public.gtm_sponsor_placements,
                    public.gtm_accounts, public.gtm_stakeholders, public.gtm_decision_log,
                    public.gtm_pilots, public.gtm_pilot_metrics, public.gtm_pilot_outcomes
  from anon, authenticated;

grant select, insert, update on table public.gtm_campaigns to authenticated;
grant select, insert, delete on table public.gtm_campaign_links to authenticated;
grant select, insert on table public.gtm_campaign_reviews to authenticated;
grant select on table public.gtm_report_access to authenticated;
grant select, insert, update on table public.gtm_sponsor_policy to authenticated;
grant select, insert, update on table public.gtm_sponsor_placements to authenticated;
grant select, insert, update on table public.gtm_accounts, public.gtm_decision_log, public.gtm_pilots to authenticated;
grant select, insert, update, delete on table public.gtm_stakeholders, public.gtm_pilot_metrics to authenticated;
grant select, insert on table public.gtm_pilot_outcomes to authenticated;

-- Campaigns: the school's managers write; its reviewers and analysts read.
drop policy if exists "campaign staff read their school's campaigns" on public.gtm_campaigns;
create policy "campaign staff read their school's campaigns" on public.gtm_campaigns
  for select to authenticated
  using (private.has_capability('campaign:manage', 'school', tenant_id)
         or private.has_capability('campaign:review', 'school', tenant_id)
         or private.has_capability('campaign:report', 'school', tenant_id));
drop policy if exists "campaign managers create their own drafts" on public.gtm_campaigns;
create policy "campaign managers create their own drafts" on public.gtm_campaigns
  for insert to authenticated
  with check (private.has_capability('campaign:manage', 'school', tenant_id) and owner_id = (select auth.uid()));
-- The named approver may update (to approve); the trigger decides what moves.
drop policy if exists "campaign managers and the approver change campaigns" on public.gtm_campaigns;
create policy "campaign managers and the approver change campaigns" on public.gtm_campaigns
  for update to authenticated
  using (private.has_capability('campaign:manage', 'school', tenant_id)
         or (approver_id = (select auth.uid()) and private.has_capability('campaign:review', 'school', tenant_id)))
  with check (private.has_capability('campaign:manage', 'school', tenant_id)
              or (approver_id = (select auth.uid()) and private.has_capability('campaign:review', 'school', tenant_id)));

drop policy if exists "campaign staff read links" on public.gtm_campaign_links;
create policy "campaign staff read links" on public.gtm_campaign_links
  for select to authenticated
  using (private.has_capability('campaign:manage', 'school', tenant_id)
         or private.has_capability('campaign:review', 'school', tenant_id)
         or private.has_capability('campaign:report', 'school', tenant_id));
drop policy if exists "campaign managers add links to drafts" on public.gtm_campaign_links;
create policy "campaign managers add links to drafts" on public.gtm_campaign_links
  for insert to authenticated
  with check (private.has_capability('campaign:manage', 'school', tenant_id)
              and exists (select 1 from public.gtm_campaigns c
                           where c.id = campaign_id and c.tenant_id = gtm_campaign_links.tenant_id and c.status = 'draft'));
drop policy if exists "campaign managers remove links from drafts" on public.gtm_campaign_links;
create policy "campaign managers remove links from drafts" on public.gtm_campaign_links
  for delete to authenticated
  using (private.has_capability('campaign:manage', 'school', tenant_id)
         and exists (select 1 from public.gtm_campaigns c
                      where c.id = campaign_id and c.tenant_id = gtm_campaign_links.tenant_id and c.status = 'draft'));

drop policy if exists "campaign staff read reviews" on public.gtm_campaign_reviews;
create policy "campaign staff read reviews" on public.gtm_campaign_reviews
  for select to authenticated
  using (private.has_capability('campaign:manage', 'school', tenant_id)
         or private.has_capability('campaign:review', 'school', tenant_id));
drop policy if exists "reviewers record their own reviews" on public.gtm_campaign_reviews;
create policy "reviewers record their own reviews" on public.gtm_campaign_reviews
  for insert to authenticated
  with check (private.has_capability('campaign:review', 'school', tenant_id) and reviewer_id = (select auth.uid()));

drop policy if exists "configurers read who read campaign results" on public.gtm_report_access;
create policy "configurers read who read campaign results" on public.gtm_report_access
  for select to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id)
         or private.has_capability('audit:read', 'school', tenant_id));

-- Sponsorship: the school's configurers set the policy; reviewers approve.
drop policy if exists "sponsor staff read the policy" on public.gtm_sponsor_policy;
create policy "sponsor staff read the policy" on public.gtm_sponsor_policy
  for select to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id)
         or private.has_capability('sponsor:review', 'school', tenant_id));
drop policy if exists "configurers write the policy" on public.gtm_sponsor_policy;
create policy "configurers write the policy" on public.gtm_sponsor_policy
  for insert to authenticated
  with check (private.has_capability('tenant:configure', 'school', tenant_id));
drop policy if exists "configurers change the policy" on public.gtm_sponsor_policy;
create policy "configurers change the policy" on public.gtm_sponsor_policy
  for update to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id))
  with check (private.has_capability('tenant:configure', 'school', tenant_id));

drop policy if exists "sponsor staff read placements" on public.gtm_sponsor_placements;
create policy "sponsor staff read placements" on public.gtm_sponsor_placements
  for select to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id)
         or private.has_capability('sponsor:review', 'school', tenant_id));
drop policy if exists "configurers draft placements" on public.gtm_sponsor_placements;
create policy "configurers draft placements" on public.gtm_sponsor_placements
  for insert to authenticated
  with check (private.has_capability('tenant:configure', 'school', tenant_id) and created_by = (select auth.uid()));
drop policy if exists "sponsor staff change placements" on public.gtm_sponsor_placements;
create policy "sponsor staff change placements" on public.gtm_sponsor_placements
  for update to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id)
         or private.has_capability('sponsor:review', 'school', tenant_id))
  with check (private.has_capability('tenant:configure', 'school', tenant_id)
              or private.has_capability('sponsor:review', 'school', tenant_id));

-- Pipeline: Semester's sales write; a customer school's configurers read their
-- own account's committee, decision log and pilots (the procurement room).
create or replace function private.gtm_account_visible(want_account uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_capability('account:manage', 'platform', '')
      or exists (select 1 from public.gtm_accounts a
                  where a.id = want_account and a.tenant_id is not null
                    and private.has_capability('tenant:configure', 'school', a.tenant_id));
$$;
revoke all on function private.gtm_account_visible(uuid) from public, anon;
grant execute on function private.gtm_account_visible(uuid) to authenticated;

create or replace function private.gtm_pilot_account(want_pilot uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select account_id from public.gtm_pilots where id = want_pilot;
$$;
revoke all on function private.gtm_pilot_account(uuid) from public, anon;
grant execute on function private.gtm_pilot_account(uuid) to authenticated;

drop policy if exists "pipeline readers read accounts" on public.gtm_accounts;
create policy "pipeline readers read accounts" on public.gtm_accounts
  for select to authenticated using (private.gtm_account_visible(id));
drop policy if exists "sales write accounts" on public.gtm_accounts;
create policy "sales write accounts" on public.gtm_accounts
  for insert to authenticated with check (private.has_capability('account:manage', 'platform', ''));
drop policy if exists "sales change accounts" on public.gtm_accounts;
create policy "sales change accounts" on public.gtm_accounts
  for update to authenticated
  using (private.has_capability('account:manage', 'platform', ''))
  with check (private.has_capability('account:manage', 'platform', ''));

drop policy if exists "pipeline readers read stakeholders" on public.gtm_stakeholders;
create policy "pipeline readers read stakeholders" on public.gtm_stakeholders
  for select to authenticated using (private.gtm_account_visible(account_id));
drop policy if exists "sales write stakeholders" on public.gtm_stakeholders;
create policy "sales write stakeholders" on public.gtm_stakeholders
  for all to authenticated
  using (private.has_capability('account:manage', 'platform', ''))
  with check (private.has_capability('account:manage', 'platform', ''));

drop policy if exists "pipeline readers read the decision log" on public.gtm_decision_log;
create policy "pipeline readers read the decision log" on public.gtm_decision_log
  for select to authenticated using (private.gtm_account_visible(account_id));
drop policy if exists "sales write the decision log" on public.gtm_decision_log;
create policy "sales write the decision log" on public.gtm_decision_log
  for insert to authenticated with check (private.has_capability('account:manage', 'platform', ''));
drop policy if exists "sales change the decision log" on public.gtm_decision_log;
create policy "sales change the decision log" on public.gtm_decision_log
  for update to authenticated
  using (private.has_capability('account:manage', 'platform', ''))
  with check (private.has_capability('account:manage', 'platform', ''));

drop policy if exists "pipeline readers read pilots" on public.gtm_pilots;
create policy "pipeline readers read pilots" on public.gtm_pilots
  for select to authenticated using (private.gtm_account_visible(account_id));
drop policy if exists "sales write pilots" on public.gtm_pilots;
create policy "sales write pilots" on public.gtm_pilots
  for insert to authenticated with check (private.has_capability('account:manage', 'platform', ''));
drop policy if exists "sales change pilots" on public.gtm_pilots;
create policy "sales change pilots" on public.gtm_pilots
  for update to authenticated
  using (private.has_capability('account:manage', 'platform', ''))
  with check (private.has_capability('account:manage', 'platform', ''));

drop policy if exists "pipeline readers read pilot metrics" on public.gtm_pilot_metrics;
create policy "pipeline readers read pilot metrics" on public.gtm_pilot_metrics
  for select to authenticated using (private.gtm_account_visible(private.gtm_pilot_account(pilot_id)));
drop policy if exists "sales write pilot metrics" on public.gtm_pilot_metrics;
create policy "sales write pilot metrics" on public.gtm_pilot_metrics
  for all to authenticated
  using (private.has_capability('account:manage', 'platform', ''))
  with check (private.has_capability('account:manage', 'platform', ''));

drop policy if exists "pipeline readers read pilot outcomes" on public.gtm_pilot_outcomes;
create policy "pipeline readers read pilot outcomes" on public.gtm_pilot_outcomes
  for select to authenticated using (private.gtm_account_visible(private.gtm_pilot_account(pilot_id)));
drop policy if exists "sales record pilot outcomes" on public.gtm_pilot_outcomes;
create policy "sales record pilot outcomes" on public.gtm_pilot_outcomes
  for insert to authenticated with check (private.has_capability('account:manage', 'platform', ''));

-- ── 9. Audit, through the table that already exists ──────────────────────

alter table public.tenant_policy_audit_event
  drop constraint if exists tenant_policy_audit_event_entity_type_check;
alter table public.tenant_policy_audit_event
  add constraint tenant_policy_audit_event_entity_type_check check (entity_type in (
    'tenant_feature_policy', 'ai_policy', 'approved_source', 'consent_record',
    'feature_kill_switch', 'data_classification_rules', 'integration_connections',
    'integration_scopes', 'integration_mappings', 'integration_dead_letter_events',
    'governance_policy_nodes', 'governance_steward_assignments', 'governance_config_requests',
    'gtm_campaigns', 'gtm_campaign_reviews', 'gtm_sponsor_policy', 'gtm_sponsor_placements'
  ));

create or replace function private.audit_gtm_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  before_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_row  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_data   jsonb := coalesce(after_row, before_row);
  event_tenant text := row_data ->> 'tenant_id';
  caller uuid := auth.uid();
  grant_id uuid;
begin
  -- Account deletion clearing a person reference is not a change anyone made
  -- to the campaign, and its caller is often the account being deleted, which
  -- an audit row could not name. The deletion is its own record.
  if tg_op = 'UPDATE' and before_row <> after_row
     and private.gtm_only_cleared(before_row, after_row, array['owner_id', 'approver_id', 'reviewer_id', 'created_by', 'approved_by']) then
    return new;
  end if;

  select g.id into grant_id
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role
   where g.subject = caller
     and g.scope_kind = 'school'
     and g.scope_id = event_tenant
     and rc.capability in ('campaign:manage', 'campaign:review', 'sponsor:review', 'tenant:configure')
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
   order by g.granted_at desc
   limit 1;

  insert into public.tenant_policy_audit_event
    (tenant_id, entity_type, entity_id, action, old_data, new_data, actor_id, actor_grant_id)
  values
    (event_tenant, tg_table_name, coalesce(row_data ->> 'id', event_tenant), lower(tg_op),
     before_row, after_row, caller, grant_id);
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.audit_gtm_change() from public, anon, authenticated;

drop trigger if exists audit_gtm_campaigns on public.gtm_campaigns;
create trigger audit_gtm_campaigns after insert or update or delete on public.gtm_campaigns
  for each row execute function private.audit_gtm_change();
drop trigger if exists audit_gtm_campaign_reviews on public.gtm_campaign_reviews;
create trigger audit_gtm_campaign_reviews after insert on public.gtm_campaign_reviews
  for each row execute function private.audit_gtm_change();
drop trigger if exists audit_gtm_sponsor_policy on public.gtm_sponsor_policy;
create trigger audit_gtm_sponsor_policy after insert or update or delete on public.gtm_sponsor_policy
  for each row execute function private.audit_gtm_change();
drop trigger if exists audit_gtm_sponsor_placements on public.gtm_sponsor_placements;
create trigger audit_gtm_sponsor_placements after insert or update or delete on public.gtm_sponsor_placements
  for each row execute function private.audit_gtm_change();

-- ── 10. Descriptions ──────────────────────────────────────────────────────

comment on table public.gtm_prospects is
  'A recruitment contact, referenced in the school''s CRM. Only declared or public fields; no column for grades, aid, health, conduct or protected traits exists. Workers only.';
comment on table public.gtm_consent is
  'Append-only channel and topic consent for recruitment contacts. The latest row is read at every send decision.';
comment on table public.gtm_campaigns is
  'A school''s campaign (GTM plan §8.2). Born draft; content changes only in draft; active only through the §13.3 release gate.';
comment on table public.gtm_campaign_reviews is
  'Privacy, accessibility and brand reviews. Append-only; only reviews after the last content change count; never by the owner.';
comment on table public.gtm_communication_events is
  'Every send decision and delivery event. An allowed decision is refused unless consent, suppression, quiet hours and the cap all pass. Workers only.';
comment on table public.gtm_conversion_events is
  'Funnel-stage conversions with their attribution. Workers only; staff read suppressed counts through gtm_campaign_report.';
comment on table public.gtm_report_access is
  'Who read which campaign''s results, and when.';
comment on table public.gtm_sponsor_policy is
  'A school''s sponsorship switch, approved categories, surfaces and segments. Off by default; protected surfaces cannot be listed.';
comment on table public.gtm_sponsor_placements is
  'A labelled sponsor placement. Live only on the school''s policy, with the module on, approved by a reviewer who did not write it.';
comment on table public.gtm_accounts is
  'Semester''s institutional pipeline. A customer school''s configurers read their own account.';
comment on table public.gtm_decision_log is
  'Buying-committee questions, owners, evidence and dates (GTM plan §5.3). An approval needs evidence and a resolution date.';
comment on table public.gtm_pilots is
  'A scoped pilot. Active only when the §6.2 elements are present; decided only by a signed outcome.';
comment on table public.gtm_pilot_outcomes is
  'The signed pilot decision. Convert or expand is refused while a high-severity issue is open.';
