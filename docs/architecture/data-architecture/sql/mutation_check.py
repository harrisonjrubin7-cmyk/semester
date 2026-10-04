#!/usr/bin/env python3
"""Prove each test can fail. For every row below: copy the proposals, apply ONE faithful bug to
one file, rebuild a disposable database, apply everything, run the named test, and require it
to go red (a FAIL exception). A row whose test stays green is a guard that guards nothing.

    PGHOST=/path/to/socket PGPORT=54399 PGUSER=postgres ./mutation_check.py [template_db]

Also runs every test UNMUTATED first as the control: if the control is red the table means
nothing. Exit status 1 if the control is red or any mutation survives."""
import os, subprocess, sys, tempfile, shutil, pathlib
here = pathlib.Path(__file__).resolve().parent
template = sys.argv[1] if len(sys.argv) > 1 else 'postgres'
DB = 'sem_mutation'
def psql(*a, db=None, stdin=None):
    cmd = ['psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1'] + (['-d', db] if db else []) + list(a)
    return subprocess.run(cmd, capture_output=True, text=True)
# (id, file, old, new, test)   -- `old`/`new` may be a list of pairs (all applied): needed where two
# independent barriers guard one rule (defence in depth), since removing one changes nothing.
M = [
 ('02a lineage crosses tenants', '02_provenance_lineage_precedence.sql', "where e.tenant_id = _tenant and e.input_kind = _kind and e.input_id = _id", "where e.input_kind = _kind and e.input_id = _id", '02_provenance'),
 ('02b partial tenant override leaks platform rows', '02_provenance_lineage_precedence.sql', "and p.tenant_id is not distinct from scope.t", "and (p.tenant_id is null or p.tenant_id = scope.t)", '02_provenance'),
 ('02c connected row needs no ref', '02_provenance_lineage_precedence.sql', "(source_ref is not null and source_observed_at is not null and ingested_at is not null)", "true", '02_provenance'),
 ('02d conflict can be NULL', '02_provenance_lineage_precedence.sql', "coalesce(d.user_id is not null and r.state in ('dropped', 'withdrawn', 'denied', 'left_waitlist'), false) as conflict", "(d.user_id is not null and r.state in ('dropped', 'withdrawn', 'denied', 'left_waitlist')) as conflict", '02_provenance'),
 ('02e dropped course reads as enrolled', '02_provenance_lineage_precedence.sql', "when r.state in ('dropped', 'withdrawn', 'denied', 'left_waitlist')    then 'official_not_enrolled'", "when r.state in ('withdrawn', 'denied', 'left_waitlist')    then 'official_not_enrolled'", '02_provenance'),
 ('02f crosswalk guard ignores source_type', '02_provenance_lineage_precedence.sql', "and a.attname in ('source_label', 'source_type')", "and a.attname in ('source_label')", '02_provenance'),
 ('02g crosswalk guard ignores new values', '02_provenance_lineage_precedence.sql', "and not exists (select 1 from private.source_vocabulary v where v.vocabulary = a.attname and v.value = m[1]);", "and false;", '02_provenance'),
 ('03a sweep ignores tenant hold', '03_event_registry_and_outbox_sweep.sql', "     and e.payload <> '{}'::jsonb\n     and (e.tenant_id is null or not private.tenant_is_held(e.tenant_id));\n  get diagnostics scrubbed", "     and e.payload <> '{}'::jsonb;\n  get diagnostics scrubbed", '03_outbox_sweep'),
 ('03b sweep ignores platform hold', '03_event_registry_and_outbox_sweep.sql', "  if held then return", "  if false then return", '03_outbox_sweep'),
 ('03c sweep expires parked rows', '03_event_registry_and_outbox_sweep.sql', "where e.published_at is not null\n       and e.published_at < now() - ((keep", "where e.published_at is null\n       and e.occurred_at < now() - ((keep", '03_outbox_sweep'),
 ('04a manifest leaks other tenants', '04_lifecycle_manifest_and_restore.sql', "where tenant_id = $1', r.s, r.t) into n using _tenant", "where $1 is not null', r.s, r.t) into n using _tenant", '04_lifecycle'),
 ('04b production restore closes without sweeps', '04_lifecycle_manifest_and_restore.sql', "check (environment <> 'production' or accounts_notified_at is null or sweeps_run_at is not null)", "check (true)", '04_lifecycle'),
 ('05a small cohorts published', '05_analytics_boundary.sql', "case when _n >= _k then _n end", "_n", '05_analytics'),
 ('05b leak guard blind to email', '05_analytics_boundary.sql', "(email|first_name", "(first_name", '05_analytics'),
 ('05c reader granted public.activity', '05_analytics_boundary.sql', "grant select on analytics.v_weekly_active_owner to analytics_reader;", "grant select on analytics.v_weekly_active_owner to analytics_reader; grant select on public.activity to analytics_reader;", '05_analytics'),
 ('05d salt never rotates', '05_analytics_boundary.sql', "encode(hmac(_subject::text::bytea, s.salt, 'sha256'), 'hex')", "encode(hmac(_subject::text::bytea, 'fixed'::bytea, 'sha256'), 'hex')", '05_analytics'),
 ('05e institution floor can be lowered below 10', '05_analytics_boundary.sql', "check (audience <> 'institution' or min_cohort >= 10),", "check (true),", '05_analytics'),
 ('05i institution reader granted the owner view', '05_analytics_boundary.sql', "grant select on analytics.v_weekly_active_owner to analytics_reader;", "grant select on analytics.v_weekly_active_owner to analytics_reader, analytics_institution_reader;", '05_analytics'),
 ('05f forbidden metrics accepted', '05_analytics_boundary.sql', "(risk_score|reading_time|mouse|attention|ai_usage|integrity_flag|wellbeing_score|location)", "(zz_nothing)", '05_analytics'),
 ('05g source guard blind to nested views', '05_analytics_boundary.sql', "join pg_class r on r.oid = dep.rel_oid and r.relkind in ('v','m')", "join pg_class r on r.oid = dep.rel_oid and r.relkind in ('x')", '05_analytics'),
 ('05h source guard ignores the eligible flag', '05_analytics_boundary.sql', "where not coalesce(g.analytics_eligible, false)\n     and n.nspname <> 'analytics';", "where false\n     and n.nspname <> 'analytics';", '05_analytics'),
 ('06a search ignores minors', '06_search_index.sql', "                                        and private.age_cleared(owner_user_id)\n", "", '06_search'),
 ('06b search ignores tenant', '06_search_index.sql', "  and tenant_id = private.school_of()\n", "", '06_search'),
 ('06c search ignores blocks', '06_search_index.sql', "(b.user_id = (select auth.uid()) and b.blocked = owner_user_id)", "false", '06_search'),
 ('06d search runs as definer', '06_search_index.sql', "language sql stable security invoker set search_path = pg_catalog, public, search as $$\n  with q as", "language sql stable security definer set search_path = pg_catalog, public, search as $$\n  with q as", '06_search'),
 ('06e T3 indexable', '06_search_index.sql', "classification in ('T0','T1','T2')),\n  title", "classification in ('T0','T1','T2','T3')),\n  title", '06_search'),
 ('07a gate ignores age', '07_ai_retrieval_controls.sql', "if not p.allows_minor and not private.age_cleared(who) then", "if false then", '07_ai_retrieval'),
 ('07b no classification ceiling', '07_ai_retrieval_controls.sql', "       and d.classification = any (tiers[1:array_position(tiers, p.max_tier)])\n", "", '07_ai_retrieval'),
 ('07c eligibility ignored (both barriers)', '07_ai_retrieval_controls.sql', ["     where c.ai_eligible\n       and d.classification", "using (\n  ai_eligible and exists"], ["     where d.classification", "using (\n  exists"], '07_ai_retrieval'),
 ('07d retrieve runs as definer', '07_ai_retrieval_controls.sql', "language plpgsql stable security invoker set search_path = pg_catalog, public, ai, search as $$\ndeclare p ai.purpose;", "language plpgsql stable security definer set search_path = pg_catalog, public, ai, search as $$\ndeclare p ai.purpose;", '07_ai_retrieval'),
 ('07e kill switch ignored', '07_ai_retrieval_controls.sql', "where k.engaged and k.switch_key", "where false and k.switch_key", '07_ai_retrieval'),
 ('07f tenant policy ignored', '07_ai_retrieval_controls.sql', "and t.capability = 'semester_intelligence' and t.state <> 'off')", "and t.capability = 'semester_intelligence')", '07_ai_retrieval'),
 ('07g log writable by users (grant AND policy)', '07_ai_retrieval_controls.sql', "revoke all on ai.retrieval_log from public, anon, authenticated;", "grant insert, select on ai.retrieval_log to authenticated; create policy zz on ai.retrieval_log for all to authenticated using (true) with check (true);", '07_ai_retrieval'),
 ('08a partitions not created ahead', '08_partitioning_and_archival.sql', "for i in 0.._months_ahead loop", "for i in 1.._months_ahead loop", '08_partitioning'),
 ('08b detach ignores holds', '08_partitioning_and_archival.sql', "if not h then execute", "if true then execute", '08_partitioning'),
 ('09a orphan rule inverted', '09_data_quality_rules.sql', "and not exists (select 1 from %s p where p.%I = c.%I)", "and exists (select 1 from %s p where p.%I = c.%I)", '09_data_quality'),
 ('09b results tie inside one transaction', '09_data_quality_rules.sql', "default clock_timestamp()", "default now()", '09_data_quality'),
 ('10a created_at forgeable', '10_row_conventions.sql', "'created_at', o -> 'created_at',", "'created_at', n -> 'created_at',", '10_row_conventions'),
 ('10b tenant may change', '10_row_conventions.sql', "      if o -> col is distinct from n -> col then", "      if false then", '10_row_conventions'),
 ('10c row_version forgeable', '10_row_conventions.sql', "coalesce((o ->> 'row_version')::bigint, 0) + 1", "coalesce((n ->> 'row_version')::bigint, 0)", '10_row_conventions'),
 ('10d legacy rows get a fabricated created_at', '10_row_conventions.sql', "add column if not exists created_at timestamptz, add column if not exists updated_at timestamptz,", "add column if not exists created_at timestamptz not null default now(), add column if not exists updated_at timestamptz,", '10_row_conventions'),
 ('10e append-only guard inert', '10_row_conventions.sql', "if (tg_op = 'UPDATE' and scope in ('update','both')) or (tg_op = 'DELETE' and scope in ('delete','both')) then", "if false then", '10_row_conventions'),
 ('11a detector blind (matches every body)', '11_hold_coverage_guard.sql', "and p.prosrc !~* '(is_held|legal_hold)'", "and p.prosrc !~* '(zzzz_never)'", '11_hold_coverage'),
 ('11b detector flags hold-aware sweeps', '11_hold_coverage_guard.sql', "and p.prosrc !~* '(is_held|legal_hold)'", "and p.prosrc ~* '(is_held|legal_hold)'", '11_hold_coverage'),
 ('11c expired exemption still silences', '11_hold_coverage_guard.sql', "and e.review_by >= current_date);", "and true);", '11_hold_coverage'),
 ('11d gaps may be parked indefinitely', '11_hold_coverage_guard.sql', "check (kind <> 'known_gap' or review_by <= current_date + 120)", "check (true)", '11_hold_coverage'),
 ('12a tenant_mismatch inverted', '09_data_quality_rules.sql', "where c.tenant_id is distinct from p.%I", "where c.tenant_id is not distinct from p.%I", '12_dq_cross_tenant_rules'),
 ('12b stale rule never fails on an empty table', '09_data_quality_rules.sql', "coalesce(extract(epoch from now() - max(%I)), %s) from %s", "coalesce(extract(epoch from now() - max(%I)), 0 * %s) from %s", '12_dq_cross_tenant_rules'),
 ('13a exemptions expiring not counted', '12_governance_kpis.sql', "where review_by between current_date and current_date + 30)", "where false)", '13_governance_kpis'),
 ('13b parked events counted as pending', '12_governance_kpis.sql', "where published_at is null and dead_lettered_at is null)", "where published_at is null)", '13_governance_kpis'),
 ('13c released holds counted active', '12_governance_kpis.sql', "where released_at is null)", "where true)", '13_governance_kpis'),
 ('13d overdue rights ignores resolution', '12_governance_kpis.sql', "where resolved_at is null and due_at < now())", "where due_at < now())", '13_governance_kpis'),
 ('01a evidence tables client-updatable pass', '01_registry_and_conformance.sql', "where record_class = 'append_only_evidence' and client_updatable", "where false", '01_registry'),
]
def build(src_dir):
    r = psql('-c', f'drop database if exists {DB}'); r = psql('-c', f'create database {DB} template {template}')
    if r.returncode: sys.exit('cannot create db: ' + r.stderr)
    for f in sorted(src_dir.glob('[0-9][0-9]_*.sql')):
        r = psql('-f', str(f), db=DB)
        if r.returncode: return f'apply {f.name}: ' + r.stderr.strip().splitlines()[-1]
        for prefix, gen in (('01_', 'generated_data_registry_seed.sql'), ('09_', 'generated_dq_cross_tenant_rules.sql')):
            if f.name.startswith(prefix):
                r = psql('-f', str(src_dir / gen), db=DB)
                if r.returncode: return gen + ': ' + r.stderr
    return None
def run_test(src_dir, name):
    t = src_dir / 'tests' / f'{name}.test.sql'
    r = psql('-f', str(t), db=DB)
    return r.returncode, (r.stderr or '').strip().splitlines()[-2:]
tests = sorted(p.name.replace('.test.sql','') for p in (here/'tests').glob('*.test.sql'))
bad = 0
print('CONTROL (unmutated)')
err = build(here)
if err: sys.exit('control build failed: ' + err)
for t in tests:
    rc, tail = run_test(here, t); print(f'  {"ok " if rc==0 else "RED"} {t}', '' if rc==0 else tail); bad += rc != 0
if bad: sys.exit('control is red: mutation results below would be meaningless')
print('MUTATIONS (each must turn its test red)')
for mid, f, old, new, test in M:
    tmp = pathlib.Path(tempfile.mkdtemp()); shutil.copytree(here, tmp / 'sql')
    d = tmp / 'sql'; p = d / f; s = p.read_text()
    olds, news = (old, new) if isinstance(old, list) else ([old], [new])
    if any(s.count(o) < 1 for o in olds): print(f'  ?? {mid}: pattern not found, mutation not applied'); bad += 1; shutil.rmtree(tmp); continue
    for o, n in zip(olds, news): s = s.replace(o, n, 1)
    p.write_text(s)
    err = build(d)
    if err: print(f'  RED {mid}  (build refused: {err[:90]})'); shutil.rmtree(tmp); continue
    rc, tail = run_test(d, test)
    if rc != 0: print(f'  RED {mid}  <- {tail[-1][:100] if tail else ""}')
    else: print(f'  SURVIVED {mid}  (test {test} stayed green)'); bad += 1
    shutil.rmtree(tmp)
sys.exit(1 if bad else 0)
