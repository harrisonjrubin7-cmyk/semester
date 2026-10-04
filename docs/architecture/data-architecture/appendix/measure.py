#!/usr/bin/env python3
"""Regenerate every figure in docs/architecture/data-architecture/ that is a measurement.

    # 1. a disposable Postgres holding the migrated schema (supabase/local.stub.sql, then
    #    supabase/migrations/*.sql, as supabase/check.sh does). Never a live database.
    # 2. dump the catalog:
    psql -At -f appendix/tables.sql > /tmp/tables.json
    # 3. python3 appendix/measure.py /tmp/tables.json

Writes appendix/conformance.csv and sql/generated_data_registry_seed.sql, prints the summary.
The domain map is a rule list, first match wins, and ends in a CONTROL: it exits non-zero if any
table matches no rule, because a silent default would make every domain look fully covered."""
import collections, csv, json, pathlib, re, sys
here = pathlib.Path(__file__).resolve().parent
RULES = [  # (domain, regex over table name)
 ('ai',          r'^(ai_|approved_source|course_ai_rules$|gateway_|human_overrides$)'),
 ('integration', r'^(integration_|connections$|canonical_entity_|source_(records|snapshots|freshness)|migration_|evidence_reference$|dining_partner_connections$|roster_|lti_(line_item|nonce|link_ticket|platform)|scim_credential$|provider_)'),
 ('identity',    r'^(profiles$|organizations$|organization_members$|schools$|school_membership_requests$|institution_(membership|identity_provider)$|scim_|lti_identity$|role_|app_(roles|capabilities|admins)$|contact_channels$|push_devices$|student_context$|onboarding_progress$|operator_preference$|tenant_sso_policy|provisioning_audit_event$|invites$|access_gate$|account_ages$|council_seat_holder$)'),
 ('family',      r'^(family_|guardian_)'),
 ('finance',     r'^(student_account|student_payment_plan|cost_plans$|dining_ledger$|dining_plans$)'),
 ('commercial',  r'^(gtm_|customer|contracts$|quotes$|quote_lines$|subscription|plan_entitlements$|commercial_|checkout_sessions$|billing_|invoice|dunning_|payment_events$|renewal_|qbrs$|referral|site_leads|site_lead_hits|cancellation_requests$|credits_refunds$|implementation_|beta_|cta_routes$|tenant_plan|account_health_snapshots$|entitlement_definitions$|usage$|outcome_aggregates$|direct_rate_limit$)'),
 ('marketplace', r'^(opportunities$|dining_(orders|order_events|pool_)|seat_watches$|study_match_optins$)'),
 ('career',      r'^(talent_|mentor_requests$|peer_mentor_|skill_)'),
 ('alumni',      r'^(alumni_)'),
 ('support',     r'^(support_|help_|feedback$|community_(cases|case_events|reports|restrictions|safety|escalation|detector|media|calibration|decisions|aliases|identity|signals|volunteer|retention|mutes)|reports$|moderation_audit_event$|governance_incident)'),
 ('campus',      r'^(institution_action|communit|messages$|message_reactions$|groups$|group_|dining_)'),
 ('academic',    r'^(courses$|enrollments$|catalog_sections$|registration_|term_plan_courses$|academic_record_|transfer_evaluations$|articulation_rules$|graduation_scenarios$|course_(demand|guidance|review)|demand_consents$|advisor_|weekly_checkins$|success_plans$|appointments$|grade_levels$)'),
 ('learning',    r'^(gradebook_|grade_entries$|grade_passbacks$|regrade_|mistake_evidence$|study_packs$|sittings$|forms$|form_|accommodation_|concept_evidence$)'),
 ('productivity',r'^(tasks$|notes$|blocks$|state$|productivity_workspace$|capture_|push_queue$|calendar_feeds$)'),
 ('governance',  r'^(audit_event$|governance_|tenant_|legal_holds$|data_|compliance_|control_evidence$|claims_register$|platform_release_evidence$|break_glass_grant$|approval_|console_|feature_|trust_|config_|school_(config|offboarding)|module_mode_|workflow_versions$|content_register$|consent_record$|activity$|access_log$|ledger_|domain_event|domain_outbox)'),
]
def domain(t):
    for d, rx in RULES:
        if re.search(rx, t): return d
rows = json.load(open(sys.argv[1]))
unmapped = []
for r in rows:
    r['domain'] = domain(r['tbl'])
    if r['domain'] is None: unmapped.append(r['tbl'])
if unmapped: sys.exit(f'CONTROL FAILED: {len(unmapped)} tables match no domain rule: {unmapped}')
def has(r, rx): return any(re.search(rx, c) for c in r['cols'])
F = {
 'tenant_id':   lambda r: 'tenant_id' in r['cols'],
 'tenant_fk':   lambda r: r['tenant_fk'],
 'account_fk':  lambda r: r['account_fk'],
 'neither':     lambda r: not ('tenant_id' in r['cols'] or r['account_fk']),
 'created':     lambda r: has(r, r'^(created_at|occurred_at|received_at|placed_at|detected_at|captured_at)$'),
 'updated':     lambda r: 'updated_at' in r['cols'],
 'lifecycle_end': lambda r: has(r, r'^(deleted_at|external_deleted_at|revoked_at|archived_at|released_at|ended_at)$'),
 'source':      lambda r: has(r, r'^(source|source_label|source_system|source_of_truth|origin|provenance)'),
 'classification': lambda r: has(r, r'(classification|data_class)'),
 'retention':   lambda r: has(r, r'(retention|expires_at|purge)'),
 'version':     lambda r: has(r, r'^(version|row_version|rev)$'),
}
agg = collections.defaultdict(collections.Counter)
for r in rows:
    a = agg[r['domain']]; a['n'] += 1
    for k, f in F.items(): a[k] += bool(f(r))
hdr = ['n'] + list(F); tot = collections.Counter()
print('domain'.ljust(13), *[h[:9].rjust(9) for h in hdr])
for d, a in sorted(agg.items(), key=lambda x: -x[1]['n']):
    print(d.ljust(13), *[str(a[h]).rjust(9) for h in hdr]); tot.update(a)
print('TOTAL'.ljust(13), *[str(tot[h]).rjust(9) for h in hdr])
with open(here / 'conformance.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['schema', 'table', 'domain'] + list(F))
    for r in sorted(rows, key=lambda r: (r['domain'], r['schema'], r['tbl'])):
        w.writerow([r['schema'], r['tbl'], r['domain']] + [int(bool(fn(r))) for fn in F.values()])
vals = []
for r in sorted(rows, key=lambda r: (r['schema'], r['tbl'])):
    cls = 'account_record' if r['account_fk'] and 'tenant_id' not in r['cols'] else ('tenant_record' if 'tenant_id' in r['cols'] else None)
    vals.append("('%s','%s','%s',%s,'proposed')" % (r['schema'], r['tbl'], r['domain'], "'%s'" % cls if cls else 'null'))
(here.parent / 'sql' / 'generated_data_registry_seed.sql').write_text(
 '-- GENERATED by appendix/measure.py from the migrated catalog. Every row is review_state=proposed:\n'
 '-- domain and record_class are inferred (rules in the generator); classification, authority, retention,\n'
 '-- deletion and steward are NOT inferred, because inventing them would make the registry look reviewed.\n'
 'insert into private.data_registry (table_schema, table_name, domain, record_class, review_state) values\n'
 + ',\n'.join(vals) + '\non conflict do nothing;\n')
