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
  target uuid := gen_random_uuid(); investigate_subject uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  review_ref text; trust_items text[]; reviewer_item text; target_item text; investigate_item text;
  n bigint; retained_n bigint; revoked_n bigint; investigating_n bigint; unsigned_n bigint; bad_hash_n bigint;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (starter, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'starter@review.example', now(), now(), now()),
    (reviewer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reviewer@review.example', now(), now(), now()),
    (signer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'signer@review.example', now(), now(), now()),
    (target, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'target@review.example', now(), now(), now()),
    (investigate_subject, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'investigate@review.example', now(), now(), now()),
    (outsider, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outside@review.example', now(), now(), now());
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (starter, 'trust_officer', 'platform', '', 'platform'),
    (reviewer, 'platform_admin', 'platform', '', 'platform'),
    (signer, 'trust_officer', 'platform', '', 'platform'),
    (target, 'university_admin', 'platform', '', 'platform'),
    (investigate_subject, 'integration_admin', 'platform', '', 'platform');

  perform pg_temp.must('an unprivileged account cannot start a review', pg_temp.refused(outsider,
    'select public.begin_privileged_access_review(current_date-90,current_date,current_date+90)'));
  perform pg_temp.must('fresh MFA is required', pg_temp.refused(signer,
    'select public.begin_privileged_access_review(current_date-90,current_date,current_date+90)', false));
  perform pg_temp.must('client roles cannot read private review rows', pg_temp.refused(starter,
    'select count(*) from private.privileged_access_review'));

  perform pg_temp.become(starter);
  review_ref := public.begin_privileged_access_review(current_date - 90, current_date, current_date + 90);
  select array_agg(item_ref order by item_ref) filter (where role = 'trust_officer'),
         max(item_ref) filter (where role = 'platform_admin'),
         max(item_ref) filter (where role = 'university_admin'),
         max(item_ref) filter (where role = 'integration_admin'),
         count(*) filter (where subject_sha256 !~ '^[0-9a-f]{64}$')
    into trust_items, reviewer_item, target_item, investigate_item, bad_hash_n
    from public.privileged_access_review(review_ref);
  reset role;
  perform pg_temp.must('the public ledger exposes all pseudonymous snapshot items',
    cardinality(trust_items) = 2 and reviewer_item is not null and target_item is not null
      and investigate_item is not null and bad_hash_n = 0);

  perform pg_temp.must('the starter cannot decide snapshot items', pg_temp.refused(starter, format(
    'select public.decide_privileged_access_review_item(%L,%L,%L)', target_item, 'retain', 'still-required')));
  perform pg_temp.must('a reviewer cannot decide their own grant', pg_temp.refused(reviewer, format(
    'select public.decide_privileged_access_review_item(%L,%L,%L)', reviewer_item, 'retain', 'still-required')));

  perform pg_temp.become(reviewer);
  perform public.decide_privileged_access_review_item(trust_items[1], 'retain', 'still-required');
  perform public.decide_privileged_access_review_item(trust_items[2], 'retain', 'still-required');
  perform public.decide_privileged_access_review_item(target_item, 'revoke', 'access-ended');
  perform public.decide_privileged_access_review_item(investigate_item, 'investigate', 'mfa-not-current');
  reset role;
  perform pg_temp.become(signer);
  perform public.decide_privileged_access_review_item(reviewer_item, 'retain', 'still-required');
  reset role;
  perform pg_temp.become(target);
  perform pg_temp.must('revoke decisions close the live role grant',
    (select revoked_at is not null from public.role_grants where subject = target and role = 'university_admin'));
  reset role;
  perform pg_temp.must('a review cannot be signed by its starter', pg_temp.refused(starter, format(
    'select public.complete_privileged_access_review(%L)', review_ref)));
  perform pg_temp.become(reviewer);
  perform public.complete_privileged_access_review(review_ref);
  select count(*), count(*) filter (where decision = 'retain'),
         count(*) filter (where decision = 'revoke'), count(*) filter (where decision = 'investigate'),
         count(*) filter (where signed_at is null)
    into n, retained_n, revoked_n, investigating_n, unsigned_n
    from public.privileged_access_review(review_ref);
  reset role;
  perform pg_temp.must('the signed ledger returns every snapshot item', n = 5);
  perform pg_temp.must('the signed ledger preserves every decision and the signoff timestamp',
    retained_n = 3 and revoked_n = 1 and investigating_n = 1 and unsigned_n = 0);
  perform pg_temp.must('review decisions cannot be rewritten', pg_temp.refused(reviewer, format(
    'delete from private.privileged_access_review_decision where item_id=(select id from private.privileged_access_review_item where public_id=%L)', target_item)));
  select count(*) into n from pg_trigger
   where tgrelid = 'private.privileged_access_review_decision'::regclass
     and tgname = 'keep_privileged_access_review_decision_immutable' and not tgisinternal;
  perform pg_temp.must('the decision ledger has its append-only trigger', n = 1);
end $$;

rollback;
