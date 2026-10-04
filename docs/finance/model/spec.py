"""Semester financial model: assumptions, scenarios, headcount, schedules and rows.

Every number here is a PLANNING ASSUMPTION unless its tag says FACT. None is an
approved price, budget or forecast. See ../README.md for the tag legend.
Month 1 = January 2027. All money is USD.
"""
from dsl import *

# tag legend --------------------------------------------------------------
# FACT    in the repository today (cited)
# POLICY  a proposed default already in the repository (deal-desk.ts), not approved
# HYP     hypothesis to be tested with real data; no evidence yet
# VENDOR  vendor list price or rate: verify against the vendor's current page
# PRO     needs a determination by a qualified professional before it is relied on
# ILLUS   illustrative placeholder; replace before any use
# DECIDE  a founder / authorized-reviewer decision the repository has not made (gate timing)

# -------------------------------------------------------------- scalars
# (key, label, unit, value, tag, note)
ASSUMPTIONS = [
 ('## Go / no-go gates (controlling document: GO-NO-GO-DECISION.md, 3 Oct 2026)', None, None, None, None, None),
 ('gate_plus', 'Month broad / paid individual acquisition may begin (checkout hold lifted)', 'month', 13, 'DECIDE', 'Today NO-GO (INDIVIDUAL_PAID_ACQUISITION_ENABLED = false). Needs invitation-validation closeout + a separate broad-rollout decision.'),
 ('pre_gate_share', 'Share of organic signups before that gate (invitation-only, unpaid validation cohorts)', '%', 0.25, 'DECIDE', 'Conditional GO covers invitation-only, unpaid validation only.'),
 ('gate_pilot', 'Month the first PAID institutional pilot may begin', 'month', 12, 'DECIDE', 'Today NO-GO. Reconsidered only after a design-partner pilot has an approved activation record and a measured 26-week closeout (D-134).'),
 ('gate_direct', 'Month direct annual sales (no pilot first) may begin', 'month', 22, 'DECIDE', 'After the first pilot-to-annual conversions are evidenced.'),
 ('gate_ent', 'Month System-tier / broad enterprise sale may begin', 'month', 26, 'DECIDE', 'Last motion to reconsider: repeated deployments and independent assurance first.'),
 ('dp_rho', 'Design-partner pilot to paid annual conversion', '%', 0.60, 'HYP', 'Unpaid design partners; converts only after the paid-pilot gate.'),

 ('## Student subscription', None, None, None, None, None),
 ('price_m', 'Plus list price, monthly', '$/mo', 7.99, 'FACT', 'D-134 and docs/COMMERCIAL-CORE.md; the catalog charges this.'),
 ('price_a', 'Plus list price, annual', '$/yr', 59.0, 'FACT', 'D-134. Effective $4.92/mo.'),
 ('stud_disc', 'Average promotional / edu discount on list', '%', 0.10, 'HYP', 'No promo program exists. Counsel to review any student-pricing claim.'),
 ('refund', 'Refunds + chargebacks, share of billings', '%', 0.033, 'HYP', 'Contra-revenue. Refund policy is not yet approved.'),
 ('organic_start', 'Organic + campus-led free signups, month 1', 'users/mo', 1200, 'HYP', 'No acquisition history. Pre-seasonality trend.'),
 ('cps', 'Paid acquisition: cost per free signup', '$', 3.00, 'HYP', 'Test in paid channels before scaling; student CPI varies widely.'),
 ('activation', 'Signups that become monthly-active', '%', 0.60, 'HYP', 'Measure with the activation definition in ANALYTICS.md.'),
 ('free_churn', 'Monthly churn of active free users', '%', 0.12, 'HYP', 'Academic-calendar driven; calibrate on cohorts.'),
 ('conv', 'Free-to-paid conversion, monthly, of active free base', '%', 0.0025, 'HYP', 'No paying cohort evidenced. Single most sensitive consumer input.'),
 ('annual_mix', 'Share of new paid on annual plan', '%', 0.45, 'HYP', ''),
 ('churn_m', 'Monthly plan churn (per month)', '%', 0.05, 'HYP', 'Summer and graduation churn are folded into the average.'),
 ('renew_a', 'Annual plan renewal rate at term', '%', 0.55, 'HYP', ''),
 ('iap_share', 'Student billings through app stores (native apps)', '%', 0.25, 'PRO', 'App-store purchase rules for digital subscriptions: platform-policy and counsel review.'),
 ('iap_fee', 'App-store commission', '%', 0.15, 'VENDOR', 'Assumes a reduced-rate program; verify current store terms.'),
 ('stripe_pct', 'Card processing, percent', '%', 0.029, 'VENDOR', 'Verify current Stripe pricing and any negotiated rate.'),
 ('stripe_fix', 'Card processing, fixed fee per charge', '$', 0.30, 'VENDOR', 'Verify.'),

 ('## Institutional platform', None, None, None, None, None),
 ('inst_disc', 'Average realized discount off institutional list', '%', 0.12, 'POLICY', 'Within the deal-desk ladder (<=20% needs finance).'),
 ('rr_i', 'Gross logo renewal rate at term', '%', 0.88, 'HYP', 'No contract has reached term.'),
 ('expansion', 'Expansion on retained contract value (modules, bands)', '%', 0.10, 'HYP', 'NRR (core) = renewal x (1 + expansion).'),
 ('pilot_share', 'Share of full rollout active during a pilot', '%', 0.35, 'HYP', 'Pilot is a bounded cohort (D-134: 26 weeks).'),
 ('bad_debt', 'Bad debt, share of institutional billings', '%', 0.01, 'HYP', 'Accountant to set reserve method.'),
 ('attach_int', 'New institutions buying an integration package', '%', 0.40, 'HYP', 'SIS/LMS connectors scoped separately (PRICING-AND-PACKAGING.md).'),
 ('int_fee', 'Integration package fee', '$', 15000, 'HYP', ''),
 ('int_hours', 'Integration package delivery hours', 'hours', 110, 'HYP', 'Measure on the first integration.'),
 ('loaded_rate', 'Loaded implementation cost per hour', '$/hr', 85, 'HYP', '~$100k salary x 1.22 burden / ~1,430 productive hours.'),
 ('hrs_per_fte', 'Billable implementation hours per FTE per month', 'hours', 110, 'HYP', ''),
 ('comm_rate', 'Sales commission on new-logo bookings', '%', 0.08, 'HYP', 'Plan not designed; counsel/accountant review of commission accounting.'),

 ('## Add-on streams', None, None, None, None, None),
 ('ai_start', 'AI capacity add-on available from month', 'month', 20, 'HYP', ''),
 ('ai_attach', 'Annual institutions buying the AI add-on', '%', 0.40, 'HYP', ''),
 ('alu_start', 'Alumni module available from month', 'month', 30, 'HYP', 'Needs live annual customers first; no replacement claim before it is earned.'),
 ('alu_attach', 'Campus/System institutions buying alumni module', '%', 0.15, 'HYP', ''),
 ('career_start', 'Career/employer product sells from month', 'month', 25, 'HYP', 'Employment-law and anti-discrimination review first (PRO).'),
 ('career_acv', 'Employer account ACV', '$/yr', 4000, 'HYP', ''),
 ('career_churn', 'Employer account monthly churn', '%', 0.02, 'HYP', ''),
 ('mk_start', 'Marketplace opens from month', 'month', 31, 'HYP', 'ADVERTISING-AND-MONETIZATION-POLICY.md and provider governance must be mature first.'),
 ('mk_init', 'Marketplace providers at opening', 'providers', 40, 'HYP', ''),
 ('mk_adds', 'Marketplace provider adds per month', 'providers', 15, 'HYP', ''),
 ('mk_churn', 'Provider monthly churn', '%', 0.04, 'HYP', ''),
 ('mk_orders_pp', 'Orders per provider per month', 'orders', 6, 'HYP', ''),
 ('mk_aov', 'Average order value', '$', 45, 'HYP', ''),
 ('mk_take', 'Platform take rate on GMV', '%', 0.15, 'HYP', 'Net-vs-gross presentation (principal/agent) is an accountant determination.'),
 ('mk_dispute', 'Refund/dispute reserve, share of GMV', '%', 0.015, 'HYP', ''),
 ('mk_ts_order', 'Trust & safety cost per order', '$', 0.40, 'HYP', ''),

 ('## Infrastructure (variable, per monthly-active user, all classes)', None, None, None, None, None),
 ('infra_compute', 'Database + compute + functions', '$/MAU/mo', 0.030, 'VENDOR', 'Planning allowance. Verify against Supabase / Vercel plans at scale.'),
 ('gb_per_mau', 'Stored data per active user', 'GB', 0.40, 'HYP', 'Documents, media, attachments.'),
 ('storage_price', 'Object storage price', '$/GB-mo', 0.021, 'VENDOR', 'Verify.'),
 ('repl_factor', 'Storage multiplier for backups and DR copy', 'x', 2.0, 'HYP', 'RESTORE.md / DR posture.'),
 ('egress_gb', 'Data egress per active user', 'GB/mo', 0.50, 'HYP', ''),
 ('egress_price', 'Egress price', '$/GB', 0.09, 'VENDOR', 'Verify.'),
 ('cdn_offload', 'Share of egress absorbed by CDN cache', '%', 0.50, 'HYP', ''),
 ('search_per_mau', 'Search + vector index', '$/MAU/mo', 0.012, 'VENDOR', ''),
 ('notif_per_mau', 'Email / push / SMS notifications', '$/MAU/mo', 0.020, 'VENDOR', ''),
 ('obs_per_mau', 'Observability and logging', '$/MAU/mo', 0.010, 'VENDOR', ''),

 ('## AI inference', None, None, None, None, None),
 ('in_h', 'Haiku 4.5 input price', '$/M tok', 1.00, 'FACT', 'Anthropic first-party API price table, cached 2026-09-25.'),
 ('out_h', 'Haiku 4.5 output price', '$/M tok', 5.00, 'FACT', ''),
 ('in_s', 'Sonnet 5.5 input price', '$/M tok', 2.00, 'FACT', ''),
 ('out_s', 'Sonnet 5.5 output price', '$/M tok', 10.00, 'FACT', ''),
 ('in_o', 'Opus 5.5 input price', '$/M tok', 4.00, 'FACT', ''),
 ('out_o', 'Opus 5.5 output price', '$/M tok', 20.00, 'FACT', ''),
 ('mix_h', 'Request share routed to Haiku class', '%', 0.70, 'HYP', 'Routing policy: classification and extraction on the small model.'),
 ('mix_s', 'Request share routed to Sonnet class', '%', 0.28, 'HYP', ''),
 ('mix_o', 'Request share routed to Opus class', '%', 0.02, 'HYP', ''),
 ('tok_in', 'Input tokens per request (incl. retrieved context)', 'tokens', 6000, 'HYP', 'Measure from usage.ts / private.ai_usage_month.'),
 ('tok_out', 'Output tokens per request', 'tokens', 700, 'HYP', ''),
 ('think_mult', 'Output multiplier for reasoning tokens', 'x', 1.5, 'HYP', ''),
 ('cache_share', 'Share of input that is cacheable prefix', '%', 0.50, 'HYP', ''),
 ('cache_hit', 'Cache hit rate on cacheable prefix', '%', 0.70, 'HYP', ''),
 ('cache_read', 'Cache read price as share of input price', '%', 0.10, 'FACT', 'Sonnet 5.5 $0.20 vs $2.00; blended.'),
 ('ai_overhead', 'Embeddings, retrieval, moderation overhead on top of inference', '%', 0.15, 'HYP', ''),
 ('req_free', 'AI requests per free active user per month (capped)', 'req', 10, 'HYP', 'Free-tier cap is a product decision.'),
 ('req_paid', 'AI requests per paying user per month', 'req', 45, 'HYP', ''),
 ('req_inst', 'AI requests per institution-sponsored active user per month', 'req', 20, 'HYP', ''),

 ('## Integrations, support', None, None, None, None, None),
 ('conn_cost', 'Connector / iPaaS cost per integrated institution', '$/mo', 300, 'VENDOR', ''),
 ('conn_attach', 'Institutions with a live connector', '%', 0.60, 'HYP', ''),
 ('sso_cost', 'SSO / SCIM cost per institution connection', '$/mo', 125, 'VENDOR', 'Verify the identity vendor price per connection.'),
 ('tk_c', 'Support tickets per 100 consumer MAU per month', 'tickets', 2.5, 'HYP', 'Support contact rate is a defined measure; no reading yet.'),
 ('tk_i', 'Support tickets per 100 institutional MAU per month', 'tickets', 3.5, 'HYP', ''),
 ('overflow_share', 'Tickets handled by outsourced tier-1 overflow', '%', 0.25, 'HYP', ''),
 ('overflow_cost', 'Cost per overflow ticket', '$', 5.00, 'HYP', ''),

 ('## People and overhead', None, None, None, None, None),
 ('burden', 'Payroll burden (taxes, benefits, workers comp)', '%', 0.22, 'PRO', 'PEO / benefits broker and payroll provider to confirm.'),
 ('sw_per_fte', 'Software and tools per FTE', '$/mo', 400, 'HYP', ''),
 ('rent_per_fte', 'Workspace per FTE', '$/mo', 350, 'HYP', 'Hybrid / coworking.'),
 ('train_per_fte', 'Training per FTE', '$/mo', 100, 'HYP', ''),
 ('recruit_per_hire', 'Recruiting cost per hire (month 2 onward)', '$', 9000, 'HYP', 'Agency or referral mix.'),
 ('equip_per_hire', 'Equipment per hire', '$', 2800, 'HYP', ''),
 ('contingency', 'Contingency on non-payroll operating lines', '%', 0.05, 'HYP', ''),
 ('capital_available', 'Cash available at start (ILLUSTRATIVE, not a plan)', '$', 3000000, 'ILLUS', 'Used only to show a cash-out month. Set to the real figure.'),

 ('## Incident scenario (applies only when the scenario switch is on)', None, None, None, None, None),
 ('inc_month', 'Month the SEV-0 incident occurs', 'month', 14, 'HYP', 'Cross-tenant exposure or confirmed data breach (CRISIS-RESPONSE-RUNBOOK.md).'),
 ('inc_forensics', 'Forensics and incident-response retainer', '$', 120000, 'PRO', 'Quote from IR firm / cyber insurer panel.'),
 ('inc_counsel', 'Outside counsel and notification letters', '$', 150000, 'PRO', ''),
 ('inc_records', 'People whose records are affected', 'people', 25000, 'HYP', ''),
 ('inc_notify', 'Notification, call center and monitoring per person', '$', 6.00, 'PRO', 'Verify with insurer / vendor quote.'),
 ('inc_regulatory', 'Regulatory and contractual response', '$', 100000, 'PRO', ''),
 ('inc_remediation', 'Emergency remediation engineering (contractors)', '$', 180000, 'HYP', ''),
 ('inc_recovery', 'Insurance recovery counted', '$', 0, 'PRO', 'Zero until the policy, retention and exclusions are confirmed with the broker.'),
 ('inc_credit_pct', 'Service credits to institutions, share of core ARR (one month)', '%', 0.05, 'HYP', 'Contract-dependent.'),
 ('inc_student_churn', 'Extra monthly churn on paid students for 3 months after', '%', 0.06, 'HYP', ''),
 ('inc_rr_hit', 'Cut to institutional renewal rate for renewals in the next 12 months', '%', 0.15, 'HYP', ''),
 ('inc_pilot_mult', 'Multiplier on new pilot/direct starts for 6 months after', 'x', 0.40, 'HYP', ''),
]

TIERS = ['D', 'C', 'Y']
TIER_NAMES = {'D': 'Department', 'C': 'Campus', 'Y': 'System'}
# per-tier scalars: key -> (label, unit, {D,C,Y}, tag, note)
TIER_ASSUMPTIONS = [
 ('acv', 'List annual platform ACV', '$/yr', (30000, 85000, 220000), 'POLICY', 'Set just above the deal-desk minimums ($25k / $75k / $200k).'),
 ('pilotfee', 'Pilot software fee (26 weeks)', '$', (15000, 30000, 60000), 'POLICY', 'Department equals the $15k pilot minimum; D-134 fixes 26 weeks.'),
 ('impl', 'Implementation fee', '$', (15000, 40000, 100000), 'POLICY', 'Above the $10k implementation-fee floor.'),
 ('hours', 'Standard implementation hours', 'hours', (115, 330, 800), 'HYP', 'Measure on the first pilot.'),
 ('students', 'Active students per fully rolled-out account', 'users', (600, 2500, 9000), 'HYP', ''),
 ('credit', 'Pilot credit applied at conversion', '$', (7500, 15000, 30000), 'POLICY', '50% of the pilot software fee: the deal-desk maximum.'),
 ('rho', 'Pilot-to-annual conversion', '%', (0.50, 0.45, 0.40), 'HYP', 'Defined measure; no pilot has run.'),
 ('ai_price', 'AI capacity add-on, annual', '$/yr', (6000, 18000, 45000), 'HYP', ''),
]
ALUMNI_PRICE = {'D': 0, 'C': 12000, 'Y': 25000}

# per-year tables --------------------------------------------------------
# (key, label, unit, (y1,y2,y3), tag, note)
ANNUAL = [
 ('## Volume drivers', None, None, None, None, None),
 ('g', 'Organic growth, monthly compounding', '%/mo', (0.06, 0.04, 0.025), 'HYP', ''),
 ('paid_budget', 'Paid student acquisition TEST budget', '$/mo', (1000, 3000, 5000), 'HYP', 'A test budget, not a scaling plan: released in tranches only against a measured cost per paying subscriber (see 05).'),
 ('infra_fixed', 'Fixed platform infrastructure (prod, staging, DR, tooling)', '$/mo', (4000, 9000, 16000), 'VENDOR', ''),
 ('ai_fixed', 'AI evaluation, red-team and monitoring runs', '$/mo', (2000, 3000, 5000), 'HYP', 'AI-RECOMMENDATION-EVALUATION-HARNESS.md.'),
 ('## Security, privacy, accessibility programs ($/yr)', None, None, None, None, None),
 ('sec_pentest', 'Penetration test', '$/yr', (25000, 40000, 60000), 'VENDOR', 'Quote required.'),
 ('sec_soc2', 'SOC 2 readiness, tooling and audit', '$/yr', (50000, 55000, 65000), 'VENDOR', 'Auditor and platform quotes required.'),
 ('sec_a11y', 'Accessibility audit, VPAT/ACR', '$/yr', (20000, 25000, 25000), 'VENDOR', ''),
 ('sec_grc', 'GRC and security tooling', '$/yr', (18000, 30000, 45000), 'VENDOR', ''),
 ('sec_privacy', 'Privacy assessments, HECVAT upkeep', '$/yr', (5000, 10000, 15000), 'HYP', ''),
 ('sec_bounty', 'Bug bounty', '$/yr', (0, 10000, 25000), 'HYP', ''),
 ('## Legal and insurance ($/yr)', None, None, None, None, None),
 ('legal_retainer', 'Outside counsel (privacy, contracts, student data, employment)', '$/yr', (60000, 90000, 130000), 'PRO', 'Counsel quote required; LEGAL-REVIEW-QUEUE.md.'),
 ('legal_ip', 'Trademark and IP', '$/yr', (10000, 12000, 15000), 'PRO', ''),
 ('legal_contracts', 'Contract templates, DPA playbook build', '$/yr', (25000, 10000, 10000), 'PRO', ''),
 ('ins_cyber', 'Cyber + tech E&O', '$/yr', (28000, 48000, 85000), 'PRO', 'Broker quote; student-data limits drive premium.'),
 ('ins_gl', 'General liability and property', '$/yr', (5000, 7000, 10000), 'PRO', ''),
 ('ins_do', 'Directors and officers', '$/yr', (8000, 15000, 25000), 'PRO', ''),
 ('## Finance and administration ($/yr)', None, None, None, None, None),
 ('acct', 'Bookkeeping, tax preparation, payroll', '$/yr', (36000, 50000, 70000), 'HYP', ''),
 ('audit', 'Financial statement review or audit', '$/yr', (0, 25000, 45000), 'PRO', 'Needed for institutional diligence and investors.'),
 ('finsys', 'Billing, spend management, FP&A systems', '$/yr', (12000, 24000, 36000), 'VENDOR', ''),
 ('travel_int', 'Internal travel and offsites', '$/yr', (10000, 20000, 30000), 'HYP', ''),
 ('## Sales and marketing ($/yr)', None, None, None, None, None),
 ('sales_tools', 'CRM, data, sales tooling', '$/yr', (10000, 25000, 45000), 'VENDOR', ''),
 ('events', 'Conferences and events', '$/yr', (25000, 50000, 80000), 'HYP', ''),
 ('travel_sales', 'Sales travel (campus visits)', '$/yr', (20000, 45000, 80000), 'HYP', ''),
 ('rfp', 'RFP / procurement response support', '$/yr', (5000, 10000, 15000), 'HYP', ''),
 ('mk_brand', 'Brand, website, content', '$/yr', (30000, 60000, 100000), 'HYP', ''),
 ('mk_amb', 'Campus ambassador program stipends', '$/yr', (12000, 36000, 72000), 'HYP', 'Tax and employment classification: PRO.'),
 ('mk_pr', 'PR and community events', '$/yr', (10000, 25000, 40000), 'HYP', ''),
 ('mk_ux', 'User research incentives', '$/yr', (6000, 12000, 18000), 'HYP', ''),
]

# -------------------------------------------------------------- derived
DERIVED = [   # (key, label, unit, expr, note)
 ('p_in', 'Blended input price', '$/M tok', P('mix_h') * P('in_h') + P('mix_s') * P('in_s') + P('mix_o') * P('in_o'), 'Formula.'),
 ('p_out', 'Blended output price', '$/M tok', P('mix_h') * P('out_h') + P('mix_s') * P('out_s') + P('mix_o') * P('out_o'), 'Formula.'),
 ('ai_cpr', 'AI cost per request (before scenario multipliers)', '$/req',
  ((P('tok_in') / 1e6) * P('p_in') * (1 - P('cache_share') * P('cache_hit') * (1 - P('cache_read')))
   + (P('tok_out') / 1e6) * P('p_out') * P('think_mult')) * (1 + P('ai_overhead')), 'Formula.'),
]

SCENARIOS = [  # key, label
 ('cons', 'Conservative'), ('base', 'Base'), ('aggr', 'Aggressive'),
 ('entdel', 'Enterprise-delayed'), ('hiai', 'High AI cost'), ('inc', 'Incident (SEV-0, month 14)'),
 ('entgate', 'Enterprise-delayed, gated hiring (mitigation)'),
 ('full', 'Full-scope staffing (CTO pack S1-S4), Base revenue'),
]
# parameter: (key, label, unit, values in SCENARIOS order, note)
SCEN_PARAMS = [
 ('acq', 'Organic student acquisition multiplier', 'x', (0.6, 1, 1.5, 1, 1, 1, 1, 1), ''),
 ('conv', 'Free-to-paid conversion multiplier', 'x', (0.8, 1, 1.2, 1, 1, 1, 1, 1), ''),
 ('churn', 'Churn multiplier (students and institutions)', 'x', (1.25, 1, 0.85, 1, 1, 1, 1, 1), ''),
 ('inst', 'Pilot and direct-deal volume multiplier', 'x', (0.6, 1, 1.4, 1, 1, 1, 1, 1), ''),
 ('pc', 'Pilot-to-annual conversion multiplier', 'x', (0.8, 1, 1.1, 0.9, 1, 1, 0.9, 1), ''),
 ('delay', 'Institutional gates slip by (months)', 'months', (2, 0, -2, 6, 0, 0, 6, 0), 'Slips (negative = earlier) the paid-pilot, direct and enterprise gates (and design-partner conversion).'),
 ('price', 'Institutional price realization multiplier', 'x', (0.95, 1, 1, 1, 1, 1, 1, 1), ''),
 ('cac', 'Paid acquisition cost multiplier', 'x', (1.25, 1, 0.85, 1, 1, 1, 1, 1), ''),
 ('ai_unit', 'AI unit cost multiplier (price or model-mix shift)', 'x', (1, 1, 1, 1, 2.5, 1, 1, 1), ''),
 ('ai_use', 'AI usage multiplier (requests per user)', 'x', (1, 1, 1, 1, 1.5, 1, 1, 1), ''),
 ('inc', 'Incident switch (1 = on)', '0/1', (0, 0, 0, 0, 0, 1, 0, 0), ''),
 ('hire_delay', 'Delay for gated hires (months)', 'months', (0, 0, 0, 0, 0, 0, 6, 0), 'Mitigation lever: sales, implementation, CS, partnerships roles wait for the evidence gate.'),
 ('fullscope', 'Full-scope staffing switch (1 = include the CTO-pack staffing roles)', '0/1', (0, 0, 0, 0, 0, 0, 0, 1), 'Same revenue as Base; costs the staffing plan proposed in docs/target-architecture/08.'),
]

# --------------------------------------------------------------- headcount
# id, role, fn, fte, start month, base salary, gated
HEADCOUNT = [
 ('GA-1', 'CEO / founder', 'GA', 1, 1, 90000, 0, 0),
 ('GA-2', 'Fractional CFO / controller (0.4 FTE)', 'GA', 0.4, 1, 150000, 0, 0),
 ('GA-3', 'Compliance and privacy manager', 'GA', 1, 9, 125000, 0, 0),
 ('GA-4', 'Finance and RevOps manager', 'GA', 1, 15, 120000, 0, 0),
 ('GA-5', 'Executive operations / people', 'GA', 1, 24, 85000, 0, 0),
 ('EN-1', 'CTO / co-founder', 'ENG', 1, 1, 110000, 0, 0),
 ('EN-2', 'Senior engineers (platform, web)', 'ENG', 2, 1, 150000, 0, 0),
 ('EN-3', 'Data / AI engineer', 'ENG', 1, 5, 160000, 0, 0),
 ('EN-4', 'Senior engineer', 'ENG', 1, 6, 150000, 0, 0),
 ('EN-5', 'Mobile engineer (iOS / Android, offline sync)', 'ENG', 1, 9, 145000, 0, 0),
 ('EN-6', 'Senior engineer', 'ENG', 1, 13, 150000, 0, 0),
 ('EN-7', 'SRE / DevOps', 'ENG', 1, 14, 150000, 0, 0),
 ('EN-8', 'QA / SDET', 'ENG', 1, 20, 110000, 0, 0),
 ('EN-9', 'Senior engineer', 'ENG', 1, 26, 150000, 0, 0),
 ('PR-1', 'Product designer', 'PROD', 1, 3, 130000, 0, 0),
 ('PR-2', 'Product manager', 'PROD', 1, 4, 140000, 0, 0),
 ('PR-3', 'Accessibility specialist', 'PROD', 1, 10, 115000, 0, 0),
 ('SE-1', 'Security engineer', 'SEC', 1, 7, 150000, 0, 0),
 ('SU-1', 'Support specialist', 'SUPPORT', 1, 9, 62000, 0, 0),
 ('SU-2', 'Support lead', 'SUPPORT', 1, 18, 85000, 0, 0),
 ('SU-3', 'Support specialist', 'SUPPORT', 1, 26, 62000, 0, 0),
 ('SU-4', 'Support specialist', 'SUPPORT', 1, 33, 62000, 0, 0),
 ('IM-1', 'Implementation engineer', 'IMPL', 1, 5, 100000, 1, 0),
 ('IM-2', 'Implementation engineer', 'IMPL', 1, 11, 100000, 1, 0),
 ('IM-3', 'Implementation engineer', 'IMPL', 1, 15, 100000, 1, 0),
 ('IM-4', 'Implementation engineer', 'IMPL', 1, 19, 100000, 1, 0),
 ('IM-5', 'Implementation engineer', 'IMPL', 1, 22, 100000, 1, 0),
 ('IM-6', 'Implementation engineer', 'IMPL', 1, 25, 100000, 1, 0),
 ('IM-7', 'Implementation engineer', 'IMPL', 1, 28, 100000, 1, 0),
 ('IM-8', 'Implementation engineer', 'IMPL', 1, 31, 100000, 1, 0),
 ('CS-1', 'Customer success manager', 'CS', 1, 18, 100000, 1, 0),
 ('CS-2', 'Customer success manager', 'CS', 1, 30, 100000, 1, 0),
 ('TS-1', 'Trust and safety / marketplace moderation', 'TS', 1, 32, 70000, 1, 0),
 ('SA-1', 'Account executive', 'SALES', 1, 11, 110000, 1, 0),
 ('SA-2', 'Sales engineer', 'SALES', 1, 13, 130000, 1, 0),
 ('SA-3', 'Account executive', 'SALES', 1, 22, 110000, 1, 0),
 ('SA-4', 'Partnerships / marketplace manager', 'SALES', 1, 28, 110000, 1, 0),
 ('MK-1', 'Growth and lifecycle marketing manager', 'MKT', 1, 6, 105000, 0, 0),
 ('MK-2', 'Campus program coordinator', 'MKT', 1, 12, 65000, 0, 0),
 ('MK-3', 'Content and social', 'MKT', 1, 20, 85000, 0, 0),
# --- extras: present only in the full-scope staffing scenario (CTO pack docs/target-architecture/08, stages S1-S4) ---
 ('X-01', 'Senior platform / SRE engineer (CTO pack S1)', 'ENG', 1, 2, 150000, 0, 1),
 ('X-02', 'Sync and offline engineer', 'ENG', 1, 6, 150000, 0, 1),
 ('X-03', 'Integrations engineer (LTI / SIS / SCIM)', 'ENG', 1, 7, 150000, 0, 1),
 ('X-04', 'Integrations engineer', 'ENG', 1, 10, 150000, 0, 1),
 ('X-05', 'AI platform engineer', 'ENG', 1, 10, 160000, 0, 1),
 ('X-06', 'Mobile engineer', 'ENG', 1, 11, 145000, 0, 1),
 ('X-07', 'Accessibility engineer', 'ENG', 1, 11, 140000, 0, 1),
 ('X-08', 'Domain engineer: academic', 'ENG', 1, 12, 150000, 0, 1),
 ('X-09', 'Product designer', 'PROD', 1, 12, 130000, 0, 1),
 ('X-10', 'Data engineer', 'ENG', 1, 13, 160000, 0, 1),
 ('X-11', 'Domain engineer: finance and commerce', 'ENG', 1, 13, 150000, 0, 1),
 ('X-12', 'Engineering manager', 'ENG', 1, 14, 190000, 0, 1),
 ('X-13', 'Domain engineer: campus and community', 'ENG', 1, 14, 150000, 0, 1),
 ('X-14', 'Product designer', 'PROD', 1, 15, 130000, 0, 1),
 ('X-15', 'Domain engineer: career', 'ENG', 1, 16, 150000, 0, 1),
 ('X-16', 'Domain engineer: academic', 'ENG', 1, 19, 150000, 0, 1),
 ('X-17', 'Domain engineer: learning', 'ENG', 1, 21, 150000, 0, 1),
 ('X-18', 'Staff / principal engineer', 'ENG', 1, 21, 190000, 0, 1),
 ('X-19', 'Engineering manager', 'ENG', 1, 22, 190000, 0, 1),
 ('X-20', 'Security engineer', 'SEC', 1, 23, 150000, 0, 1),
 ('X-21', 'Domain engineer: family and guardian', 'ENG', 1, 24, 150000, 0, 1),
 ('X-22', 'Data / analytics engineer', 'ENG', 1, 24, 160000, 0, 1),
 ('X-23', 'Product designer', 'PROD', 1, 25, 130000, 0, 1),
 ('X-24', 'Domain engineer', 'ENG', 1, 26, 150000, 0, 1),
 ('X-25', 'Staff / principal engineer', 'ENG', 1, 27, 190000, 0, 1),
 ('X-26', 'Security engineer', 'SEC', 1, 28, 150000, 0, 1),
 ('X-27', 'Domain engineer', 'ENG', 1, 32, 150000, 0, 1),
 ('X-28', 'Staff / principal engineer', 'ENG', 1, 33, 190000, 0, 1),
 ('X-29', 'Domain engineer', 'ENG', 1, 34, 150000, 0, 1),
 ('X-30', 'Data / analytics engineer', 'ENG', 1, 35, 160000, 0, 1),
]

FN_LABEL = {'GA': 'G&A', 'ENG': 'Engineering', 'PROD': 'Product, design, accessibility', 'SEC': 'Security',
            'SUPPORT': 'Support (COGS)', 'IMPL': 'Implementation (COGS)', 'CS': 'Customer success (COGS)',
            'TS': 'Trust & safety (COGS)', 'SALES': 'Sales & partnerships', 'MKT': 'Marketing'}

SEASON = [1.3, 1.1, 0.9, 0.8, 0.6, 0.5, 0.7, 1.6, 1.8, 1.1, 0.9, 0.7]   # sums to 12

# monthly schedules from quarterly counts (placed in the middle month of the quarter)
def q2m(q):
    out = [0.0] * 36
    for i, v in enumerate(q):
        out[i * 3 + 1] = float(v)
    return out

SCHEDULES = [  # key, label, monthly values, note.  Gated schedules: month 1 = the month their gate opens.
 ('pilot_D', 'Paid pilot starts, Department (month 1 = gate_pilot)', q2m([1,1,2,2, 3,3,3,4, 4,4,5,5]), 'Expected values; fractions arise after multipliers.'),
 ('pilot_C', 'Paid pilot starts, Campus (month 1 = gate_pilot)', q2m([0,1,1,1, 1,2,2,2, 2,3,3,3]), ''),
 ('pilot_Y', 'Paid pilot starts, System (month 1 = gate_ent)', q2m([0,1,0,1, 1,1,1,1, 1,1,1,1]), ''),
 ('direct_D', 'Direct annual starts, Department (month 1 = gate_direct)', q2m([1,1,2,2, 3,3,3,3, 3,3,3,3]), 'No pilot first: reference customers only.'),
 ('direct_C', 'Direct annual starts, Campus (month 1 = gate_direct)', q2m([0,1,1,1, 2,2,2,2, 2,2,2,2]), ''),
 ('direct_Y', 'Direct annual starts, System (month 1 = gate_ent)', q2m([0,0,0,1, 1,1,1,1, 1,1,1,1]), ''),
 ('dp_D', 'Unpaid design-partner pilot starts, Department (absolute month)', q2m([0,1,0,0, 0,0,0,0, 0,0,0,0]), 'Month 5. Activation needs GO priorities 1-8; no fee, no live-claim.'),
 ('dp_C', 'Unpaid design-partner pilot starts, Campus (absolute month)', q2m([0,0,1,0, 0,0,0,0, 0,0,0,0]), 'Month 8.'),
 ('dp_Y', 'Unpaid design-partner pilot starts, System (absolute month)', [0.0] * 36, 'None planned.'),
 ('career_adds', 'Employer accounts added (absolute month)', [0.0] * 24 + [3.0] * 6 + [6.0] * 6, 'Starts at career_start.'),
]


# ------------------------------------------------------------------- rows
class RowDef:
    def __init__(s, name, label, unit, kind, expr, fmt='n0', section=None):
        s.name, s.label, s.unit, s.kind, s.expr, s.fmt, s.section = name, label, unit, kind, expr, fmt, section


ROWS = []
KPIS = []


def sec(title):
    ROWS.append(RowDef(None, title, None, 'section', None, section=title))


def row(name, label, unit, kind, expr, fmt='n0'):
    ROWS.append(RowDef(name, label, unit, kind, expr, fmt))


def kpi(name, label, unit, expr, fmt='n0'):
    KPIS.append(RowDef(name, label, unit, 'kpi', expr, fmt))


def tier_p(key, k):
    return P(f'{key}_{k}')


# ---- student ----
sec('Student subscription: funnel and subscribers')
row('org_trend', 'Organic signup trend (pre-seasonality)', 'users', 'rate', If(T().eq(1), P('organic_start'), Row('org_trend', -1) * (1 + PY('g'))))
row('signups_org', 'Organic + campus-led free signups', 'users', 'flow', Row('org_trend') * Seas() * S('acq') * If(T() < P('gate_plus'), P('pre_gate_share'), 1))
row('signups_paid', 'Paid-acquisition free signups', 'users', 'flow', If(T() >= P('gate_plus'), PY('paid_budget') / (P('cps') * S('cac')), 0))
row('new_active', 'New monthly-active free users', 'users', 'flow', (Row('signups_org') + Row('signups_paid')) * P('activation'))
row('conv_new', 'New paying subscribers (conversions)', 'users', 'flow', If(T() >= P('gate_plus'), P('conv') * S('conv') * Row('free', -1), 0))
row('free', 'Active free users (end of month)', 'users', 'stock', Max(0, Row('free', -1) * (1 - P('free_churn')) + Row('new_active') - Row('conv_new')))
row('inc_churn_add', 'Incident: extra monthly paid churn', '%', 'rate', If(And(S('inc').eq(1), T() >= P('inc_month') + 1, T() <= P('inc_month') + 3), P('inc_student_churn'), 0), 'p1')
row('churn_m_eff', 'Effective monthly plan churn', '%', 'rate', Min(1, P('churn_m') * S('churn') + Row('inc_churn_add')), 'p1')
row('new_m', 'New monthly-plan subscribers', 'users', 'flow', Row('conv_new') * (1 - P('annual_mix')))
row('new_a', 'New annual-plan subscribers', 'users', 'flow', Row('conv_new') * P('annual_mix'))
row('paid_m', 'Monthly-plan subscribers (end)', 'users', 'stock', Row('paid_m', -1) * (1 - Row('churn_m_eff')) + Row('new_m'))
row('renew_a_eff', 'Effective annual renewal rate', '%', 'rate', Max(0, 1 - (1 - P('renew_a')) * S('churn')), 'p1')
row('ann_renew', 'Annual renewals this month', 'users', 'flow', Row('renew_a_eff') * Row('ann_starts', -12))
row('ann_starts', 'Annual plan starts (new + renewals)', 'users', 'flow', Row('new_a') + Row('ann_renew'))
row('paid_a', 'Annual-plan subscribers (end)', 'users', 'stock', SumRow('ann_starts', -11, 0))
row('paid_total', 'Paying subscribers (end)', 'users', 'stock', Row('paid_m') + Row('paid_a'))
row('paid_churned', 'Subscribers lost (churn + non-renewal)', 'users', 'flow', Row('paid_total', -1) + Row('conv_new') - Row('paid_total'))
row('stud_bill', 'Student billings (net of refunds)', '$', 'flow',
    (P('price_m') * (1 - P('stud_disc')) * Row('paid_m') + P('price_a') * (1 - P('stud_disc')) * Row('ann_starts')) * (1 - P('refund')))
row('stud_rev', 'Student subscription revenue', '$', 'flow',
    (P('price_m') * (1 - P('stud_disc')) * Row('paid_m') + P('price_a') * (1 - P('stud_disc')) / 12 * Row('paid_a')) * (1 - P('refund')))

# ---- institutions ----
sec('Institutional platform: pilots, contracts, logos')
row('pm', 'Incident: multiplier on new starts', 'x', 'rate', If(And(S('inc').eq(1), T() >= P('inc_month') + 1, T() <= P('inc_month') + 6), P('inc_pilot_mult'), 1), 'n2')
row('rr_eff', 'Effective gross logo renewal rate', '%', 'rate',
    Max(0, 1 - (1 - P('rr_i')) * S('churn') - If(And(S('inc').eq(1), T() >= P('inc_month'), T() <= P('inc_month') + 11), P('inc_rr_hit'), 0)), 'p1')
GATE_FOR = {'D': 'gate_pilot', 'C': 'gate_pilot', 'Y': 'gate_ent'}
GATE_DIRECT = {'D': 'gate_direct', 'C': 'gate_direct', 'Y': 'gate_ent'}
for k in TIERS:
    n = TIER_NAMES[k]
    row(f'paidpilot_start_{k}', f'Paid pilot starts, {n}', 'accts', 'flow', Sched(f'pilot_{k}', GATE_FOR[k]) * S('inst') * Row('pm'), 'n2')
    row(f'dp_start_{k}', f'Unpaid design-partner pilot starts, {n}', 'accts', 'flow', Sched(f'dp_{k}'), 'n2')
    row(f'pilot_start_{k}', f'All pilot starts, {n}', 'accts', 'flow', Row(f'paidpilot_start_{k}') + Row(f'dp_start_{k}'), 'n2')
    row(f'direct_start_{k}', f'Direct annual starts, {n}', 'accts', 'flow', Sched(f'direct_{k}', GATE_DIRECT[k]) * S('inst') * Row('pm'), 'n2')
    row(f'newinst_{k}', f'New billable institutions (paid pilot or direct), {n}', 'accts', 'flow', Row(f'paidpilot_start_{k}') + Row(f'direct_start_{k}'), 'n2')
    row(f'pilots_active_{k}', f'Pilots running (paid + unpaid), {n}', 'accts', 'stock', SumRow(f'pilot_start_{k}', -5, 0), 'n2')
    row(f'paidpilots_active_{k}', f'Paid pilots running, {n}', 'accts', 'stock', SumRow(f'paidpilot_start_{k}', -5, 0), 'n2')
    row(f'conv_paid_{k}', f'Paid pilots converting to annual, {n}', 'accts', 'flow', P(f'rho_{k}') * S('pc') * Row(f'paidpilot_start_{k}', -7), 'n2')
    gate_eff = P(GATE_FOR[k]) + S('delay')
    row(f'conv_dp_{k}', f'Design partners converting to annual, {n}', 'accts', 'flow',
        P('dp_rho') * S('pc') * If(T().eq(gate_eff), SumRow(f'dp_start_{k}', -35, -7), If(T() > gate_eff, Row(f'dp_start_{k}', -7), 0)), 'n2')
    row(f'n_{k}', f'New annual contracts, {n}', 'accts', 'flow', Row(f'conv_paid_{k}') + Row(f'conv_dp_{k}') + Row(f'direct_start_{k}'), 'n2')
    row(f'ast_{k}', f'Annual contract starts (new + renewals), {n}', 'accts', 'flow', Row(f'n_{k}') + Row('rr_eff') * Row(f'ast_{k}', -12), 'n2')
    row(f'L_{k}', f'Annual logos active, {n}', 'accts', 'stock', SumRow(f'ast_{k}', -11, 0), 'n2')
    row(f'acv_{k}', f'Net ACV per new contract, {n}', '$', 'rate', P(f'acv_{k}') * (1 - P('inst_disc')) * S('price'))
    row(f'SV_{k}', f'Contract value started or renewed, {n}', '$', 'flow', Row(f'n_{k}') * Row(f'acv_{k}') + Row('rr_eff') * (1 + P('expansion')) * Row(f'SV_{k}', -12))
    row(f'credit_{k}', f'Pilot credit given at conversion, {n}', '$', 'flow', P(f'credit_{k}') * Row(f'conv_paid_{k}'))
    row(f'core_rev_{k}', f'Platform subscription revenue, {n}', '$', 'flow', (SumRow(f'SV_{k}', -11, 0) - SumRow(f'credit_{k}', -11, 0)) / 12)
    row(f'core_bill_{k}', f'Platform billings, {n}', '$', 'flow', Row(f'SV_{k}') - Row(f'credit_{k}'))
    row(f'pilot_rev_{k}', f'Pilot software revenue, {n}', '$', 'flow', P(f'pilotfee_{k}') * S('price') / 6 * Row(f'paidpilots_active_{k}'))
    row(f'pilot_bill_{k}', f'Pilot billings, {n}', '$', 'flow', P(f'pilotfee_{k}') * S('price') * Row(f'paidpilot_start_{k}'))
    row(f'svc_unit_{k}', f'Services fee per new billable institution, {n}', '$', 'rate', P(f'impl_{k}') * S('price') + P('attach_int') * P('int_fee'))
    row(f'svc_rev_{k}', f'Implementation services revenue, {n}', '$', 'flow', Row(f'svc_unit_{k}') / 3 * SumRow(f'newinst_{k}', -2, 0))
    row(f'svc_bill_{k}', f'Implementation billings, {n}', '$', 'flow', Row(f'svc_unit_{k}') * Row(f'newinst_{k}'))
    row(f'hours_{k}', f'Implementation hours demanded, {n}', 'hours', 'flow',
        Row(f'dp_start_{k}') * P(f'hours_{k}') + Row(f'newinst_{k}') * (P(f'hours_{k}') + P('attach_int') * P('int_hours')))

sec('Institutional totals')
def tsum(fmt): 
    e = None
    for k in TIERS:
        x = Row(fmt.format(k=k))
        e = x if e is None else e + x
    return e
row('pilot_start', 'All pilot starts', 'accts', 'flow', tsum('pilot_start_{k}'), 'n2')
row('paidpilot_start', 'Paid pilot starts', 'accts', 'flow', tsum('paidpilot_start_{k}'), 'n2')
row('dp_start', 'Unpaid design-partner pilot starts', 'accts', 'flow', tsum('dp_start_{k}'), 'n2')
row('direct_start', 'Direct annual starts', 'accts', 'flow', tsum('direct_start_{k}'), 'n2')
row('newinst', 'New billable institutions (paid pilot or direct)', 'accts', 'flow', tsum('newinst_{k}'), 'n2')
row('n_total', 'New annual contracts', 'accts', 'flow', tsum('n_{k}'), 'n2')
row('logos', 'Annual logos active', 'accts', 'stock', tsum('L_{k}'), 'n1')
row('pilots_active', 'Pilots running (paid + unpaid)', 'accts', 'stock', tsum('pilots_active_{k}'), 'n1')
row('core_rev_pre', 'Platform subscription revenue before incident credits', '$', 'flow', tsum('core_rev_{k}'))
row('inc_credit', 'Incident service credits (contra-revenue, cash refund)', '$', 'flow', If(And(S('inc').eq(1), T().eq(P('inc_month') + 1)), P('inc_credit_pct') * 12 * Row('core_rev_pre'), 0))
row('IA', 'Institution-sponsored active students', 'users', 'stock',
    P('students_D') * (Row('L_D') + P('pilot_share') * Row('pilots_active_D'))
    + P('students_C') * (Row('L_C') + P('pilot_share') * Row('pilots_active_C'))
    + P('students_Y') * (Row('L_Y') + P('pilot_share') * Row('pilots_active_Y')))
row('core_rev', 'Platform subscription revenue', '$', 'flow', Row('core_rev_pre') - Row('inc_credit'))
row('core_bill', 'Platform billings', '$', 'flow', tsum('core_bill_{k}') - Row('inc_credit'))
row('pilot_rev', 'Pilot software revenue', '$', 'flow', tsum('pilot_rev_{k}'))
row('pilot_bill', 'Pilot billings', '$', 'flow', tsum('pilot_bill_{k}'))
row('svc_rev', 'Implementation services revenue', '$', 'flow', tsum('svc_rev_{k}'))
row('svc_bill', 'Implementation billings', '$', 'flow', tsum('svc_bill_{k}'))
row('hours_total', 'Implementation hours demanded', 'hours', 'flow', tsum('hours_{k}'))
row('bookings', 'New-logo bookings (pilot + services + first-year ACV)', '$', 'flow',
    Row('pilot_bill') + Row('svc_bill') + Row('n_D') * Row('acv_D') + Row('n_C') * Row('acv_C') + Row('n_Y') * Row('acv_Y'))

sec('Add-on streams: AI capacity, alumni, career, marketplace')
row('ai_rev', 'AI capacity add-on revenue', '$', 'flow',
    If(T() >= P('ai_start'), P('ai_attach') * S('price') / 12 *
       (Row('L_D') * P('ai_price_D') + Row('L_C') * P('ai_price_C') + Row('L_Y') * P('ai_price_Y')), 0))
row('alumni_rev', 'Alumni module revenue', '$', 'flow',
    If(T() >= P('alu_start'), P('alu_attach') * S('price') / 12 * (Row('L_C') * ALUMNI_PRICE['C'] + Row('L_Y') * ALUMNI_PRICE['Y']), 0))
row('career_adds', 'Employer accounts added', 'accts', 'flow', If(T() >= P('career_start'), Sched('career_adds') * S('inst'), 0), 'n2')
row('employers', 'Employer accounts (end)', 'accts', 'stock', Row('employers', -1) * (1 - P('career_churn')) + Row('career_adds'), 'n1')
row('career_rev', 'Career / employer revenue', '$', 'flow', Row('employers') * P('career_acv') / 12)
row('mk_providers', 'Marketplace providers (end)', 'accts', 'stock',
    If(T() < P('mk_start'), 0, If(T().eq(P('mk_start')), P('mk_init') * S('acq'), Row('mk_providers', -1) * (1 - P('mk_churn')) + P('mk_adds') * S('acq'))), 'n1')
row('mk_orders', 'Marketplace orders', 'orders', 'flow', Row('mk_providers') * P('mk_orders_pp'))
row('mk_gmv', 'Marketplace GMV', '$', 'flow', Row('mk_orders') * P('mk_aov'))
row('mk_rev', 'Marketplace revenue (take rate, net presentation, PRO)', '$', 'flow', Row('mk_gmv') * P('mk_take'))

sec('Revenue, billings, cash collections')
row('rev_total', 'TOTAL REVENUE', '$', 'flow',
    Row('stud_rev') + Row('pilot_rev') + Row('core_rev') + Row('svc_rev') + Row('ai_rev') + Row('alumni_rev') + Row('career_rev') + Row('mk_rev'))
row('rec_rev', 'Recurring revenue (subscriptions + add-ons)', '$', 'flow',
    Row('stud_rev') + Row('core_rev') + Row('ai_rev') + Row('alumni_rev') + Row('career_rev'))
row('arr', 'ARR (recurring revenue x 12)', '$', 'stock', Row('rec_rev') * 12)
row('arr_inst', 'ARR, institutional (platform + add-ons)', '$', 'stock', (Row('core_rev') + Row('ai_rev') + Row('alumni_rev') + Row('career_rev')) * 12)
row('arr_student', 'ARR, student subscriptions', '$', 'stock', Row('stud_rev') * 12)
row('bill_total', 'TOTAL BILLINGS', '$', 'flow',
    Row('stud_bill') + Row('pilot_bill') + Row('core_bill') + Row('svc_bill') + Row('ai_rev') + Row('alumni_rev') + Row('career_rev') + Row('mk_rev'))
row('inst_bill', 'Billings on invoice terms (pilot, platform, services)', '$', 'flow', Row('pilot_bill') + Row('core_bill') + Row('svc_bill'))
row('collections', 'Cash collected', '$', 'flow',
    Row('stud_bill') + Row('ai_rev') + Row('alumni_rev') + Row('career_rev') + Row('mk_rev') + (1 - P('bad_debt')) * Row('inst_bill', -2))
row('deferred', 'Deferred revenue balance (billed, not yet recognized)', '$', 'stock', Row('deferred', -1) + Row('bill_total') - Row('rev_total'))
row('ar', 'Receivables, net of reserve (collection lag fixed at 2 months)', '$', 'stock',
    Row('ar', -1) + (1 - P('bad_debt')) * Row('inst_bill') - (1 - P('bad_debt')) * Row('inst_bill', -2))

# ---- costs ----
sec('Cost of revenue')
row('mau_all', 'Monthly-active users, all classes', 'users', 'stock', Row('free') + Row('paid_total') + Row('IA'))
row('c_compute', 'Database, compute, functions', '$', 'flow', Row('mau_all') * P('infra_compute'))
row('c_storage', 'Storage incl. backups and DR copy', '$', 'flow', Row('mau_all') * P('gb_per_mau') * P('storage_price') * P('repl_factor'))
row('c_bandwidth', 'Bandwidth / egress', '$', 'flow', Row('mau_all') * P('egress_gb') * P('egress_price') * (1 - P('cdn_offload')))
row('c_search', 'Search and vector index', '$', 'flow', Row('mau_all') * P('search_per_mau'))
row('c_notif', 'Notifications (email, push, SMS)', '$', 'flow', Row('mau_all') * P('notif_per_mau'))
row('c_obs', 'Observability and logging', '$', 'flow', Row('mau_all') * P('obs_per_mau'))
row('c_infra_fixed', 'Fixed platform infrastructure', '$', 'flow', PY('infra_fixed'))
row('c_ai_var', 'AI inference (variable)', '$', 'flow',
    P('ai_cpr') * S('ai_unit') * S('ai_use') * (Row('free') * P('req_free') + Row('paid_total') * P('req_paid') + Row('IA') * P('req_inst')))
row('c_ai_fixed', 'AI evaluation, red-team and monitoring runs (fixed)', '$', 'flow', PY('ai_fixed'))
row('c_ai', 'AI inference + evaluation runs', '$', 'flow', Row('c_ai_var') + Row('c_ai_fixed'))
row('c_integ', 'Integrations: connectors and SSO/SCIM', '$', 'flow',
    (Row('logos') + Row('pilots_active')) * (P('conn_attach') * P('conn_cost') + P('sso_cost')))
row('tickets', 'Support tickets', 'tickets', 'flow', (Row('free') + Row('paid_total')) * P('tk_c') / 100 + Row('IA') * P('tk_i') / 100)
row('c_support_var', 'Support: outsourced overflow', '$', 'flow', Row('tickets') * P('overflow_share') * P('overflow_cost'))
row('pay_SUPPORT', 'Payroll: support', '$', 'flow', HC('pay', 'SUPPORT'))
row('pay_IMPL', 'Payroll: implementation', '$', 'flow', HC('pay', 'IMPL'))
row('pay_CS', 'Payroll: customer success', '$', 'flow', HC('pay', 'CS'))
row('pay_TS', 'Payroll: trust and safety', '$', 'flow', HC('pay', 'TS'))
row('c_payments', 'Payment processing + app-store fees (student)', '$', 'flow',
    (1 - P('iap_share')) * (P('stripe_pct') * Row('stud_bill') + P('stripe_fix') * (Row('paid_m') + Row('ann_starts'))) + P('iap_share') * P('iap_fee') * Row('stud_bill'))
row('c_mk', 'Marketplace payments, disputes, moderation', '$', 'flow',
    Row('mk_gmv') * (P('stripe_pct') + P('mk_dispute')) + Row('mk_orders') * (P('stripe_fix') + P('mk_ts_order')))
row('var_pool', 'Variable pool (per-user infrastructure, AI inference, support overflow)', '$', 'flow',
    Row('c_compute') + Row('c_storage') + Row('c_bandwidth') + Row('c_search') + Row('c_notif') + Row('c_obs') + Row('c_ai_var') + Row('c_support_var'))
row('cons_share', 'Consumer share of active users', '%', 'rate', (Row('free') + Row('paid_total')) / Row('mau_all'), 'p1')
row('cogs_consumer', 'COGS (variable): student subscriptions', '$', 'flow', Row('c_payments') + Row('var_pool') * Row('cons_share'))
row('cogs_inst', 'COGS: institutional platform (variable cost, integrations, customer success)', '$', 'flow', Row('var_pool') * (1 - Row('cons_share')) + Row('c_integ') + Row('pay_CS'))
row('cogs_shared', 'COGS (fixed, unallocated): platform infrastructure, AI evaluation, support team', '$', 'flow',
    Row('c_infra_fixed') + Row('c_ai_fixed') + Row('pay_SUPPORT'))
row('cogs_svc', 'COGS: implementation team', '$', 'flow', Row('pay_IMPL'))
row('cogs_mk', 'COGS: marketplace', '$', 'flow', Row('c_mk') + Row('pay_TS'))
row('cogs', 'TOTAL COST OF REVENUE', '$', 'flow', Row('cogs_consumer') + Row('cogs_inst') + Row('cogs_shared') + Row('cogs_svc') + Row('cogs_mk'))
row('cogs_check', 'Check: direct sum of cost-of-revenue lines minus total (must be 0)', '$', 'flow',
    Row('c_compute') + Row('c_storage') + Row('c_bandwidth') + Row('c_search') + Row('c_notif') + Row('c_obs') + Row('c_infra_fixed') + Row('c_ai')
    + Row('c_integ') + Row('pay_SUPPORT') + Row('c_support_var') + Row('pay_IMPL') + Row('pay_CS') + Row('pay_TS') + Row('c_payments') + Row('c_mk') - Row('cogs'))
row('free_cost', 'Variable cost of serving free users', '$', 'flow',
    Row('free') * (P('infra_compute') + P('gb_per_mau') * P('storage_price') * P('repl_factor') + P('egress_gb') * P('egress_price') * (1 - P('cdn_offload'))
                   + P('search_per_mau') + P('notif_per_mau') + P('obs_per_mau')
                   + P('req_free') * P('ai_cpr') * S('ai_unit') * S('ai_use') + P('tk_c') / 100 * P('overflow_share') * P('overflow_cost')))
row('paid_var_cost', 'Variable cost of serving paying subscribers (incl. payment fees)', '$', 'flow',
    Row('paid_total') * (P('infra_compute') + P('gb_per_mau') * P('storage_price') * P('repl_factor') + P('egress_gb') * P('egress_price') * (1 - P('cdn_offload'))
                         + P('search_per_mau') + P('notif_per_mau') + P('obs_per_mau')
                         + P('req_paid') * P('ai_cpr') * S('ai_unit') * S('ai_use') + P('tk_c') / 100 * P('overflow_share') * P('overflow_cost')) + Row('c_payments'))
row('paid_prev', 'Subscribers at start of month', 'users', 'flow', Row('paid_total', -1))

sec('Operating expenses')
for fn in ['ENG', 'PROD', 'SEC', 'SALES', 'MKT', 'GA']:
    row(f'pay_{fn}', f'Payroll: {FN_LABEL[fn]}', '$', 'flow', HC('pay', fn))
row('fte_total', 'Headcount, FTE (end)', 'FTE', 'stock', HC('fte'), 'n1')
row('fte_impl', 'Implementation FTE', 'FTE', 'stock', HC('fte', 'IMPL'), 'n1')
row('hires', 'Hires starting this month (from month 2)', 'FTE', 'flow', HC('hires'), 'n1')
row('sec_programs', 'Security, privacy, accessibility programs', '$', 'flow',
    (PY('sec_pentest') + PY('sec_soc2') + PY('sec_a11y') + PY('sec_grc') + PY('sec_privacy') + PY('sec_bounty')) / 12)
row('legal', 'Legal', '$', 'flow', (PY('legal_retainer') + PY('legal_ip') + PY('legal_contracts')) / 12)
row('insurance', 'Insurance', '$', 'flow', (PY('ins_cyber') + PY('ins_gl') + PY('ins_do')) / 12)
row('fin_admin', 'Accounting, audit, finance systems', '$', 'flow', (PY('acct') + PY('audit') + PY('finsys')) / 12)
row('travel_int', 'Internal travel and offsites', '$', 'flow', PY('travel_int') / 12)
row('commissions', 'Sales commissions', '$', 'flow', P('comm_rate') * Row('bookings'))
row('sales_other', 'Sales tools, events, travel, RFP support', '$', 'flow', (PY('sales_tools') + PY('events') + PY('travel_sales') + PY('rfp')) / 12)
row('paid_ua', 'Paid student acquisition', '$', 'flow', If(T() >= P('gate_plus'), PY('paid_budget'), 0))
row('mkt_other', 'Brand, ambassadors, PR, user research', '$', 'flow', (PY('mk_brand') + PY('mk_amb') + PY('mk_pr') + PY('mk_ux')) / 12)
row('tools_etc', 'Software, workspace, training (per FTE)', '$', 'flow', Row('fte_total') * (P('sw_per_fte') + P('rent_per_fte') + P('train_per_fte')))
row('recruit', 'Recruiting and equipment for new hires', '$', 'flow', Row('hires') * (P('recruit_per_hire') + P('equip_per_hire')))
row('contingency', 'Contingency', '$', 'flow',
    P('contingency') * (Row('sec_programs') + Row('legal') + Row('insurance') + Row('fin_admin') + Row('travel_int') + Row('sales_other') + Row('mkt_other')))
row('bad_debt', 'Bad debt expense', '$', 'flow', P('bad_debt') * Row('inst_bill'))
row('inc_cost', 'Incident response (one-time)', '$', 'flow',
    If(And(S('inc').eq(1), T().eq(P('inc_month'))),
       P('inc_forensics') + P('inc_counsel') + P('inc_regulatory') + P('inc_remediation') + P('inc_records') * P('inc_notify') - P('inc_recovery'), 0))
row('opex_eng', 'Engineering and product', '$', 'flow', Row('pay_ENG') + Row('pay_PROD'))
row('opex_sec', 'Security and privacy', '$', 'flow', Row('pay_SEC') + Row('sec_programs'))
row('opex_sales', 'Sales and partnerships', '$', 'flow', Row('pay_SALES') + Row('commissions') + Row('sales_other'))
row('opex_mkt', 'Marketing', '$', 'flow', Row('pay_MKT') + Row('paid_ua') + Row('mkt_other'))
row('opex_legal', 'Legal', '$', 'flow', Row('legal'))
row('opex_ins', 'Insurance', '$', 'flow', Row('insurance'))
row('opex_ga', 'G&A (leadership, finance, people, tools, bad debt, contingency)', '$', 'flow',
    Row('pay_GA') + Row('fin_admin') + Row('tools_etc') + Row('recruit') + Row('travel_int') + Row('contingency') + Row('bad_debt'))
row('opex_inc', 'Incident response', '$', 'flow', Row('inc_cost'))
row('opex', 'TOTAL OPERATING EXPENSES', '$', 'flow',
    Row('opex_eng') + Row('opex_sec') + Row('opex_sales') + Row('opex_mkt') + Row('opex_legal') + Row('opex_ins') + Row('opex_ga') + Row('opex_inc'))

sec('Profit, cash and runway')
row('gross_profit', 'Gross profit', '$', 'flow', Row('rev_total') - Row('cogs'))
row('contribution', 'Contribution (gross profit less paid acquisition and commissions)', '$', 'flow', Row('gross_profit') - Row('paid_ua') - Row('commissions'))
row('ebitda', 'Operating result (EBITDA; no D&A or tax modeled)', '$', 'flow', Row('gross_profit') - Row('opex'))
row('op_cash', 'Operating cash flow', '$', 'flow', Row('collections') - Row('cogs') - Row('opex'))
row('cum_cash', 'Cumulative operating cash flow', '$', 'stock', Row('cum_cash', -1) + Row('op_cash'))
row('cash_bal', 'Cash balance (illustrative opening capital + cumulative flow)', '$', 'stock', P('capital_available') + Row('cum_cash'))
row('neg_flag', 'Cash balance below zero (1 = yes)', 'flag', 'rate', If(Row('cash_bal') < 0, 1, 0))
row('svc_std_cost', 'Implementation standard cost (hours x loaded rate)', '$', 'flow', Row('hours_total') * P('loaded_rate'))
row('impl_capacity', 'Implementation capacity (billable hours)', 'hours', 'flow', Row('fte_impl') * P('hrs_per_fte'))

# ---- annual KPIs (columns AN:AP only) ----
K = Ann
kpi('k_rev', 'Total revenue', '$', K('rev_total'))
kpi('k_arr', 'ARR at year end', '$', K('arr'))
kpi('k_gm', 'Gross margin', '%', IfErr(K('gross_profit') / K('rev_total'), 0), 'p1')
kpi('k_cm', 'Contribution margin', '%', IfErr(K('contribution') / K('rev_total'), 0), 'p1')
kpi('k_gm_cons', 'Variable gross margin: student subscriptions (incl. free-user cost)', '%', IfErr((K('stud_rev') - K('cogs_consumer')) / K('stud_rev'), 0), 'p1')
kpi('k_gm_inst', 'Gross margin: institutional platform, pilots and add-ons (incl. customer success)', '%',
    IfErr((K('pilot_rev') + K('core_rev') + K('ai_rev') + K('alumni_rev') + K('career_rev') - K('cogs_inst'))
          / (K('pilot_rev') + K('core_rev') + K('ai_rev') + K('alumni_rev') + K('career_rev')), 0), 'p1')
kpi('k_gm_svc', 'Implementation margin (actual team cost)', '%', IfErr((K('svc_rev') - K('cogs_svc')) / K('svc_rev'), 0), 'p1')
kpi('k_gm_svc_std', 'Implementation margin at standard cost (pricing check)', '%', IfErr((K('svc_rev') - K('svc_std_cost')) / K('svc_rev'), 0), 'p1')
kpi('k_util', 'Implementation utilization (demand / capacity)', '%', IfErr(K('hours_total') / K('impl_capacity'), 0), 'p1')
kpi('k_ebitda', 'Operating result (EBITDA)', '$', K('ebitda'))
kpi('k_burn', 'Net burn (negative operating cash flow)', '$', -K('op_cash'))
kpi('k_cum', 'Cumulative operating cash flow at year end', '$', K('cum_cash'))
kpi('k_cash', 'Illustrative cash balance at year end', '$', K('cash_bal'))
kpi('k_new_arr', 'Net new ARR', '$', K('arr') - K('arr', -1))
kpi('k_burn_mult', 'Burn multiple (net burn / net new ARR)', 'x', IfErr(-K('op_cash') / (K('arr') - K('arr', -1)), 0), 'n1')
kpi('k_cac_stud', 'Student CAC (paid test budget + half of marketing) / new paying subscribers', '$', IfErr((K('paid_ua') + 0.5 * (K('pay_MKT') + K('mkt_other'))) / K('conv_new'), 0), 'n1')
_stud_cac = (K('paid_ua') + 0.5 * (K('pay_MKT') + K('mkt_other')) + K('free_cost')) / K('conv_new')
_arpu = K('stud_rev') / 12 / (K('paid_total') * 0.5 + K('paid_total', -1) * 0.5)
_paid_gm = (K('stud_rev') - K('paid_var_cost')) / K('stud_rev')
_churn = K('paid_churned') / K('paid_prev')
kpi('k_cac_stud', 'Student CAC, fully loaded (test budget + half of marketing + free-tier cost) / new paying subscribers', '$', IfErr(_stud_cac, 0), 'n1')
kpi('k_arpu', 'Student ARPU, monthly (average subscribers)', '$', IfErr(_arpu, 0), 'n2')
kpi('k_paid_gm', 'Margin on paying subscribers (own variable cost only)', '%', IfErr(_paid_gm, 0), 'p1')
kpi('k_payback_stud', 'Student CAC payback (months, on paying-subscriber margin)', 'months', IfErr(_stud_cac / (_arpu * _paid_gm), 0), 'n1')
kpi('k_cac_inst', 'Institution CAC per new annual contract (sales + half of non-student marketing)', '$',
    IfErr((K('opex_sales') + 0.5 * (K('pay_MKT') + K('mkt_other'))) / K('n_total'), 0))
kpi('k_cac_inst_start', 'Institution CAC per new institution started (pilot or direct)', '$',
    IfErr((K('opex_sales') + 0.5 * (K('pay_MKT') + K('mkt_other'))) / K('newinst'), 0))
kpi('k_nrr', 'Net revenue retention, core platform (renewal x expansion)', '%', (1 - (1 - P('rr_i')) * S('churn')) * (1 + P('expansion')), 'p1')
kpi('k_grr', 'Gross logo retention, institutions', '%', 1 - (1 - P('rr_i')) * S('churn'), 'p1')
kpi('k_logos', 'Annual logos at year end', 'accts', K('logos'), 'n1')
kpi('k_paid', 'Paying subscribers at year end', 'users', K('paid_total'))
kpi('k_mau', 'Monthly-active users at year end', 'users', K('mau_all'))
kpi('k_ai_mau', 'AI cost per MAU per month (average)', '$', IfErr(K('c_ai') / 12 / (K('mau_all') * 0.5 + K('mau_all', -1) * 0.5), 0), 'n2')
kpi('k_ai_pct', 'AI cost as share of revenue', '%', IfErr(K('c_ai') / K('rev_total'), 0), 'p1')
kpi('k_fte', 'Headcount at year end (FTE)', 'FTE', K('fte_total'), 'n1')
kpi('k_rev_fte', 'ARR per FTE at year end', '$', IfErr(K('arr') / K('fte_total'), 0))

kpi('k_churn_stud', 'Paying-subscriber churn per month (incl. non-renewals)', '%', IfErr(_churn, 0), 'p1')
kpi('k_ltv_stud', 'Student LTV (ARPU x paying-subscriber margin / monthly churn)', '$', IfErr(_arpu * _paid_gm / _churn, 0), 'n1')
kpi('k_ltv_cac', 'Student LTV / CAC', 'x', IfErr((_arpu * _paid_gm / _churn) / _stud_cac, 0), 'n2')
kpi('k_free_cost', 'Annual variable cost of serving free users', '$', K('free_cost'))
kpi('k_free_ratio', 'Free-user cost as share of student revenue', '%', IfErr(K('free_cost') / K('stud_rev'), 0), 'p1')
kpi('k_paid_share', 'Paying share of consumer users at year end', '%', IfErr(K('paid_total') / (K('paid_total') + K('free')), 0), 'p1')
