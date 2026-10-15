-- A rights request can now be answered, verified, and leaves a trail.
--
-- `data_subject_request` could be raised (`raise_my_data_subject_request`) and
-- never answered: `authenticated` has only select and insert, no function
-- updated a row, `verified_at` had no setter and nothing recorded who verified,
-- and a status change wrote no audit event (privacy findings C1, C2, C3). The
-- check `answer-rights-requests.check.sql` failed on all three before this file.
--
-- This is the mechanism and only the mechanism.
--
--   * Who may answer is an existing capability: `data_request:handle`, which the
--     `data_steward` role already carries (20260926150000), at platform scope,
--     checked with `private.has_capability`. No new role and no new capability.
--     WHO should hold it is counsel's and the owner's to name [COUNSEL REQUIRED,
--     privacy queue P-03]; this file grants it to nobody.
--   * The response clock is counsel's decision (P-03, [COUNSEL REQUIRED]). Nothing
--     here reads, sets or promises a response time, and the `due_at` default
--     is left exactly as it was.
--   * The operator is not the requester: a steward's own request cannot be
--     answered or verified by that steward.
--   * The legal moves are fixed here, and are about the mechanism, not the law:
--       received    -> verifying | refused
--       verifying   -> in_progress | refused
--       in_progress -> completed | refused
--     A resolved request does not move again. A request is not set in progress
--     before it has been verified. A refusal carries its reason.
--   * The answer text lives on the row (`resolution`, already there). It never
--     goes into an audit event: the trigger below records the kind and the two
--     statuses, or the kind and the rung, and nothing typed by a person.
--   * The trigger is on the table, so a change made in plain SQL by the service
--     role is recorded as well, not only one made through the functions.
--
-- `verified_rung` names which rung of 02-SUBJECT-RIGHTS-WORKFLOW §2 was used.
-- Which rung suffices for which requester is counsel's [COUNSEL REQUIRED, V3/V4];
-- the column records the choice and enforces none. `verified_by_sha256` is the
-- same SHA-256 pseudonym of the operator that the audit event carries, so a
-- case log can say who verified without the row holding an account id (that
-- would also have made the operator's erasure a question for `account_data_map`).
-- The subject can read their own row, and so can read this pseudonym.

alter table public.data_subject_request
  add column if not exists verified_rung text
    check (verified_rung is null or verified_rung in ('V0', 'V1', 'V2', 'V3', 'V4')),
  add column if not exists verified_by_sha256 text
    check (verified_by_sha256 is null or verified_by_sha256 ~ '^[0-9a-f]{64}$');

-- The table records what happened, whoever did it.
create or replace function private.audit_subject_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform private.record_audit(
      new.tenant_id,
      'privacy.request_status_changed',
      'data_subject_request',
      new.id::text,
      'allowed',
      null,
      jsonb_build_object('kind', new.kind, 'from', old.status, 'to', new.status)
    );
  end if;
  if old.verified_at is null and new.verified_at is not null then
    perform private.record_audit(
      new.tenant_id,
      'privacy.request_verified',
      'data_subject_request',
      new.id::text,
      'allowed',
      null,
      jsonb_build_object('kind', new.kind, 'rung', coalesce(new.verified_rung, 'unrecorded'))
    );
  end if;
  return new;
end $$;

revoke all on function private.audit_subject_request_change() from public, anon, authenticated;

create or replace trigger audit_subject_request_change
  after update on public.data_subject_request
  for each row execute function private.audit_subject_request_change();

-- Record that the requester's identity was checked, and on which rung.
create or replace function public.verify_data_subject_request(
  request_id uuid,
  rung text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  req public.data_subject_request%rowtype;
begin
  if me is null or not private.has_capability('data_request:handle') then
    raise exception 'Only a data steward can verify a rights request.' using errcode = '42501';
  end if;
  if rung is null or rung not in ('V0', 'V1', 'V2', 'V3', 'V4') then
    raise exception 'Name the verification rung, V0 to V4.' using errcode = '23514';
  end if;

  select * into req from public.data_subject_request r where r.id = request_id for update;
  if not found then
    raise exception 'No such request.' using errcode = 'P0002';
  end if;
  if req.subject = me then
    raise exception 'You cannot verify your own request.' using errcode = '42501';
  end if;
  if req.resolved_at is not null then
    raise exception 'This request is already resolved.' using errcode = '23514';
  end if;
  if req.verified_at is not null then
    raise exception 'This request is already verified.' using errcode = '23514';
  end if;

  update public.data_subject_request r
     set verified_at = pg_catalog.now(),
         verified_rung = rung,
         verified_by_sha256 = private.role_audit_sha256(me::text)
   where r.id = request_id;
end $$;

revoke all on function public.verify_data_subject_request(uuid, text) from public, anon;
grant execute on function public.verify_data_subject_request(uuid, text) to authenticated;

-- Move a request along its statuses.
create or replace function public.answer_data_subject_request(
  request_id uuid,
  new_status text,
  resolution_text text default ''
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  req public.data_subject_request%rowtype;
  note text := pg_catalog.btrim(coalesce(resolution_text, ''));
  terminal boolean;
begin
  if me is null or not private.has_capability('data_request:handle') then
    raise exception 'Only a data steward can answer a rights request.' using errcode = '42501';
  end if;
  if new_status is null or new_status not in ('received', 'verifying', 'in_progress', 'completed', 'refused') then
    raise exception 'Choose a status the queue has.' using errcode = '23514';
  end if;
  if pg_catalog.length(note) > 1000 then
    raise exception 'Keep the resolution to 1,000 characters or fewer.' using errcode = '23514';
  end if;

  select * into req from public.data_subject_request r where r.id = request_id for update;
  if not found then
    raise exception 'No such request.' using errcode = 'P0002';
  end if;
  if req.subject = me then
    raise exception 'You cannot answer your own request.' using errcode = '42501';
  end if;

  if not (
       (req.status = 'received'    and new_status in ('verifying', 'refused'))
    or (req.status = 'verifying'   and new_status in ('in_progress', 'refused'))
    or (req.status = 'in_progress' and new_status in ('completed', 'refused'))
  ) then
    raise exception 'A request cannot move from % to %.', req.status, new_status using errcode = '23514';
  end if;
  if new_status = 'in_progress' and req.verified_at is null then
    raise exception 'Verify the request before it is worked.' using errcode = '23514';
  end if;

  terminal := new_status in ('completed', 'refused');
  if new_status = 'refused' and note = '' then
    raise exception 'A refusal must say why.' using errcode = '23514';
  end if;
  if not terminal and note <> '' then
    raise exception 'The resolution is written with the answer, not before it.' using errcode = '23514';
  end if;

  update public.data_subject_request r
     set status = new_status,
         resolved_at = case when terminal then pg_catalog.now() else null end,
         resolution = case when terminal then note else r.resolution end
   where r.id = request_id;
end $$;

revoke all on function public.answer_data_subject_request(uuid, text, text) from public, anon;
grant execute on function public.answer_data_subject_request(uuid, text, text) to authenticated;

comment on function public.verify_data_subject_request(uuid, text) is
  'Records that a rights request''s requester was verified, on which rung, by a holder of data_request:handle who is not the requester. Writes privacy.request_verified (kind and rung only).';
comment on function public.answer_data_subject_request(uuid, text, text) is
  'Moves a rights request along received, verifying, in_progress, completed or refused, as a holder of data_request:handle who is not the requester. Refuses an illegal move. Writes privacy.request_status_changed (kind and the two statuses only). Sets no response time.';
