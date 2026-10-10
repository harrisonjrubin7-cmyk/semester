# A real two-session replay check, sourced by check.sh after the ordinary
# finance-command suite. It uses only the disposable cluster check.sh made.
# shellcheck shell=bash
# shellcheck disable=SC2154 # psql and work are supplied by check.sh.
maker='51000000-0000-4000-8000-000000000001'
command_key='finance-concurrent-0001'

# Unlike the SQL suite, these assertions need separate committed sessions.
# Remove every committed synthetic row on success or failure so the remaining
# policy suites still see their own pristine disposable fixture database.
cleanup_finance_race() {
  psql -v ON_ERROR_STOP=1 >/dev/null <<SQL
set session_replication_role = replica;
delete from private.domain_outbox_events where tenant_id = 'fin-race';
delete from public.tenant_policy_audit_event where tenant_id = 'fin-race';
delete from private.finance_command_receipts where tenant_id = 'fin-race';
delete from public.student_account_requests where tenant_id = 'fin-race';
delete from public.role_grants where subject = '$maker';
delete from public.profiles where user_id = '$maker';
delete from auth.users where id = '$maker';
delete from public.schools where id = 'fin-race';
set session_replication_role = origin;
SQL
}
trap cleanup_finance_race EXIT

psql -v ON_ERROR_STOP=1 >/dev/null <<SQL
insert into public.schools (id, name, email_domains)
values ('fin-race', 'Finance Race Fixture', array['fin-race.example']);
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
values ('$maker', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'maker@fin-race.example', now(), now(), now());
insert into public.profiles (user_id, handle, school_id)
values ('$maker', 'finance_race_maker', 'fin-race');
insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
values ('$maker', 'student_accounts_officer', 'school', 'fin-race', 'institution');
SQL

claims="{\"sub\":\"$maker\",\"role\":\"authenticated\"}"
call="select public.finance_command('fin-race','RACE1','request.create','$command_key',null,jsonb_build_object('kind','charge','category','fees','amount_cents',2500,'description','Concurrent fixture','reference_entry_id',null,'provider_ref','','effective_on',current_date))::text"

# Hold the key first so both command sessions are certainly waiting together.
( psql -At -v ON_ERROR_STOP=1 -c "begin; select pg_advisory_xact_lock(hashtextextended('finance-command:$command_key',0)); select pg_sleep(2); commit" >/dev/null ) &
lock_holder=$!
lock_seen=0
for _ in $(seq 1 20); do
  if [ "$(psql -At -v ON_ERROR_STOP=1 -c "select count(*) from pg_locks where locktype='advisory' and granted")" -gt 0 ]; then
    lock_seen=1
    break
  fi
  sleep 0.05
done
if [ "$lock_seen" -ne 1 ]; then
  echo "FAILED: concurrent fixture did not acquire its command lock" >&2
  exit 1
fi
( psql -At -v ON_ERROR_STOP=1 -c "set request.jwt.claims = '$claims'; set role authenticated; $call" | grep '^{' > "$work/finance-race-a" ) &
race_a=$!
( psql -At -v ON_ERROR_STOP=1 -c "set request.jwt.claims = '$claims'; set role authenticated; $call" | grep '^{' > "$work/finance-race-b" ) &
race_b=$!
wait "$race_a"
wait "$race_b"
wait "$lock_holder"

cmp "$work/finance-race-a" "$work/finance-race-b" >/dev/null
counts=$(psql -At -v ON_ERROR_STOP=1 -c "select (select count(*) from public.student_account_requests where tenant_id='fin-race' and student_ref='RACE1'), (select count(*) from private.finance_command_receipts where command_key='$command_key')")
if [ "$counts" != '1|1' ]; then
  echo "FAILED: concurrent finance replay made request|receipt counts $counts" >&2
  exit 1
fi

# Recovery also shares the lock: it must wait for an in-flight command commit,
# then return that command's receipt rather than a transient "not found".
recovery_key='finance-recovery-race-0001'
recovery_call="select public.finance_command('fin-race','RACE2','request.create','$recovery_key',null,jsonb_build_object('kind','charge','category','fees','amount_cents',2600,'description','Recovery fixture','reference_entry_id',null,'provider_ref','','effective_on',current_date))::text"
( psql -At -v ON_ERROR_STOP=1 -c "begin; set local request.jwt.claims = '$claims'; set local role authenticated; select pg_advisory_xact_lock(hashtextextended('finance-command:$recovery_key',0)); select pg_sleep(1); $recovery_call; commit" | grep '^{' > "$work/finance-recovery-command" ) &
recovery_command=$!
recovery_lock_seen=0
for _ in $(seq 1 20); do
  if [ "$(psql -At -v ON_ERROR_STOP=1 -c "select count(*) from pg_locks where locktype='advisory' and granted")" -gt 0 ]; then
    recovery_lock_seen=1
    break
  fi
  sleep 0.05
done
if [ "$recovery_lock_seen" -ne 1 ]; then
  echo "FAILED: recovery fixture did not acquire its command lock" >&2
  exit 1
fi
( psql -At -v ON_ERROR_STOP=1 -c "set request.jwt.claims = '$claims'; set role authenticated; select public.finance_command_receipt('fin-race','RACE2','request.create','$recovery_key')::text" | grep '^{' > "$work/finance-recovery-read" ) &
recovery_read=$!
wait "$recovery_command"
wait "$recovery_read"
cmp "$work/finance-recovery-command" "$work/finance-recovery-read" >/dev/null
cleanup_finance_race
trap - EXIT
