-- 009: tuition payments (full-stack brief §8 and §9). Provider-independent. Sandbox semantics only.
-- Money is integer minor units plus currency. The ledger is append-only: a refund is a new entry.
\set ON_ERROR_STOP on
begin;
create schema student_accounts authorization semester_owner;
revoke all on schema student_accounts from public;
grant usage on schema student_accounts to semester_api;
create role semester_payments_cmd nologin nobypassrls;
create role semester_webhook_login login nobypassrls nosuperuser nocreatedb nocreaterole;
grant usage on schema student_accounts to semester_payments_cmd;
set local role semester_owner;

create table student_accounts.accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  student_user_id uuid not null,
  currency char(3) not null,
  unique (tenant_id, id),
  foreign key (tenant_id, student_user_id) references iam.memberships(tenant_id, user_id)
);
create table student_accounts.payment_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  account_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  provider text not null default 'sandbox',
  provider_ref text not null unique default ('pi_' || replace(gen_random_uuid()::text, '-', '')),
  state text not null default 'initiated'
    check (state in ('initiated', 'pending', 'confirmed', 'failed', 'refunded', 'reconciliation_required')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, idempotency_key),
  foreign key (tenant_id, account_id) references student_accounts.accounts(tenant_id, id)
);
create table student_accounts.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  account_id uuid not null,
  kind text not null check (kind in ('charge', 'payment', 'refund')),
  amount_minor bigint not null,          -- charge > 0 (owed); payment and refund signed by kind
  currency char(3) not null,
  operation_id uuid references student_accounts.payment_operations(id),
  provider_event_id text,
  memo text not null default '',
  posted_at timestamptz not null default now(),
  foreign key (tenant_id, account_id) references student_accounts.accounts(tenant_id, id),
  check ((kind = 'charge') = (operation_id is null))
);
-- A payment posts at most once per operation, a refund at most once per provider event.
create unique index ledger_one_payment on student_accounts.ledger_entries(operation_id) where kind = 'payment';
create unique index ledger_one_refund_per_event on student_accounts.ledger_entries(provider_event_id) where kind = 'refund';
create table student_accounts.provider_event_receipts (
  provider text not null,
  provider_account_id text not null,
  event_id text not null,
  event_type text not null,
  provider_ref text not null,
  outcome text not null,
  received_at timestamptz not null default now(),
  primary key (provider, provider_account_id, event_id)
);
-- Which provider account belongs to which tenant: trusted configuration, not taken from the event.
create table student_accounts.provider_accounts (
  provider text not null,
  provider_account_id text not null,
  tenant_id uuid not null,
  primary key (provider, provider_account_id)
);

alter table student_accounts.accounts enable row level security;           alter table student_accounts.accounts force row level security;
alter table student_accounts.payment_operations enable row level security; alter table student_accounts.payment_operations force row level security;
alter table student_accounts.ledger_entries enable row level security;     alter table student_accounts.ledger_entries force row level security;
alter table student_accounts.provider_event_receipts enable row level security; alter table student_accounts.provider_event_receipts force row level security;
alter table student_accounts.provider_accounts enable row level security;  alter table student_accounts.provider_accounts force row level security;

-- Student (runtime) access: read own account, own operations, own ledger; create a payment operation.
grant select on student_accounts.accounts, student_accounts.payment_operations, student_accounts.ledger_entries to semester_api;
grant insert (tenant_id, account_id, amount_minor, currency, idempotency_key) on student_accounts.payment_operations to semester_api;
create policy accounts_own on student_accounts.accounts for select to semester_api
  using (tenant_id = iam.current_tenant_id() and student_user_id = iam.current_user_id() and iam.is_active_member(tenant_id));
create policy ops_own on student_accounts.payment_operations for select to semester_api
  using (tenant_id = iam.current_tenant_id() and exists (select 1 from student_accounts.accounts a where a.id = account_id));
create policy ops_initiate on student_accounts.payment_operations for insert to semester_api
  with check (tenant_id = iam.current_tenant_id() and exists (select 1 from student_accounts.accounts a where a.id = account_id and a.currency = payment_operations.currency));
create policy ledger_own on student_accounts.ledger_entries for select to semester_api
  using (tenant_id = iam.current_tenant_id() and exists (select 1 from student_accounts.accounts a where a.id = account_id));

-- Payments command role: used only by the webhook function below. It works across tenants by design
-- (a provider event carries no user), so its scope comes from provider_accounts, never from the event.
grant select on student_accounts.provider_accounts, student_accounts.payment_operations, student_accounts.accounts to semester_payments_cmd;
grant select, insert on student_accounts.provider_event_receipts to semester_payments_cmd;
grant update (state, updated_at) on student_accounts.payment_operations to semester_payments_cmd;
grant insert on student_accounts.ledger_entries to semester_payments_cmd;
grant select on student_accounts.ledger_entries to semester_payments_cmd;
create policy cmd_all on student_accounts.provider_accounts for select to semester_payments_cmd using (true);
create policy cmd_ops_read on student_accounts.payment_operations for select to semester_payments_cmd using (true);
create policy cmd_ops_update on student_accounts.payment_operations for update to semester_payments_cmd using (true) with check (true);
create policy cmd_accounts on student_accounts.accounts for select to semester_payments_cmd using (true);
create policy cmd_receipts_r on student_accounts.provider_event_receipts for select to semester_payments_cmd using (true);
create policy cmd_receipts_w on student_accounts.provider_event_receipts for insert to semester_payments_cmd with check (true);
create policy cmd_ledger_w on student_accounts.ledger_entries for insert to semester_payments_cmd with check (kind in ('payment', 'refund'));
create policy cmd_ledger_r on student_accounts.ledger_entries for select to semester_payments_cmd using (true);
commit;

begin;
-- Apply one verified provider event. Signature verification happens in the API before this is called;
-- this function owns deduplication, ordering, value checks and posting, in one transaction.
create function student_accounts.apply_provider_event(
  p_provider text, p_provider_account text, p_event_id text, p_event_type text,
  p_provider_ref text, p_amount_minor bigint, p_currency text)
returns text language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_tenant uuid;
  v_op student_accounts.payment_operations%rowtype;
  v_outcome text;
  v_rank_old int;
  v_rank_new int;
  v_target text;
begin
  select tenant_id into v_tenant from student_accounts.provider_accounts
    where provider = p_provider and provider_account_id = p_provider_account;
  if v_tenant is null then raise exception 'UNKNOWN_PROVIDER_ACCOUNT' using errcode = '42501'; end if;

  -- Durable receipt first: a duplicate delivery stops here and changes nothing.
  begin
    insert into student_accounts.provider_event_receipts (provider, provider_account_id, event_id, event_type, provider_ref, outcome)
      values (p_provider, p_provider_account, p_event_id, p_event_type, p_provider_ref, 'processing');
  exception when unique_violation then
    return 'duplicate_ignored';
  end;

  select * into v_op from student_accounts.payment_operations
    where provider_ref = p_provider_ref and provider = p_provider and tenant_id = v_tenant for update;
  if not found then
    v_outcome := 'unknown_operation';
  elsif p_event_type in ('payment.pending', 'payment.succeeded', 'payment.failed')
        and (p_amount_minor <> v_op.amount_minor or upper(p_currency) <> v_op.currency) then
    update student_accounts.payment_operations set state = 'reconciliation_required', updated_at = now() where id = v_op.id;
    v_outcome := 'reconciliation_required';
  else
    v_target := case p_event_type
      when 'payment.pending' then 'pending' when 'payment.succeeded' then 'confirmed'
      when 'payment.failed' then 'failed' when 'refund.succeeded' then 'refunded' else null end;
    if v_target is null then
      v_outcome := 'unsupported_event';
    else
      -- Events can arrive out of order. A state only moves forward; nothing leaves a terminal
      -- state except a confirmed payment being refunded.
      v_rank_old := case v_op.state when 'initiated' then 0 when 'pending' then 1 when 'failed' then 2
                    when 'confirmed' then 2 when 'refunded' then 3 when 'reconciliation_required' then 9 end;
      v_rank_new := case v_target when 'pending' then 1 when 'failed' then 2 when 'confirmed' then 2 when 'refunded' then 3 end;
      if v_op.state = 'reconciliation_required' then
        v_outcome := 'held_for_reconciliation';
      elsif v_rank_new <= v_rank_old or (v_target = 'refunded' and v_op.state <> 'confirmed') then
        v_outcome := 'stale_or_invalid_transition_ignored';
      else
        update student_accounts.payment_operations set state = v_target, updated_at = now() where id = v_op.id;
        if v_target = 'confirmed' then
          insert into student_accounts.ledger_entries (tenant_id, account_id, kind, amount_minor, currency, operation_id, provider_event_id, memo)
            values (v_op.tenant_id, v_op.account_id, 'payment', -v_op.amount_minor, v_op.currency, v_op.id, p_event_id, 'Payment received');
        elsif v_target = 'refunded' then
          if p_amount_minor <= 0 or p_amount_minor > v_op.amount_minor or upper(p_currency) <> v_op.currency then
            raise exception 'INVALID_REFUND_VALUES' using errcode = '22023';
          end if;
          insert into student_accounts.ledger_entries (tenant_id, account_id, kind, amount_minor, currency, operation_id, provider_event_id, memo)
            values (v_op.tenant_id, v_op.account_id, 'refund', p_amount_minor, v_op.currency, v_op.id, p_event_id, 'Refund issued');
        end if;
        v_outcome := 'applied:' || v_target;
      end if;
    end if;
  end if;
  return v_outcome;
end;
$$;
alter function student_accounts.apply_provider_event(text, text, text, text, text, bigint, text) owner to semester_payments_cmd;
revoke all on function student_accounts.apply_provider_event(text, text, text, text, text, bigint, text) from public;
grant execute on function student_accounts.apply_provider_event(text, text, text, text, text, bigint, text) to semester_webhook_login;
grant usage on schema student_accounts to semester_webhook_login;
commit;
