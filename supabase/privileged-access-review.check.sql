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
  target uuid := gen_random_uuid(); outsider uuid := gen_random_uuid(); no_mfa uuid := gen_random_uuid();
  review_ref text; starter_item text; reviewer_item text; signer_item text; target_item text; n bigint;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (starter, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'starter@review.example', now(), now(), now()),
    (reviewer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reviewer@review.example', now(), now(), now()),
    (signer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'signer@review.example', now(), now(), now()),
    (target, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'target@review.example', now(), now(), now()),
    (outsider, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outside@review.example', now(), now(), now()),
    (no_mfa, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nomfa@review.example', now(), now(), now());
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (starter, 'trust_officer', 'platform', '', 'platform'),
    (reviewer, 'trust_officer', 'platform', '', 'platform'),
    (signer, 'platform_admin', 'platform', '', 'platform'),
    (target, 'platform_admin', 'platform', '', 'platform'),
    (no_mfa, 'trust_officer', 'platform', '', 'platform');

  perform pg_temp.must('an unprivileged account cannot start a review', pg_temp.refused(outsider,
    'select public.begin_privileged_access_review(current_date-90,current_date,current_date+90)'));
  perform pg_temp.must('fresh MFA is required', pg_temp.refused(no_mfa,
    'select public.begin_privileged_access_review(current_date-90,current_date,current_date+90)', false));
  perform pg_temp.must('client roles cannot read private review rows', pg_temp.refused(starter,
    'select count(*) from private.privileged_access_review'));

  perform pg_temp.become(starter);
  review_ref := public.begin_privileged_access_review(current_date - 90, current_date, current_date + 90);
  set local role postgres;
  select i.public_id into starter_item from private.privileged_access_review_item i
    where i.review_id = (select id from private.privileged_access_review where public_id = review_ref)
      and i.grant_id = (select id from public.role_grants where subject = starter and role = 'trust_officer');
  select i.public_id into reviewer_item from private.privileged_access_review_item i
    where i.review_id = (select id from private.privileged_access_review where public_id = review_ref)
      and i.grant_id = (select id from public.role_grants where subject = reviewer and role = 'trust_officer');
  select i.public_id into signer_item from private.privileged_access_review_item i
    where i.review_id = (select id from private.privileged_access_review where public_id = review_ref)
      and i.grant_id = (select id from public.role_grants where subject = signer and role = 'platform_admin');
  select i.public_id into target_item from private.privileged_access_review_item i
    where i.review_id = (select id from private.privileged_access_review where public_id = review_ref)
      and i.grant_id = (select id from public.role_grants where subject = target and role = 'platform_admin');

  perform pg_temp.must('the starter cannot decide snapshot items', pg_temp.refused(starter, format(
    'select public.decide_privileged_access_review_item(%L,%L,%L)', target_item, 'retain', 'still-required')));
  perform pg_temp.must('a reviewer cannot decide their own grant', pg_temp.refused(reviewer, format(
    'select public.decide_privileged_access_review_item(%L,%L,%L)', reviewer_item, 'retain', 'still-required')));

  perform pg_temp.become(reviewer);
  perform public.decide_privileged_access_review_item(starter_item, 'retain', 'still-required');
  perform public.decide_privileged_access_review_item(signer_item, 'retain', 'still-required');
  perform public.decide_privileged_access_review_item(target_item, 'revoke', 'access-ended');
  set local role postgres;
  perform pg_temp.become(signer);
  perform public.decide_privileged_access_review_item(reviewer_item, 'retain', 'still-required');
  perform public.decide_privileged_access_review_item(
    (select i.public_id from private.privileged_access_review_item i
      where i.review_id = (select id from private.privileged_access_review where public_id = review_ref)
        and i.grant_id = (select id from public.role_grants where subject = no_mfa and role = 'trust_officer')),
    'investigate', 'mfa-not-current');
  set local role postgres;
  perform pg_temp.must('revoke decisions close the live role grant',
    (select revoked_at is not null from public.role_grants where subject = target and role = 'platform_admin'));
  perform pg_temp.must('a review cannot be signed by its starter', pg_temp.refused(starter, format(
    'select public.complete_privileged_access_review(%L)', review_ref)));
  perform pg_temp.become(reviewer);
  perform public.complete_privileged_access_review(review_ref);
  select count(*) into n from public.privileged_access_review(review_ref);
  set local role postgres;
  perform pg_temp.must('the signed ledger returns every snapshot item', n = 5);
  perform pg_temp.must('the immutable signoff preserves counts including open investigation',
    (select retained = 3 and revoked = 1 and investigating = 1
       from private.privileged_access_review_signoff s
       join private.privileged_access_review r on r.id = s.review_id where r.public_id = review_ref));
  perform pg_temp.must('review actions reached the console audit chain',
    (select count(*) = 8 from private.console_audit_event where action like 'access_review.%'));
  perform pg_temp.must('review decisions cannot be rewritten', pg_temp.refused(reviewer, format(
    'delete from private.privileged_access_review_decision where item_id=(select id from private.privileged_access_review_item where public_id=%L)', target_item)));
end $$;

rollback;
