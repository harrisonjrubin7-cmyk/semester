-- Phase 5 (stream 15, student accounts): one provider reference is one money
-- movement.
--
-- A payment, refund or chargeback carries the provider's own reference
-- (`pi_…`, `re_…`, a dispute id). Nothing stopped two requests under the same
-- reference from being approved into the ledger, so a payment the provider
-- reported twice, or a webhook replayed after a retry, could credit the
-- student's account twice and drive the month's reconciliation off by exactly
-- one payment. The ledger now holds a reference once per school and kind.
--
-- Scope: the key is (school, kind, reference). The same reference under
-- another kind is another movement (a refund is not its payment); under
-- another school it is another school's. Requests are not limited: two
-- proposals may name one reference, because only one of them can be approved
-- and the other is then rejected with the reason shown. Reversals and
-- adjustments carry no provider reference and are outside the rule.
--
-- Two layers, as the one-reversal rule already has: a trigger that says what
-- happened in words, and a unique index that holds when two approvers act at
-- the same instant.

-- Preflight. A unique index cannot be built over duplicates, and silently
-- dropping a ledger row is not an option, so existing duplicates stop the
-- migration with their count. Production has not been shown to hold any;
-- whoever applies this to a school with real data reads the count first.
do $$
declare
  dupes bigint;
begin
  select count(*) into dupes from (
    select 1 from public.student_account_entries
     where kind in ('payment', 'refund', 'chargeback')
     group by tenant_id, kind, provider_ref
    having count(*) > 1) d;
  if dupes > 0 then
    raise exception 'student_account_entries holds % provider reference(s) recorded more than once; resolve them (reverse the extra entry) before this migration', dupes;
  end if;
end $$;

create unique index if not exists student_account_entries_one_provider_ref
  on public.student_account_entries (tenant_id, kind, provider_ref)
  where kind in ('payment', 'refund', 'chargeback');

create or replace function private.student_account_provider_ref_once()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind in ('payment', 'refund', 'chargeback') and exists (
       select 1 from public.student_account_entries e
        where e.tenant_id = new.tenant_id and e.kind = new.kind and e.provider_ref = new.provider_ref) then
    raise exception 'The provider reference % is already recorded as a % in this school''s ledger; a second one is not approved.',
      new.provider_ref, replace(new.kind, '_', ' ')
      using errcode = '23505';
  end if;
  return new;
end $$;
revoke all on function private.student_account_provider_ref_once() from public, anon, authenticated;
drop trigger if exists student_account_provider_ref_once on public.student_account_entries;
create trigger student_account_provider_ref_once before insert on public.student_account_entries
  for each row execute function private.student_account_provider_ref_once();
