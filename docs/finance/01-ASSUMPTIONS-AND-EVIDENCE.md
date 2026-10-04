<!-- Rendered by docs/finance/model/render_docs.py from the model. Edit the model (spec.py) or the renderer, then re-run it. -->

# 01. Assumptions register and evidence plan

| Control | Value |
| --- | --- |
| Status | **PLANNING MODEL: NOT AN APPROVED BUDGET OR FORECAST** |
| Owner | Harrison Rubin: commercial proposal owner; finance operator, CPA, tax adviser, counsel and signing authority unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` (origin/main) |
| Source | Rendered from `docs/finance/model/` (the workbook and its Python reference run). Edit the model, not this page. |

**Claim ceiling.** Semester may say it has built an internal, assumption-labelled planning model. **Prohibited claims.** Do not publish, quote or give an investor, customer or the press any figure from this page as revenue, ARR/MRR, margin, runway, a forecast, a price or a commitment. No accounting, tax or legal conclusion is stated here; items for qualified professionals are listed in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md).

This is the rule the model is held to, taken from the master prompt's decision discipline: *state assumptions explicitly, and label facts, design decisions, hypotheses and legal-review items differently.* Every input of the workbook carries one tag. Of the 213 input values in the workbook, the mix is:

| Tag | Meaning | Inputs |
| --- | --- | ---: |
| `FACT` | In the repository today | 9 |
| `POLICY` | Proposed default already in the repository (deal-desk.ts), not approved | 13 |
| `DECIDE` | A founder or authorized-reviewer decision not yet made | 5 |
| `HYP` | Hypothesis: no evidence yet | 125 |
| `VENDOR` | Vendor price or rate: verify the vendor's current terms | 32 |
| `PRO` | Needs a qualified professional (accountant, tax adviser, counsel, broker) | 28 |
| `ILLUS` | Illustrative placeholder | 1 |

The honest reading is that almost nothing in the model is observed. The company has no paying customer, no paid pilot, no measured delivery cost and no price book (`docs/commercial/PRICING-AND-PACKAGING.md`: *no approved current price book, validated willingness-to-pay, observed delivery-cost baseline, margin floor, tax posture, payment authority or paying-customer result is evidenced*). The model is therefore a way to **rank what to measure first**, not a prediction.

## What is a fact

Only these come from the repository as it stands:

* **Plus is $7.99 a month or $59 a year** (D-134; the catalog charges it; `plans.test.ts` holds the page to it). New individual checkout is held by `INDIVIDUAL_PAID_ACQUISITION_ENABLED = false`.
* **Pilots run 26 weeks** (D-134, `PILOT_WEEKS`).
* **Anthropic list prices** for Haiku 4.5, Sonnet 5.5 and Opus 5.5 (API reference, cached 2026-09-25).
* **Stripe is wired, not connected;** consumer dunning has a 14-day grace; export and deletion survive every plan state (`docs/COMMERCIAL-CORE.md`).
* **The deal-desk policy numbers** are *proposed defaults* in `app/src/lib/governance/deal-desk.ts` (minimum ACV $15k pilot / $25k department / $75k campus / $200k system; discount ladder; 50% maximum pilot credit; $10k implementation-fee floor). They are tagged `POLICY`, not fact.
* **The gates:** paid individual acquisition, paid institutional pilots and broad enterprise sale are NO-GO (`GO-NO-GO-DECISION.md`, 3 Oct 2026).

## The ten assumptions to test first

Ranked by how far each moves the funding need or the month-36 ARR (sensitivity table in [06](06-SCENARIOS-AND-SENSITIVITIES.md)), then by how cheaply it can be measured.

| # | Assumption | Why it matters | How to get evidence | Earliest source |
| ---: | --- | --- | --- | --- |
| 1 | Gate timing (G1 to G5) | Moves peak funding by about $1M per 3-6 months | Close GO priorities 1-9 and date each; the evaluator in `release-profiles.ts` records authority | Founder, counsel, assessors |
| 2 | Paid-pilot and direct-deal volume | Largest revenue-side driver | Qualified pipeline log from discovery calls; signed orders only count | CRM (`docs/commercial/CRM-DATA-MODEL.md`) |
| 3 | Institutional price acceptance (ACV, pilot fee, implementation fee) | Sets revenue per account and the services margin | Quote 5 prospects at the proposed numbers; record accept / counter / refuse | Deal desk |
| 4 | Implementation hours per account | Decides services margin; the team is the biggest COGS line | Time-track the first design-partner pilot by task | Implementation lead |
| 5 | Pilot-to-annual conversion | Drives logos and ARR | Pilot scorecard at the 26-week closeout | `PILOT-SCORECARD.md` |
| 6 | Loaded cost of people | About two-thirds of all cost | Written offers, PEO or payroll quote for burden | Finance |
| 7 | AI cost per request and requests per user | 7-22% of revenue depending on the scenario | Join `private.ai_usage_month` tokens to model price monthly | Engineering, finance |
| 8 | Free-to-paid conversion, free-tier AI use, paying churn | Decides whether Plus pays its way | Invitation-only cohort, then G3 | Product analytics (D-005 for any new mark) |
| 9 | Vendor, audit, insurance and counsel quotes | About $0.3M to $0.7M a year of program cost | Three quotes each: pen test, SOC 2, cyber/E&O, counsel retainer | Finance |
| 10 | Support contact rate and cost per ticket | Sets support headcount | Ticket log from the cohort | Support |

## Register

Every input follows. Month 1 is January 2027; money is USD. `Source / note` says where the number comes from or what would change it. Scenario multipliers are on the `Scenarios` sheet and defined in [06](06-SCENARIOS-AND-SENSITIVITIES.md). Headcount is on [03](03-COST-MODEL.md); pipeline schedules are on the workbook's `Schedules` sheet.

### Go / no-go gates (controlling document: GO-NO-GO-DECISION.md, 3 Oct 2026)

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| Month broad / paid individual acquisition may begin (checkout hold lifted) (`gate_plus`) | 13 | month | DECIDE | Today NO-GO (INDIVIDUAL_PAID_ACQUISITION_ENABLED = false). Needs invitation-validation closeout + a separate broad-rollout decision. |
| Share of organic signups before that gate (invitation-only, unpaid validation cohorts) (`pre_gate_share`) | 25.0% | % | DECIDE | Conditional GO covers invitation-only, unpaid validation only. |
| Month the first PAID institutional pilot may begin (`gate_pilot`) | 12 | month | DECIDE | Today NO-GO. Reconsidered only after a design-partner pilot has an approved activation record and a measured 26-week closeout (D-134). |
| Month direct annual sales (no pilot first) may begin (`gate_direct`) | 22 | month | DECIDE | After the first pilot-to-annual conversions are evidenced. |
| Month System-tier / broad enterprise sale may begin (`gate_ent`) | 26 | month | DECIDE | Last motion to reconsider: repeated deployments and independent assurance first. |
| Design-partner pilot to paid annual conversion (`dp_rho`) | 60.0% | % | HYP | Unpaid design partners; converts only after the paid-pilot gate. |

### Student subscription

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| Plus list price, monthly (`price_m`) | 7.99 | $/mo | FACT | D-134 and docs/COMMERCIAL-CORE.md; the catalog charges this. |
| Plus list price, annual (`price_a`) | 59.00 | $/yr | FACT | D-134. Effective $4.92/mo. |
| Average promotional / edu discount on list (`stud_disc`) | 10.0% | % | HYP | No promo program exists. Counsel to review any student-pricing claim. |
| Refunds + chargebacks, share of billings (`refund`) | 3.3% | % | HYP | Contra-revenue. Refund policy is not yet approved. |
| Organic + campus-led free signups, month 1 (`organic_start`) | 1,200 | users/mo | HYP | No acquisition history. Pre-seasonality trend. |
| Paid acquisition: cost per free signup (`cps`) | 3.00 | $ | HYP | Test in paid channels before scaling; student CPI varies widely. |
| Signups that become monthly-active (`activation`) | 60.0% | % | HYP | Measure with the activation definition in ANALYTICS.md. |
| Monthly churn of active free users (`free_churn`) | 12.0% | % | HYP | Academic-calendar driven; calibrate on cohorts. |
| Free-to-paid conversion, monthly, of active free base (`conv`) | 0.25% | % | HYP | No paying cohort evidenced. Single most sensitive consumer input. |
| Share of new paid on annual plan (`annual_mix`) | 45.0% | % | HYP |  |
| Monthly plan churn (per month) (`churn_m`) | 5.0% | % | HYP | Summer and graduation churn are folded into the average. |
| Annual plan renewal rate at term (`renew_a`) | 55.0% | % | HYP |  |
| Student billings through app stores (native apps) (`iap_share`) | 25.0% | % | PRO | App-store purchase rules for digital subscriptions: platform-policy and counsel review. |
| App-store commission (`iap_fee`) | 15.0% | % | VENDOR | Assumes a reduced-rate program; verify current store terms. |
| Card processing, percent (`stripe_pct`) | 2.9% | % | VENDOR | Verify current Stripe pricing and any negotiated rate. |
| Card processing, fixed fee per charge (`stripe_fix`) | 0.3 | $ | VENDOR | Verify. |

### Institutional platform

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| Average realized discount off institutional list (`inst_disc`) | 12.0% | % | POLICY | Within the deal-desk ladder (<=20% needs finance). |
| Gross logo renewal rate at term (`rr_i`) | 88.0% | % | HYP | No contract has reached term. |
| Expansion on retained contract value (modules, bands) (`expansion`) | 10.0% | % | HYP | NRR (core) = renewal x (1 + expansion). |
| Share of full rollout active during a pilot (`pilot_share`) | 35.0% | % | HYP | Pilot is a bounded cohort (D-134: 26 weeks). |
| Bad debt, share of institutional billings (`bad_debt`) | 1.0% | % | HYP | Accountant to set reserve method. |
| New institutions buying an integration package (`attach_int`) | 40.0% | % | HYP | SIS/LMS connectors scoped separately (PRICING-AND-PACKAGING.md). |
| Integration package fee (`int_fee`) | 15,000 | $ | HYP |  |
| Integration package delivery hours (`int_hours`) | 110 | hours | HYP | Measure on the first integration. |
| Loaded implementation cost per hour (`loaded_rate`) | 85 | $/hr | HYP | ~$100k salary x 1.22 burden / ~1,430 productive hours. |
| Billable implementation hours per FTE per month (`hrs_per_fte`) | 110 | hours | HYP |  |
| Sales commission on new-logo bookings (`comm_rate`) | 8.0% | % | HYP | Plan not designed; counsel/accountant review of commission accounting. |

### Add-on streams

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| AI capacity add-on available from month (`ai_start`) | 20 | month | HYP |  |
| Annual institutions buying the AI add-on (`ai_attach`) | 40.0% | % | HYP |  |
| Alumni module available from month (`alu_start`) | 30 | month | HYP | Needs live annual customers first; no replacement claim before it is earned. |
| Campus/System institutions buying alumni module (`alu_attach`) | 15.0% | % | HYP |  |
| Career/employer product sells from month (`career_start`) | 25 | month | HYP | Employment-law and anti-discrimination review first (PRO). |
| Employer account ACV (`career_acv`) | 4,000 | $/yr | HYP |  |
| Employer account monthly churn (`career_churn`) | 2.0% | % | HYP |  |
| Marketplace opens from month (`mk_start`) | 31 | month | HYP | ADVERTISING-AND-MONETIZATION-POLICY.md and provider governance must be mature first. |
| Marketplace providers at opening (`mk_init`) | 40 | providers | HYP |  |
| Marketplace provider adds per month (`mk_adds`) | 15 | providers | HYP |  |
| Provider monthly churn (`mk_churn`) | 4.0% | % | HYP |  |
| Orders per provider per month (`mk_orders_pp`) | 6 | orders | HYP |  |
| Average order value (`mk_aov`) | 45 | $ | HYP |  |
| Platform take rate on GMV (`mk_take`) | 15.0% | % | HYP | Net-vs-gross presentation (principal/agent) is an accountant determination. |
| Refund/dispute reserve, share of GMV (`mk_dispute`) | 1.5% | % | HYP |  |
| Trust & safety cost per order (`mk_ts_order`) | 0.4 | $ | HYP |  |

### Infrastructure (variable, per monthly-active user, all classes)

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| Database + compute + functions (`infra_compute`) | 0.03 | $/MAU/mo | VENDOR | Planning allowance. Verify against Supabase / Vercel plans at scale. |
| Stored data per active user (`gb_per_mau`) | 0.4 | GB | HYP | Documents, media, attachments. |
| Object storage price (`storage_price`) | 0.021 | $/GB-mo | VENDOR | Verify. |
| Storage multiplier for backups and DR copy (`repl_factor`) | 2.00 | x | HYP | RESTORE.md / DR posture. |
| Data egress per active user (`egress_gb`) | 0.5 | GB/mo | HYP |  |
| Egress price (`egress_price`) | 0.09 | $/GB | VENDOR | Verify. |
| Share of egress absorbed by CDN cache (`cdn_offload`) | 50.0% | % | HYP |  |
| Search + vector index (`search_per_mau`) | 0.012 | $/MAU/mo | VENDOR |  |
| Email / push / SMS notifications (`notif_per_mau`) | 0.02 | $/MAU/mo | VENDOR |  |
| Observability and logging (`obs_per_mau`) | 0.01 | $/MAU/mo | VENDOR |  |

### AI inference

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| Haiku 4.5 input price (`in_h`) | 1.00 | $/M tok | FACT | Anthropic first-party API price table, cached 2026-09-25. |
| Haiku 4.5 output price (`out_h`) | 5.00 | $/M tok | FACT |  |
| Sonnet 5.5 input price (`in_s`) | 2.00 | $/M tok | FACT |  |
| Sonnet 5.5 output price (`out_s`) | 10.00 | $/M tok | FACT |  |
| Opus 5.5 input price (`in_o`) | 4.00 | $/M tok | FACT |  |
| Opus 5.5 output price (`out_o`) | 20.00 | $/M tok | FACT |  |
| Request share routed to Haiku class (`mix_h`) | 70.0% | % | HYP | Routing policy: classification and extraction on the small model. |
| Request share routed to Sonnet class (`mix_s`) | 28.0% | % | HYP |  |
| Request share routed to Opus class (`mix_o`) | 2.0% | % | HYP |  |
| Input tokens per request (incl. retrieved context) (`tok_in`) | 6,000 | tokens | HYP | Measure from usage.ts / private.ai_usage_month. |
| Output tokens per request (`tok_out`) | 700 | tokens | HYP |  |
| Output multiplier for reasoning tokens (`think_mult`) | 1.50 | x | HYP |  |
| Share of input that is cacheable prefix (`cache_share`) | 50.0% | % | HYP |  |
| Cache hit rate on cacheable prefix (`cache_hit`) | 70.0% | % | HYP |  |
| Cache read price as share of input price (`cache_read`) | 10.0% | % | FACT | Sonnet 5.5 $0.20 vs $2.00; blended. |
| Embeddings, retrieval, moderation overhead on top of inference (`ai_overhead`) | 15.0% | % | HYP |  |
| AI requests per free active user per month (capped) (`req_free`) | 10 | req | HYP | Free-tier cap is a product decision. |
| AI requests per paying user per month (`req_paid`) | 45 | req | HYP |  |
| AI requests per institution-sponsored active user per month (`req_inst`) | 20 | req | HYP |  |

### Integrations, support

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| Connector / iPaaS cost per integrated institution (`conn_cost`) | 300 | $/mo | VENDOR |  |
| Institutions with a live connector (`conn_attach`) | 60.0% | % | HYP |  |
| SSO / SCIM cost per institution connection (`sso_cost`) | 125 | $/mo | VENDOR | Verify the identity vendor price per connection. |
| Support tickets per 100 consumer MAU per month (`tk_c`) | 2.50 | tickets | HYP | Support contact rate is a defined measure; no reading yet. |
| Support tickets per 100 institutional MAU per month (`tk_i`) | 3.50 | tickets | HYP |  |
| Tickets handled by outsourced tier-1 overflow (`overflow_share`) | 25.0% | % | HYP |  |
| Cost per overflow ticket (`overflow_cost`) | 5.00 | $ | HYP |  |

### People and overhead

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| Payroll burden (taxes, benefits, workers comp) (`burden`) | 22.0% | % | PRO | PEO / benefits broker and payroll provider to confirm. |
| Software and tools per FTE (`sw_per_fte`) | 400 | $/mo | HYP |  |
| Workspace per FTE (`rent_per_fte`) | 350 | $/mo | HYP | Hybrid / coworking. |
| Training per FTE (`train_per_fte`) | 100 | $/mo | HYP |  |
| Recruiting cost per hire (month 2 onward) (`recruit_per_hire`) | 9,000 | $ | HYP | Agency or referral mix. |
| Equipment per hire (`equip_per_hire`) | 2,800 | $ | HYP |  |
| Contingency on non-payroll operating lines (`contingency`) | 5.0% | % | HYP |  |
| Cash available at start (ILLUSTRATIVE, not a plan) (`capital_available`) | 3,000,000 | $ | ILLUS | Used only to show a cash-out month. Set to the real figure. |

### Incident scenario (applies only when the scenario switch is on)

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| Month the SEV-0 incident occurs (`inc_month`) | 14 | month | HYP | Cross-tenant exposure or confirmed data breach (CRISIS-RESPONSE-RUNBOOK.md). |
| Forensics and incident-response retainer (`inc_forensics`) | 120,000 | $ | PRO | Quote from IR firm / cyber insurer panel. |
| Outside counsel and notification letters (`inc_counsel`) | 150,000 | $ | PRO |  |
| People whose records are affected (`inc_records`) | 25,000 | people | HYP |  |
| Notification, call center and monitoring per person (`inc_notify`) | 6.00 | $ | PRO | Verify with insurer / vendor quote. |
| Regulatory and contractual response (`inc_regulatory`) | 100,000 | $ | PRO |  |
| Emergency remediation engineering (contractors) (`inc_remediation`) | 180,000 | $ | HYP |  |
| Insurance recovery counted (`inc_recovery`) | 0 | $ | PRO | Zero until the policy, retention and exclusions are confirmed with the broker. |
| Service credits to institutions, share of core ARR (one month) (`inc_credit_pct`) | 5.0% | % | HYP | Contract-dependent. |
| Extra monthly churn on paid students for 3 months after (`inc_student_churn`) | 6.0% | % | HYP |  |
| Cut to institutional renewal rate for renewals in the next 12 months (`inc_rr_hit`) | 15.0% | % | HYP |  |
| Multiplier on new pilot/direct starts for 6 months after (`inc_pilot_mult`) | 0.4 | x | HYP |  |

### Institutional tiers (Department / Campus / System)

| Input | Department / Campus / System | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| List annual platform ACV (`acv`) | 30,000 / 85,000 / 220,000 | $/yr | POLICY | Set just above the deal-desk minimums ($25k / $75k / $200k). |
| Pilot software fee (26 weeks) (`pilotfee`) | 15,000 / 30,000 / 60,000 | $ | POLICY | Department equals the $15k pilot minimum; D-134 fixes 26 weeks. |
| Implementation fee (`impl`) | 15,000 / 40,000 / 100,000 | $ | POLICY | Above the $10k implementation-fee floor. |
| Standard implementation hours (`hours`) | 115 / 330 / 800 | hours | HYP | Measure on the first pilot. |
| Active students per fully rolled-out account (`students`) | 600 / 2,500 / 9,000 | users | HYP |  |
| Pilot credit applied at conversion (`credit`) | 7,500 / 15,000 / 30,000 | $ | POLICY | 50% of the pilot software fee: the deal-desk maximum. |
| Pilot-to-annual conversion (`rho`) | 50.0% / 45.0% / 40.0% | % | HYP | Defined measure; no pilot has run. |
| AI capacity add-on, annual (`ai_price`) | 6,000 / 18,000 / 45,000 | $/yr | HYP |  |

### Year-dependent: Volume drivers

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| Organic growth, monthly compounding (`g`) | 6.0% / 4.0% / 2.5% | %/mo | HYP |  |
| Paid student acquisition TEST budget (`paid_budget`) | 1,000 / 3,000 / 5,000 | $/mo | HYP | A test budget, not a scaling plan: released in tranches only against a measured cost per paying subscriber (see 05). |
| Fixed platform infrastructure (prod, staging, DR, tooling) (`infra_fixed`) | 4,000 / 9,000 / 16,000 | $/mo | VENDOR |  |
| AI evaluation, red-team and monitoring runs (`ai_fixed`) | 2,000 / 3,000 / 5,000 | $/mo | HYP | AI-RECOMMENDATION-EVALUATION-HARNESS.md. |

### Year-dependent: Security, privacy, accessibility programs ($/yr)

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| Penetration test (`sec_pentest`) | 25,000 / 40,000 / 60,000 | $/yr | VENDOR | Quote required. |
| SOC 2 readiness, tooling and audit (`sec_soc2`) | 50,000 / 55,000 / 65,000 | $/yr | VENDOR | Auditor and platform quotes required. |
| Accessibility audit, VPAT/ACR (`sec_a11y`) | 20,000 / 25,000 / 25,000 | $/yr | VENDOR |  |
| GRC and security tooling (`sec_grc`) | 18,000 / 30,000 / 45,000 | $/yr | VENDOR |  |
| Privacy assessments, HECVAT upkeep (`sec_privacy`) | 5,000 / 10,000 / 15,000 | $/yr | HYP |  |
| Bug bounty (`sec_bounty`) | 0 / 10,000 / 25,000 | $/yr | HYP |  |

### Year-dependent: Legal and insurance ($/yr)

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| Outside counsel (privacy, contracts, student data, employment) (`legal_retainer`) | 60,000 / 90,000 / 130,000 | $/yr | PRO | Counsel quote required; LEGAL-REVIEW-QUEUE.md. |
| Trademark and IP (`legal_ip`) | 10,000 / 12,000 / 15,000 | $/yr | PRO |  |
| Contract templates, DPA playbook build (`legal_contracts`) | 25,000 / 10,000 / 10,000 | $/yr | PRO |  |
| Cyber + tech E&O (`ins_cyber`) | 28,000 / 48,000 / 85,000 | $/yr | PRO | Broker quote; student-data limits drive premium. |
| General liability and property (`ins_gl`) | 5,000 / 7,000 / 10,000 | $/yr | PRO |  |
| Directors and officers (`ins_do`) | 8,000 / 15,000 / 25,000 | $/yr | PRO |  |

### Year-dependent: Finance and administration ($/yr)

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| Bookkeeping, tax preparation, payroll (`acct`) | 36,000 / 50,000 / 70,000 | $/yr | HYP |  |
| Financial statement review or audit (`audit`) | 0 / 25,000 / 45,000 | $/yr | PRO | Needed for institutional diligence and investors. |
| Billing, spend management, FP&A systems (`finsys`) | 12,000 / 24,000 / 36,000 | $/yr | VENDOR |  |
| Internal travel and offsites (`travel_int`) | 10,000 / 20,000 / 30,000 | $/yr | HYP |  |

### Year-dependent: Sales and marketing ($/yr)

| Input | Value | Unit | Tag | Source / note |
| --- | ---: | --- | --- | --- |
| CRM, data, sales tooling (`sales_tools`) | 10,000 / 25,000 / 45,000 | $/yr | VENDOR |  |
| Conferences and events (`events`) | 25,000 / 50,000 / 80,000 | $/yr | HYP |  |
| Sales travel (campus visits) (`travel_sales`) | 20,000 / 45,000 / 80,000 | $/yr | HYP |  |
| RFP / procurement response support (`rfp`) | 5,000 / 10,000 / 15,000 | $/yr | HYP |  |
| Brand, website, content (`mk_brand`) | 30,000 / 60,000 / 100,000 | $/yr | HYP |  |
| Campus ambassador program stipends (`mk_amb`) | 12,000 / 36,000 / 72,000 | $/yr | HYP | Tax and employment classification: PRO. |
| PR and community events (`mk_pr`) | 10,000 / 25,000 / 40,000 | $/yr | HYP |  |
| User research incentives (`mk_ux`) | 6,000 / 12,000 / 18,000 | $/yr | HYP |  |

### Derived (formulas)

| Input | Meaning |
| --- | --- |
| `p_in` | Blended input price ($/M tok). Formula. |
| `p_out` | Blended output price ($/M tok). Formula. |
| `ai_cpr` | AI cost per request (before scenario multipliers) ($/req). Formula. |
