-- Who may read the approval and break-glass records — beyond their own.
--
-- `console:operate` opens the console shell and is held by six roles. Until
-- 20261006110000 it was also the only thing the four policies below asked, so
-- a support agent, an implementer or a data steward could read every tenant's
-- approval requests (the evidence text and detail), decisions, executed-action
-- records and break-glass grants (ticket and scope). Reading the security
-- queue now takes console:operate AND a security capability: approval:decide,
-- breakglass:request or trust:publish. A requester, an approver, an actor and
-- a grant's subject keep reading their own rows, as before.
--
-- Three accounts hold both halves and must read everything — THE CONTROL: a
-- policy that let nobody in would pass every "is told nothing" case below.
--
--   platform_admin       approval:decide, breakglass:request
--   incident_responder   breakglass:request
--   trust_officer        trust:publish
--
-- Three hold console:operate alone and must read none of it:
--
--   support_agent, implementation_manager, data_steward
--
--   How to run it: supabase/check.sh console-security-reads

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  return who;
end $$;

-- What an account can read of the four tables, as four counts for the one
-- fixture tenant, so each case below is a single comparison.
create or replace function pg_temp.reads(who uuid)
returns text language plpgsql as $$
declare a bigint; d bigint; r bigint; g bigint;
begin
  perform pg_temp.become(who);
  select count(*) into a from public.approval_request where tenant_id = 'sr-check';
  select count(*) into d from public.approval_decision
   where request_id in (select id from public.approval_request where tenant_id = 'sr-check')
      or approver = who;
  select count(*) into r from public.console_action_record where tenant_id = 'sr-check';
  select count(*) into g from public.break_glass_grant where tenant_id = 'sr-check';
  return format('%s/%s/%s/%s', a, d, r, g);
end $$;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

do $$
declare
  admin uuid; responder uuid; trusty uuid;
  agent uuid; impl uuid; steward uuid;
  requester uuid; stranger uuid;
  req uuid; n bigint;
begin
  admin     := pg_temp.newuser('sr-admin@example.com');
  responder := pg_temp.newuser('sr-responder@example.com');
  trusty    := pg_temp.newuser('sr-trust@example.com');
  agent     := pg_temp.newuser('sr-agent@example.com');
  impl      := pg_temp.newuser('sr-impl@example.com');
  steward   := pg_temp.newuser('sr-steward@example.com');
  requester := pg_temp.newuser('sr-requester@example.com');
  stranger  := pg_temp.newuser('sr-stranger@example.com');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (admin,     'platform_admin',         'platform', '', 'platform'),
    (responder, 'incident_responder',     'platform', '', 'platform'),
    (trusty,    'trust_officer',          'platform', '', 'platform'),
    (agent,     'support_agent',          'platform', '', 'platform'),
    (impl,      'implementation_manager', 'platform', '', 'platform'),
    (steward,   'data_steward',           'platform', '', 'platform');

  insert into public.schools (id, name, email_domains, is_demo)
  values ('sr-check', 'Security reads fixture', array['sr-check.example'], false);

  insert into public.approval_request (duty_id, requester, tenant_id, evidence, ticket)
  values ('role-grant', requester, 'sr-check', 'fixture evidence', 'SR-1')
  returning id into req;
  -- One decision, by the implementer: an approver reads their own decision.
  insert into public.approval_decision (request_id, approver, decision, as_party)
  values (req, impl, 'approve', 'role:implementation_manager');
  insert into public.console_action_record (request_id, duty_id, actor, tenant_id, target)
  values (req, 'role-grant', requester, 'sr-check', 'fixture');
  insert into public.break_glass_grant (request_id, subject, tenant_id, ticket, scope, expires_at, review_due)
  values (req, requester, 'sr-check', 'SR-1', 'tenant:configure',
          now() + interval '2 hours', now() + interval '1 day');
  -- A second grant, on a second tenant, that lapsed three days ago and whose
  -- review fell due yesterday and never happened: written as operations would,
  -- not through the function. Its own tenant keeps the counts above unchanged.
  insert into public.schools (id, name, email_domains, is_demo)
  values ('sr-check-2', 'Security reads fixture, lapsed', array['sr-check-2.example'], false);
  insert into public.break_glass_grant (request_id, subject, tenant_id, ticket, scope, opened_at, expires_at, review_due)
  values (req, requester, 'sr-check-2', 'SR-2', 'tenant:configure',
          now() - interval '3 days', now() - interval '3 days' + interval '2 hours', now() - interval '1 day');

  -- format: requests / decisions / action records / break-glass grants
  -- ── The control: the three that hold console:operate and a security capability
  perform pg_temp.said('platform_admin reads all four — THE CONTROL', pg_temp.reads(admin), '1/1/1/1');
  perform pg_temp.said('incident_responder reads all four', pg_temp.reads(responder), '1/1/1/1');
  perform pg_temp.said('trust_officer reads all four', pg_temp.reads(trusty), '1/1/1/1');

  -- ── console:operate alone is not enough
  perform pg_temp.said('support_agent reads none of them', pg_temp.reads(agent), '0/0/0/0');
  perform pg_temp.said('data_steward reads none of them', pg_temp.reads(steward), '0/0/0/0');
  -- The implementer is not an operator of this queue, but a decision they
  -- made is theirs to read.
  perform pg_temp.said('implementation_manager reads only the decision they made', pg_temp.reads(impl), '0/1/0/0');

  -- ── Their own rows still read
  perform pg_temp.said('a requester reads their request, its decision, their action record and their grant',
                       pg_temp.reads(requester), '1/1/1/1');
  perform pg_temp.said('an account with no part in it reads nothing', pg_temp.reads(stranger), '0/0/0/0');

  -- ── The INVOKER readers follow the tables
  perform pg_temp.become(admin);
  select count(*) into n from public.console_approvals() where tenant_id = 'sr-check';
  perform pg_temp.counted('console_approvals returns the request to platform_admin', n, 1);
  select count(*) into n from public.console_break_glass() where tenant_id = 'sr-check';
  perform pg_temp.counted('console_break_glass returns the grant to platform_admin', n, 1);

  -- T-04: the log says which grants are live and which reviews are overdue.
  select count(*) into n from public.console_break_glass()
   where tenant_id = 'sr-check' and active and not review_overdue;
  perform pg_temp.counted('the open grant reads as active, its review not overdue — THE CONTROL for the next case', n, 1);
  select count(*) into n from public.console_break_glass()
   where tenant_id = 'sr-check-2' and not active and review_overdue;
  perform pg_temp.counted('the lapsed grant reads as not active, with its overdue review surfaced — T-04', n, 1);

  perform pg_temp.become(agent);
  select count(*) into n from public.console_approvals() where tenant_id = 'sr-check';
  perform pg_temp.counted('console_approvals returns nothing to support_agent', n, 0);
  select count(*) into n from public.console_break_glass() where tenant_id = 'sr-check';
  perform pg_temp.counted('console_break_glass returns nothing to support_agent', n, 0);
end $$;

rollback;
