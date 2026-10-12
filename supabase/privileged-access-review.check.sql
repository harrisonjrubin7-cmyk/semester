-- Privileged role-grant review. LOCAL/DISPOSABLE DATABASE ONLY.
begin;

create or replace function pg_temp.become(who uuid, with_mfa boolean default true)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', who::text,
    'role', 'authenticated', 'aal', case when with_mfa then 'aal2' else 'aal1' end,
    'amr', case when with_mfa then jsonb_build_array(jsonb_build_object(
      'method', 'totp', 'timestamp', extract(epoch from now()))) else '[]'::jsonb end)::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.refused(who uuid, statement text, with_mfa boolean default true)
returns boolean language plpgsql as $$
begin perform pg_temp.become(who, with_mfa); execute statement; execute 'reset role'; return false;
exception when others then execute 'reset role'; return true; end $$;

create or replace function pg_temp.must(label text, ok boolean)
returns void language plpgsql as $$ begin if ok is not true then raise exception 'FAILED: %', label; end if; raise notice 'ok  %', label; end $$;

do $$
declare
  starter uuid := gen_random_uuid(); reviewer uuid := gen_random_uuid(); signer uuid := gen_random_uuid();
  target uuid := gen_random_uuid(); investigate_subject uuid := gen_random_uuid(); steward uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  review_ref text; retry_ref text; started_hash text; trust_items text[]; starter_item text; signer_item text;
  reviewer_item text; target_item text; investigate_item text; steward_item text; signer_granted_at timestamptz;
  steward_capabilities text[];
  table_owner text; mutation_error text;
  n bigint; retained_n bigint; revoked_n bigint; investigating_n bigint; remediated_n bigint;
  unsigned_n bigint; bad_hash_n bigint;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (starter, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'starter@review.example', now(), now(), now()),
    (reviewer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reviewer@review.example', now(), now(), now()),
    (signer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'signer@review.example', now(), now(), now()),
    (target, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'target@review.example', now(), now(), now()),
    (investigate_subject, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'investigate@review.example', now(), now(), now()),
    (steward, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'steward@review.example', now(), now(), now()),
    (outsider, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outside@review.example', now(), now(), now());
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (starter, 'trust_officer', 'platform', '', 'platform'),
    (reviewer, 'platform_admin', 'platform', '', 'platform'),
    (signer, 'trust_officer', 'platform', '', 'platform'),
    (target, 'university_admin', 'platform', '', 'platform'),
    (investigate_subject, 'integration_admin', 'platform', '', 'platform'),
    (steward, 'data_steward', 'platform', '', 'platform');

  perform pg_temp.must('an unprivileged account cannot start a review', pg_temp.refused(outsider,
    $q$select public.begin_privileged_access_review('access-review-outsider',current_date-90,current_date,current_date+90)$q$));
  perform pg_temp.must('fresh MFA is required', pg_temp.refused(signer,
    $q$select public.begin_privileged_access_review('access-review-no-mfa',current_date-90,current_date,current_date+90)$q$, false));
  perform pg_temp.must('a non-quarterly next date is refused', pg_temp.refused(starter,
    $q$select public.begin_privileged_access_review('access-review-too-late',current_date-90,current_date,current_date+400)$q$));
  perform pg_temp.must('client roles cannot read private review rows', pg_temp.refused(starter,
    'select count(*) from private.privileged_access_review'));
  perform pg_temp.must('decision writes serialize with signoff', position(
    'pg_advisory_xact_lock' in pg_get_functiondef(
      'public.decide_privileged_access_review_item(text,text,text)'::regprocedure)) > 0);
  perform pg_temp.must('investigation resolutions serialize with signoff', position(
    'pg_advisory_xact_lock' in pg_get_functiondef(
      'public.resolve_privileged_access_review_investigation(text,text)'::regprocedure)) > 0);
  perform pg_temp.must('upgraded decision rows have the remediation default', coalesce((
    select column_default ilike '%false%'
      from information_schema.columns
     where table_schema = 'private' and table_name = 'privileged_access_review_decision'
       and column_name = 'remediation_applied'), false));

  perform pg_temp.become(starter);
  review_ref := public.begin_privileged_access_review('access-review-2026q4', current_date - 90, current_date, current_date + 90);
  retry_ref := public.begin_privileged_access_review('access-review-2026q4', current_date - 90, current_date, current_date + 90);
  select max(started_by_sha256), array_agg(item_ref order by item_ref) filter (where role = 'trust_officer'),
         max(item_ref) filter (where role = 'platform_admin'),
         max(item_ref) filter (where role = 'university_admin'),
         max(item_ref) filter (where role = 'integration_admin'),
         count(*) filter (where subject_sha256 !~ '^[0-9a-f]{64}$')
    into started_hash, trust_items, reviewer_item, target_item, investigate_item, bad_hash_n
    from public.privileged_access_review_evidence(review_ref);
  select item_ref, capabilities into steward_item, steward_capabilities
    from public.privileged_access_review_evidence(review_ref) where role = 'data_steward';
  select item_ref into starter_item from public.privileged_access_review_evidence(review_ref)
   where role = 'trust_officer' and subject_sha256 = started_hash;
  select item_ref, granted_at into signer_item, signer_granted_at from public.privileged_access_review_evidence(review_ref)
   where role = 'trust_officer' and subject_sha256 <> started_hash;
  reset role;
  perform pg_temp.must('an idempotent retry returns the same review', retry_ref = review_ref);
  perform pg_temp.must('the open-review bound refuses another request key', pg_temp.refused(starter,
    $q$select public.begin_privileged_access_review('access-review-another',current_date-90,current_date,current_date+90)$q$));
  perform pg_temp.must('the public ledger exposes all pseudonymous snapshot items',
    cardinality(trust_items) = 2 and starter_item is not null and signer_item is not null
      and reviewer_item is not null and target_item is not null and investigate_item is not null
      and steward_item is not null and bad_hash_n = 0);
  perform pg_temp.must('capability-bearing roles are discovered and their exact authority is preserved',
    'data_request:handle' = any(steward_capabilities));

  perform pg_temp.must('a starter still cannot decide their own grant', pg_temp.refused(starter, format(
    'select public.decide_privileged_access_review_item(%L,%L,%L)', starter_item, 'retain', 'still-required')));
  perform pg_temp.must('a reviewer cannot decide their own grant', pg_temp.refused(reviewer, format(
    'select public.decide_privileged_access_review_item(%L,%L,%L)', reviewer_item, 'retain', 'still-required')));
  perform pg_temp.must('reason codes come from the controlled vocabulary', pg_temp.refused(starter, format(
    'select public.decide_privileged_access_review_item(%L,%L,%L)', target_item, 'retain', 'person-name')));
  perform pg_temp.must('a controlled reason still has to match its decision', pg_temp.refused(starter, format(
    'select public.decide_privileged_access_review_item(%L,%L,%L)', target_item, 'retain', 'unauthorized')));

  update public.role_grants set granted_at = clock_timestamp() where subject = signer and role = 'trust_officer';
  perform pg_temp.must('a reissued grant cannot be decided from a stale snapshot', pg_temp.refused(starter, format(
    'select public.decide_privileged_access_review_item(%L,%L,%L)', signer_item, 'retain', 'still-required')));
  update public.role_grants set granted_at = signer_granted_at where subject = signer and role = 'trust_officer';
  insert into public.role_capabilities (role, capability) values ('data_steward', 'report:read');
  perform pg_temp.must('a capability change makes the snapshot stale for retain', pg_temp.refused(starter, format(
    'select public.decide_privileged_access_review_item(%L,%L,%L)', steward_item, 'retain', 'still-required')));
  update public.role_grants set subject = outsider
   where subject = investigate_subject and role = 'integration_admin';
  perform pg_temp.must('a changed grant subject cannot be retained under the old subject evidence',
    pg_temp.refused(starter, format(
      'select public.decide_privileged_access_review_item(%L,%L,%L)', investigate_item, 'retain', 'still-required')));

  perform pg_temp.become(starter);
  perform public.decide_privileged_access_review_item(reviewer_item, 'retain', 'still-required');
  reset role;
  perform pg_temp.become(reviewer);
  perform public.decide_privileged_access_review_item(starter_item, 'retain', 'still-required');
  perform public.decide_privileged_access_review_item(signer_item, 'retain', 'still-required');
  perform public.decide_privileged_access_review_item(target_item, 'revoke', 'access-ended');
  perform public.decide_privileged_access_review_item(investigate_item, 'investigate', 'mfa-not-current');
  perform public.decide_privileged_access_review_item(steward_item, 'investigate', 'activity-review');
  reset role;
  perform pg_temp.must('signoff waits for investigation closure', pg_temp.refused(signer,
    format('select public.complete_privileged_access_review(%L)', review_ref)));

  perform pg_temp.must('the reviewed revoke atomically closed the live role grant',
    (select revoked_at is not null from public.role_grants where subject = target and role = 'university_admin'));
  delete from auth.users where id = target;
  perform pg_temp.must('account deletion may remove an already-remediated grant',
    not exists (select 1 from public.role_grants where subject = target and role = 'university_admin'));
  perform pg_temp.become(starter);
  perform public.resolve_privileged_access_review_investigation(investigate_item, 'remediated');
  perform public.resolve_privileged_access_review_investigation(steward_item, 'remediated');
  reset role;
  perform pg_temp.must('a starter cannot sign the review', pg_temp.refused(starter, format(
    'select public.complete_privileged_access_review(%L)', review_ref)));
  perform pg_temp.must('an item reviewer cannot sign the review', pg_temp.refused(reviewer, format(
    'select public.complete_privileged_access_review(%L)', review_ref)));
  update public.role_grants set granted_at = clock_timestamp()
   where subject = signer and role = 'trust_officer';
  perform pg_temp.must('signoff detects a retained grant changed after its decision', pg_temp.refused(signer,
    format('select public.complete_privileged_access_review(%L)', review_ref)));
  perform pg_temp.must('the retain decision maker cannot resolve its later change', pg_temp.refused(reviewer,
    format('select public.resolve_privileged_access_review_post_decision_change(%L)', signer_item)));
  perform pg_temp.become(starter);
  perform public.resolve_privileged_access_review_post_decision_change(signer_item);
  reset role;
  update public.role_grants set granted_at = granted_at + interval '1 second'
   where subject = signer and role = 'trust_officer';
  perform pg_temp.must('a second grant change invalidates the first resolution fingerprint', pg_temp.refused(signer,
    format('select public.complete_privileged_access_review(%L)', review_ref)));
  perform pg_temp.become(starter);
  perform public.resolve_privileged_access_review_post_decision_change(signer_item);
  reset role;
  perform pg_temp.become(signer);
  perform public.complete_privileged_access_review(review_ref);
  select count(*), count(*) filter (where decision = 'retain'),
         count(*) filter (where decision = 'revoke'), count(*) filter (where decision = 'investigate'),
         count(*) filter (where remediation_applied),
         count(*) filter (where signed_at is null)
    into n, retained_n, revoked_n, investigating_n, remediated_n, unsigned_n
    from public.privileged_access_review_evidence(review_ref);
  reset role;
  perform pg_temp.must('the signed ledger returns every snapshot item', n = 6);
  perform pg_temp.must('the signed ledger preserves every decision and the signoff timestamp',
    retained_n = 3 and revoked_n = 1 and investigating_n = 2
      and remediated_n = 1 and unsigned_n = 0);
  select pg_get_userbyid(c.relowner) into table_owner from pg_class c
   where c.oid = 'private.privileged_access_review_decision'::regclass;
  begin
    execute format('set local role %I', table_owner);
    execute format('delete from private.privileged_access_review_decision where item_id=(select id from private.privileged_access_review_item where public_id=%L)', target_item);
    mutation_error := null;
  exception when others then mutation_error := sqlerrm;
  end;
  reset role;
  perform pg_temp.must('the table owner reaches the append-only trigger',
    mutation_error ilike '%Access review evidence is append-only%');
  select count(*) into n from pg_trigger
   where tgrelid = 'private.privileged_access_review_decision'::regclass
     and tgname = 'keep_privileged_access_review_decision_immutable' and not tgisinternal;
  perform pg_temp.must('the decision ledger has its append-only trigger', n = 1);
end $$;

rollback;
