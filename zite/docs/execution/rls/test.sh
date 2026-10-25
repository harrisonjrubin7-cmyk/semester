#!/bin/bash
# Tenant-isolation tests for the RLS baseline. Runs as the real runtime login, not as superuser.
# Usage: test.sh <socket-dir> <port> [--mutate]
SOCK=$1; PORT=$2; MUTATE=$3
DB=semester_rls_test
ADM="psql -X -q -tA -h $SOCK -p $PORT -U postgres -d $DB"
RT="psql -X -q -tA -h $SOCK -p $PORT -U semester_runtime_login -d $DB"
TA=a0000000-0000-0000-0000-00000000000a; TB=b0000000-0000-0000-0000-00000000000b
ALICE=00000000-0000-0000-0000-000000000001; ALEX=00000000-0000-0000-0000-000000000002
CAROL=00000000-0000-0000-0000-000000000004
F1=00000000-0000-0000-0000-0000000000f1; F2=00000000-0000-0000-0000-0000000000f2
F3=00000000-0000-0000-0000-0000000000f3; F4=00000000-0000-0000-0000-0000000000f4
A1=00000000-0000-0000-0000-0000000000a1; B1=00000000-0000-0000-0000-0000000000b1
pass=0; fail=0

# rt USER TENANT SQL [commit] -> stdout, or "ERR:<sqlstate>"
rt() {
  local ctx="set local role semester_api;"
  [ -n "$1" ] && ctx="$ctx select set_config('semester.user_id', '$1', true) \\g /dev/null"$'\n'
  [ -n "$2" ] && ctx="$ctx select set_config('semester.tenant_id', '$2', true) \\g /dev/null"$'\n'
  local end=${4:-rollback}
  local out
  out=$(printf '\\set VERBOSITY sqlstate\n\\set ON_ERROR_STOP on\nbegin;\n%s\n%s;\n%s;\n' "$ctx" "$3" "$end" | $RT 2>&1)
  if echo "$out" | grep -q '^ERROR:'; then echo "ERR:$(echo "$out" | grep -m1 '^ERROR:' | awk '{print $2}')"; else echo "$out" | grep -v '^$'; fi
}
check() { # name expected actual
  if [ "$2" == "$3" ]; then pass=$((pass+1)); echo "PASS  $1"; else fail=$((fail+1)); echo "FAIL  $1 — expected [$2] got [$3]"; fi
}

if [ "$MUTATE" == "--mutate" ]; then
  # Mutation: a later, broad permissive policy (the document's own warning). Isolation tests must go red.
  $ADM -c "create policy leak on app.tasks for select to semester_api using (true)"
  echo "(mutation applied: permissive select policy 'leak')"
fi

check "no identity context returns no tasks"           ""     "$(rt '' '' "select id from app.tasks")"
check "student cannot see same-tenant student's task" ""     "$(rt $ALICE $TA "select id from app.tasks where id='$F2'")"
check "student cannot see other tenant's task"        ""     "$(rt $ALICE $TA "select id from app.tasks where id='$F3'")"
check "spoofed tenant without membership sees nothing" ""    "$(rt $ALICE $TB "select id from app.tasks")"
check "positive control: student sees exactly own task" "$F1" "$(rt $ALICE $TA "select id from app.tasks")"
check "update of inaccessible task affects 0 rows"    ""     "$(rt $ALICE $TA "update app.tasks set title='x' where id='$F3' returning id")"
check "cannot reassign ownership (column grant)"      "ERR:42501" "$(rt $ALICE $TA "update app.tasks set owner_user_id='$ALEX' where id='$F1'")"
check "cannot grant itself a role"                    "ERR:42501" "$(rt $ALICE $TA "insert into iam.role_assignments (tenant_id, membership_id, role_id) values ('$TA','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c2')")"
check "own update with expected version bumps version" "completed|2" "$(rt $ALICE $TA "update app.tasks set state='completed' where id='$F1' and version=1 returning state, version")"
check "can create own task"                           "1"    "$(rt $ALICE $TA "with i as (insert into app.tasks (tenant_id, workspace_id, owner_user_id, title) values ('$TA','$A1','$ALICE','new') returning 1) select count(*) from i")"
check "cannot create a task owned by someone else"    "ERR:42501" "$(rt $ALICE $TA "insert into app.tasks (tenant_id, workspace_id, owner_user_id, title) values ('$TA','$A1','$ALEX','x')")"
r=$(rt $ALICE $TA "insert into app.tasks (tenant_id, workspace_id, owner_user_id, title) values ('$TA','$B1','$ALICE','x')")
check "cross-tenant workspace insert rejected"        "rejected" "$([[ $r == ERR:42501 || $r == ERR:23503 ]] && echo rejected || echo "$r")"
check "denied delete leaves target present"           "|1"   "$(rt $ALICE $TA "delete from app.tasks where id='$F2' returning id")|$($ADM -c "select count(*) from app.tasks where id='$F2'")"
check "workspace-scoped operator sees only its workspace" "2|0" "$(rt $CAROL $TA "select count(*) filter (where workspace_id='$A1') || '|' || count(*) filter (where id='$F4') from app.tasks")"
check "read_any operator cannot update (no update_any)" ""   "$(rt $CAROL $TA "update app.tasks set title='x' where id='$F2' returning id")"

$ADM -c "update iam.memberships set status='revoked' where id='00000000-0000-0000-0000-0000000000e1'"
check "revoked membership loses access on next request" "" "$(rt $ALICE $TA "select id from app.tasks")"
$ADM -c "update iam.memberships set status='active', valid_until=now()-interval '1 minute' where id='00000000-0000-0000-0000-0000000000e1'"
check "expired membership loses access"              ""     "$(rt $ALICE $TA "select id from app.tasks")"
$ADM -c "update iam.memberships set valid_until=null where id='00000000-0000-0000-0000-0000000000e1'; update iam.role_assignments set valid_until=now()-interval '1 minute' where id='00000000-0000-0000-0000-0000000000d1'"
check "expired role assignment removes capability"   ""     "$(rt $ALICE $TA "select id from app.tasks")"
$ADM -c "update iam.role_assignments set valid_until=null where id='00000000-0000-0000-0000-0000000000d1'; update iam.users set status='disabled' where id='$ALICE'"
check "disabled global user cannot read"             ""     "$(rt $ALICE $TA "select id from app.tasks")"
$ADM -c "update iam.users set status='active' where id='$ALICE'; update iam.tenants set status='suspended' where id='$TA'"
check "suspended tenant denies ordinary access"      ""     "$(rt $ALICE $TA "select id from app.tasks")"
$ADM -c "update iam.tenants set status='active' where id='$TA'"
check "access restored after reverting state (control)" "$F1" "$(rt $ALICE $TA "select id from app.tasks")"

# Connection reuse: one session, request A sets context and commits; request B on the same connection sets none.
reuse=$(printf "begin; set local role semester_api; select set_config('semester.user_id','$ALICE',true) \\\\g /dev/null\nselect set_config('semester.tenant_id','$TA',true) \\\\g /dev/null\ncommit;\nbegin; set local role semester_api; select coalesce(current_setting('semester.user_id', true),'') || '|' || (select count(*) from app.tasks); commit;\n" | $RT 2>&1 | grep -v '^$')
check "request B on reused connection inherits no identity" "|0" "$reuse"

# Concurrency: two sessions update the same task with the same expected version at the same time.
$ADM -c "update app.tasks set version=version where false"
v=$($ADM -c "select version from app.tasks where id='$F2'")
( printf "begin; set local role semester_api; select set_config('semester.user_id','$ALEX',true) \\\\g /dev/null\nselect set_config('semester.tenant_id','$TA',true) \\\\g /dev/null\nupdate app.tasks set title='s1' where id='$F2' and version=$v returning 'one'; select pg_sleep(1) \\\\g /dev/null\ncommit;\n" | $RT 2>&1 | grep -v '^$' > /tmp/rls_c1 ) &
sleep 0.3
c2=$(printf "begin; set local role semester_api; select set_config('semester.user_id','$ALEX',true) \\\\g /dev/null\nselect set_config('semester.tenant_id','$TA',true) \\\\g /dev/null\nupdate app.tasks set title='s2' where id='$F2' and version=$v returning 'two';\ncommit;\n" | $RT 2>&1 | grep -v '^$')
wait
check "concurrent expected-version updates: exactly one wins" "one|" "$(cat /tmp/rls_c1)|$c2"

check "runtime cannot disable RLS"                    "ERR:42501" "$(rt $ALICE $TA "alter table app.tasks disable row level security")"
check "runtime cannot drop a policy"                  "ERR:42501" "$(rt $ALICE $TA "drop policy tasks_read on app.tasks")"
check "runtime cannot write memberships"              "ERR:42501" "$(rt $ALICE $TA "update iam.memberships set status='active'")"
check "login without SET ROLE holds no table access"  "ERR:42501" "$(printf '\\set VERBOSITY sqlstate\nselect 1 from app.tasks;\n' | $RT 2>&1 | grep -m1 '^ERROR:' | awk '{print "ERR:"$2}')"
check "runtime login is not superuser/bypassrls/owner" "f|f" "$($ADM -c "select rolsuper || '|' || rolbypassrls from pg_roles where rolname='semester_runtime_login'" | sed 's/false/f/g')"

if [ "$MUTATE" == "--mutate" ]; then $ADM -c "drop policy leak on app.tasks"; echo "(mutation reverted)"; fi
echo "---"; echo "$pass passed, $fail failed"
[ $fail -eq 0 ]
