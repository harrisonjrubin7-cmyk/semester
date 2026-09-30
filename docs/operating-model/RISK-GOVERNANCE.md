# Risk governance

<!-- Rendered from app/src/lib/governance/risk.ts by risk.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

The bodies that decide, the register of what could go wrong, the appetite
for each kind of risk, the rules an exception has to meet, the game days that
would prove the runbooks, and what the board is told. Written as data in
`app/src/lib/governance/risk.ts` so a review computes the answer; a test holds
every cited control, charter and runbook to a file that exists.

**Nobody is named for any seat, no exception has been approved, and no game
day has been held.** The register says what is open, not what is handled.

## Governance bodies

| Body | Cadence | Responsibility | Charter | Members |
| --- | --- | --- | --- | --- |
| Executive risk committee | Monthly, and quarterly with the board report | Enterprise risk, funding, legal, major customer and incident decisions | `docs/operating-model/OPERATING-RHYTHM.md` | none named |
| Security and privacy committee | Monthly | Security, privacy, vendor risk, incidents, HECVAT and SOC 2 evidence | this page | none named |
| AI governance board | Monthly, and quarterly for policy | AI use cases, models, policies, evaluation, incidents, ethics | `docs/operating-model/AI-GOVERNANCE-BOARD.md` | none named |
| Accessibility council | Monthly | VPAT, barriers, remediation, release blockers, testing | `docs/operating-model/ACCESSIBILITY-GOVERNANCE.md` | none named |
| Architecture review board | Monthly, and for every high-risk change | Domain design, data, integration, resiliency, technical debt | `docs/architecture` | none named |
| Product governance board | Weekly or biweekly | Feature scope, user value, risk, support, success metrics, sunset | `docs/operating-model/PORTFOLIO-GOVERNANCE.md` | none named |
| Customer advisory councils | Quarterly | Student, faculty, advisor, registrar, CIO/CISO, accessibility and enterprise input | `app/src/lib/governance/charters.ts` | none named |
| Incident review | After every P0/P1, and a monthly trend | Postmortem, corrective actions, systemic learning | `docs/market-readiness/INCIDENT_RESPONSE.md` | none named |

## Risk appetite

### Zero tolerance

Any occurrence is a P0 incident and a launch stop condition. No exception may be granted.

- Cross-tenant data access.
- Unauthorized disclosure of restricted student data.
- Unlogged privileged or break-glass access.
- Silent loss of assessment, submission or grade data.
- Unsupported security, accessibility or compliance claims.

### Low tolerance

An occurrence is a P1. An exception needs a compensating control, an owner and an expiry, and executive approval.

- Accessibility blocker in a critical workflow.
- Stale authoritative data presented as current.
- AI policy bypass.
- P0/P1 response failure during an academic critical period.

### Managed tolerance

Accepted when labelled, time-limited and documented, with a workaround and an expiry.

- Clearly labelled planning estimates.
- Time-limited, documented feature beta.
- Accepted low-severity bug with a workaround and an expiry.

## The register

Inherent risk is likelihood × impact on 1–5 scales: 16+ critical, 10–15 high, 5–9 medium, under 5 low. A risk escalates to the executive risk committee on its own when it is zero tolerance, critical, or its residual after controls is 4 or more. Every row records: Risk ID; Category; Description; Affected assets/customers; Likelihood; Impact; Inherent risk; Controls; Residual risk; Owner; Mitigation; Due date; Status; Escalation threshold; Customer notification requirement; Review date; Evidence.

| ID | Category | Risk | Affects | L | I | Inherent | Tolerance | Controls | Residual | Owner | Status | Escalates |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | ---: | --- | --- | --- |
| R-01 | Security | A signed-in account reads or writes another school's or another student's rows. | Every tenant and every student record | 2 | 5 | 10 (high) | zero | `supabase/rls-coverage.check.sql` — Schema-wide sweep: RLS on every table, definer search_path, no permissive writes<br>`supabase/tenancy.check.sql` — Profile school pinned; claim_school domain checks<br>`supabase/integration-rls-matrix.check.sql` — Refusal matrix across the integration tables | 2 | Security lead | mitigating | yes |
| R-02 | Security | Privileged access without MFA and without a periodic review: an admin or support account is taken over or misused. | Every tenant; support-granted student data | 3 | 5 | 15 (high) | zero | `supabase/support-access.check.sql` — Every support read is recorded against a consent-bound, time-limited grant<br>`supabase/role-grant-audit.check.sql` — Role grant changes are audited | 4 | Security lead | open | yes |
| R-03 | Student harm/academic integrity | A student's plan, draft or agenda is lost or overwritten silently: the save looks successful and is not. | Every student's own work | 2 | 5 | 10 (high) | zero | `app/src/lib/governance/error-budgets.ts` — Durable-write journeys at 99.95–99.99% with the six bad-write outcomes named<br>`app/src/lib/merge.test.ts` — Two devices merging the same account's state<br>`app/src/lib/offline.test.ts` — Writes queued offline are replayed | 3 | Engineering lead | mitigating | yes |
| R-04 | Reputation/brand | A public or procurement claim (SOC 2, HECVAT, VPAT, FERPA, WCAG, uptime) exceeds what is implemented. | Every prospective customer; the company's standing with reviewers | 2 | 4 | 8 (medium) | zero | `app/src/lib/trust.test.ts` — No line in docs/trust/ may affirm a certification; a score needs a check that runs on every change<br>`app/src/lib/hecvat-readiness.test.ts` — HECVAT register statuses held to evidence paths<br>`app/src/lib/gtm/rfp.test.ts` — RFP answers refuse "available" without a source | 2 | Product executive | mitigating | yes |
| R-05 | Accessibility | A keyboard or screen-reader user cannot complete a critical student workflow, and nobody qualified has looked. | Students who rely on assistive technology; the ADA Title II position of every customer | 3 | 4 | 12 (high) | low | `app/src/a11y/axe.test.tsx` — axe-core over the rendered app on the screens a student lives in<br>`app/scripts/accessibility-smoke.mjs` — Automated accessibility smoke over the main routes<br>`app/src/screens/Calendar.keyboard.test.tsx` — Calendar actions reachable without dragging<br>`app/src/a11y/motion.test.ts` — Reduced-motion behaviour<br>`app/src/lib/contrast.test.ts` — Every ground walked against both faded rungs | 3 | Accessibility lead | mitigating | no |
| R-06 | Data quality | Institution-derived data (seats, requirements, deadlines) is shown as current when the source is stale or the sync failed. | Students planning registration; the institution's registrar | 3 | 3 | 9 (medium) | low | `app/src/lib/integration/freshness.ts` — Stale or estimated is never shown as official current<br>`app/src/components/schoolrecords.test.tsx` — School-records freshness display<br>`app/src/lib/source.ts` — Only school-confirmed facts carry institution_verified | 2 | Product executive | mitigating | no |
| R-07 | AI/model risk | Injection is held structurally and, once, behaviourally: every prompt builder fences the material, a suite proves the instructions cannot be reached, and the live red-team held 21 of 21 on claude-opus-5 (29 September 2026), but that is one model and one run, and nothing screens material before it is sent. The AI kill switch was drilled against production the same day and held on the deployed claude function; the institution gateway is not deployed and a per-tenant row has not been drilled. | Every student using Ask Semester; every tenant's AI policy | 2 | 4 | 8 (medium) | low | `docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json` — The drill against production: answered, refused with the runtime’s own sentence while engaged, answered again after release<br>`docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json` — The red-team against the real model: 21 cases, no canary followed<br>`app/src/lib/aikillswitch.test.ts` — The shared decision — the global row stops everyone, a school’s row its school, an unreadable switch is thrown — and the shared-key edge function refusing before the body is read<br>`app/server/institution/intelligence.test.ts` — The institution gateway refuses policy and respond with ai-generation-killed while the switch is engaged<br>`app/src/lib/flags.test.ts` — The flag evaluator lets a kill switch override tenant policy<br>`supabase/integration-control-plane.check.sql` — kill_switch_engaged() and its audit<br>`app/src/ai/injection.test.ts` — Twelve injection-shaped texts through every builder that carries someone else’s text: inside a fence, the instructions byte-for-byte unchanged, a closing tag in the material disarmed<br>`app/src/lib/studystudio.test.ts` — One injection-shaped source stays data inside the JSON prompt<br>`app/src/ai/helpstate.test.tsx` — An unreachable gateway is named to the student, with a safe local fallback | 3 | AI governance lead | mitigating | no |
| R-08 | Reliability/availability | A P0 during registration or finals with one person to page and no rota. | Every student in an academic critical period | 4 | 4 | 16 (critical) | low | `.github/workflows/production-smoke.yml` — Hourly synthetic probe of the public app and its database<br>`docs/vanderbilt/incident-routing.md` — Response windows per signal; every owner unassigned<br>`app/public/status.html` — A status page that checks from the reader's browser | 4 | SRE lead | open | yes |
| R-09 | People/key-person | One person holds every seat: founder, product, engineering, security, privacy, accessibility, support and on-call. | The whole company and every customer's continuity | 5 | 5 | 25 (critical) | low | `docs/LAUNCH-DECISIONS.md` — Names the seats the owner can hold and the ones that need someone qualified<br>`docs/LAUNCH-READINESS-COUNCIL.md` — Council seats and decision rights; every holder null | 5 | Executive launch authority | open | yes |
| R-10 | Business continuity | Production has never been restored from a backup; RTO and RPO are unmeasured and the backup tier is unconfirmed. | Every record in production | 2 | 5 | 10 (high) | low | `supabase/restore.sh` — Dump/restore rehearsal comparing schema and row counts, on every change in CI; never against production<br>`RESTORE.md` — Production restore procedure with every measurement blank | 4 | SRE lead | open | yes |
| R-11 | Operational/implementation | The live site is deployed as the demo: fictional tenant, persona switcher and fixture data shown where the product should be. It happened on 28 September 2026. | Every visitor the company site's Log in button sends to the app | 1 | 4 | 4 (low) | managed | `app/src/lib/pagesdemo.test.ts` — Runs the workflow's own script with the switch set and reads $GITHUB_ENV: the product build never carries it<br>`.github/workflows/pages.yml` — The product pins VITE_INSTITUTIONAL_PREVIEW off; the demo is built separately into /demo/ with the account service blanked | 1 | Engineering lead | mitigating | no |
| R-12 | Security | A signed-in account calls a database function in a tight loop: writes are rate-limited, calls are not. | Database capacity for every tenant | 3 | 3 | 9 (medium) | managed | `supabase/rate-limits.check.sql` — Per-account sliding windows on inserts into the fourteen tables that reach other people or staff queues<br>`docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md` — The abuse inventory names the RPC call-rate gap and the two realistic options | 3 | Security lead | accepted | no |
| R-13 | Legal/regulatory | No legal entity, and no terms of service or privacy policy in force: nothing can be sold and nothing binds a user. | Every user and every prospective contract | 4 | 4 | 16 (critical) | low | `docs/legal/TERMS-OF-SERVICE-DRAFT.md` — Draft for counsel, marked not in force<br>`docs/legal/PRIVACY-POLICY-DRAFT.md` — Draft for counsel, held to the subprocessor register<br>`app/src/lib/trust/legal-drafts.test.ts` — The drafts name every subprocessor and no more | 4 | Counsel/privacy lead | open | yes |
| R-14 | Integration/vendor | AI spend and availability depend on two providers behind one shared key, with no fallback route and no signed data-handling terms recorded. | Ask Semester for every student; the monthly bill | 3 | 3 | 9 (medium) | managed | `supabase/functions/_shared/clamp.ts` — Clamps what the shared key will pay for<br>`app/src/lib/trust/subprocessors.test.ts` — The provider list is held to the CSP hosts and the edge functions<br>`packages/institution/src/intelligence.ts` — chooseModel picks the cheapest allowed model under the tenant ceiling | 3 | AI governance lead | accepted | no |
| R-15 | Privacy | Support, analytics or a beta queue learns who a student is from a row that was meant to be anonymous. | Every student who writes to support or appears in a count | 2 | 4 | 8 (medium) | zero | `supabase/support-tickets.check.sql` — The staff functions' return types are read and any identity-shaped column fails<br>`app/src/lib/cohortfloor.test.ts` — Every SQL small-cell floor held to MIN_COHORT<br>`supabase/beta.check.sql` — Triage reads feedback without the sender's identity<br>`app/src/lib/governance/pia.ts` — Five surfaces answer the eleven privacy questions with evidence; the pull-request template asks the same of every new module | 2 | Counsel/privacy lead | mitigating | yes |
| R-16 | Market/customer concentration | The plan rests on one prospective pilot school, with no champion named and no success measures agreed. | Revenue and the evidence the next customer will ask for | 4 | 3 | 12 (high) | managed | `docs/market-readiness/PILOT_PLAYBOOK.md` — Success measures and a baseline to agree with the champion<br>`docs/PILOT-TO-ANNUAL-CONVERSION.md` — What converts a pilot to a contract | 3 | Product executive | open | no |
| R-17 | Financial/revenue | Billing is built and off until its secrets are set, and no price is decided, so the individual package cannot earn and the runway is unmeasured here. | The company | 4 | 3 | 12 (high) | managed | `docs/operating-model/COMMERCIAL-GOVERNANCE.md` — Pricing governance and the financial controls the company owes<br>`app/src/lib/governance/deal-desk.ts` — Proposed deal thresholds; no price book exists<br>`docs/COMMERCIAL-CORE.md` — The commercial core, wired to Stripe and off until keyed; the seeded prices are planning figures<br>`supabase/commercial.check.sql` — Cancelling is one call by the owner and nobody else; export and deletion stay available on every plan | 3 | Executive launch authority | open | no |

### Mitigation, escalation threshold and customer notification

| ID | Mitigation | Escalation threshold | Notify |
| --- | --- | --- | --- |
| R-01 | Export the policy listing for reviewers; complete the legacy RLS re-keying (SOC 2 CC6-04); engage a firm against docs/trust/PENETRATION-TEST-PLAN.md. | Any finding, however small, is a P0 incident. | affected customers |
| R-02 | Enforce MFA (aal2) for platform_admin and support_agent; hold the first privileged-access review and file it. | Any privileged action without an audit row is a P0. | affected customers |
| R-03 | Measure the write SLIs; run the rehearsal against production and file the timings (R-10); add a conflict report the student can see. | One confirmed silent loss is a P0. | affected customers |
| R-04 | Write the product claims register (PRG-002) so external claims, not only trust documents, are held to evidence. | A claim found live without evidence is withdrawn the same day. | affected customers |
| R-05 | Commission the external review docs/LAUNCH-DECISIONS.md item 11 asks for; add screen-reader and focus-obscured regression tests. | A blocker on Today, My Path, Plan or account is a P1 and a release stop. | affected customers |
| R-06 | Turn on module.source_freshness_cards once a connection is live; test freshness end to end against a real sync. | Stale data shown as current on a registration surface is a P1. | affected customers |
| R-07 | Run the red-team again (REDTEAM=write, app/src/ai/injection.live.test.ts) on every model change and each quarter, and fix any builder whose canary a model follows (AI-010); drill a per-tenant row, and the institution gateway once it is deployed, with npm run drill:killswitch, filing each under docs/evidence/ai/. | A switch engaged and generation continuing is a P1 and an AI incident. | affected customers |
| R-08 | Make a failed production check reach a phone (docs/LAUNCH-DECISIONS.md item 3); name a backup; publish the critical-period calendar and freeze. | Any P0 in a critical period without a response inside the window. | all customers |
| R-09 | Take the seats that can be taken this week; recruit security, privacy and accessibility advisors; write down what happens if the owner is unavailable for a month. | Standing item at every executive risk committee until two people can operate production. | none |
| R-10 | Grant engineering access to production (docs/LAUNCH-DECISIONS.md item 10), run the drill, file the timings under docs/evidence/. | A restore that fails validation is a P0 whether or not data was needed. | all customers |
| R-11 | Delete the repository variable so the notice stops firing; keep the guard. | A demo label seen on the product address is a P1. | none |
| R-12 | Use the platform's own rate limiting when the plan offers it, or move the heaviest RPCs behind an Edge Function with the gateway's limiter. | Database CPU saturation attributable to one account. | none |
| R-13 | Form the entity and get the drafts reviewed (docs/LAUNCH-DECISIONS.md items 4 and 5); resolve every [DECIDE]. | Any sale or institutional pilot attempted before terms are in force. | none |
| R-14 | Record provider terms and retention settings (AI-002); add a fallback route and a provider outage runbook. | Provider spend alert at half the cap, or a provider outage longer than an hour in term. | none |
| R-15 | Keep the return-type checks on every new staff function; answer the privacy impact assessment for the six surfaces it still owes before any ships to a pilot, and have the privacy seat, once held, read the five written. | Any identifying column reaching a staff or analytics reader is a P0. | affected customers |
| R-16 | Find the champion and agree 2–3 measures (docs/LAUNCH-DECISIONS.md items 7 and 9); run the individual package in parallel so one school is not the only route. | Quarterly report shows no signed pilot. | none |
| R-17 | Decide pricing; set the billing secrets only once the price is decided, keeping cancellation one call and export available after it, which commercial.check.sql holds. | Cash runway under six months. | none |

## Exceptions

Every exception records: Exception ID; Control/requirement; Why the exception is needed; Risk description; Affected tenant/system/data; Severity; Compensating control; Owner; Approver; Expiration date; Remediation plan; Customer notification requirement; Review date; Closure evidence. `reviewException()` applies these rules and refuses anything that breaks one:

- No indefinite exception: every one expires, within 90 days of being granted.
- No P0 exception without executive, security and legal approval.
- No exception that silently conflicts with a customer contract.
- A customer-impacting exception triggers contract and communication review before it is granted.
- An expired exception re-opens and escalates by itself; nothing lapses quietly.
- Zero-tolerance risks admit no exception at all.

**Open exceptions: 0.** The register starts empty on purpose. The gaps the risks above describe — no MFA, one person on call, no restore drill — are open risks, not accepted exceptions, until someone with the authority approves one with an expiry.

## Game days

The minimum scenarios. None has been held; a run files its record under `docs/evidence/` and records: Scenario; Hypothesis; Expected user experience; Expected telemetry/alert; Runbook; Owner; Observed result; Time to detect; Time to mitigate; Customer communication; Corrective action; Retest date.

| ID | Scenario | Hypothesis | Runbook | Last held |
| --- | --- | --- | --- | --- |
| GD-01 | SSO unavailable during registration | Students with a password fall back to it; SSO-only students see a named reason and a human route | `docs/INSTITUTIONAL-SSO-LAUNCH-READINESS.md` | never |
| GD-02 | LMS unavailable during a deadline | Deadlines already imported still show; the connection reads stale, not current | `docs/INTEGRATION-OPERATOR-RUNBOOK.md` | never |
| GD-03 | SIS source stale or incorrect | Freshness labels change; nothing derived from the source reads as verified | `docs/INTEGRATION-OPERATOR-RUNBOOK.md` | never |
| GD-04 | AI provider outage | Ask Semester says it cannot reach help and offers a retry; planning help still works; nothing is billed | none | never |
| GD-05 | Database connection pool saturation | The app reads as "not synced", not as broken; the hourly probe fails and someone is paged | `docs/trust/APM-RUNBOOK.md` | never |
| GD-06 | Integration queue backlog and dead letters | The dashboard shows the backlog; replay is idempotent | `docs/INTEGRATION-OPERATOR-RUNBOOK.md` | never |
| GD-07 | Webhook replayed and delivered out of order | The duplicate is counted once; the older event does not overwrite the newer | none | never |
| GD-08 | Grade passback ambiguity | Not applicable until AGS writes grades; the drill records that | none | never |
| GD-09 | Network interruption during an assessment | Not applicable until an assessment engine exists; the drill records that | none | never |
| GD-10 | Feature flag misconfigured in production | The kill switch disengages the feature for one tenant inside five minutes and the audit row exists | `docs/FEATURE-FLAG-REGISTRY.md` | never |
| GD-11 | Accidental platform-wide role grant | The grant is audited; revocation takes effect on the next request | none | never |
| GD-12 | Cross-tenant regression detection | A deliberately weakened policy fails supabase/check.sh before it can deploy | none | never |
| GD-13 | Backup restore | A restore of production into a branch meets the RTO and passes the row-count and policy comparison | `RESTORE.md` | never |
| GD-14 | Production rollback | The previous deploy is live again within the timing ROLLBACK.md measured | `ROLLBACK.md` | never |
| GD-15 | Payment webhook delayed or failed | Not applicable until billing exists; the drill records that | none | never |
| GD-16 | Status-page and customer communication drill, during finals | Detection, an incident commander, the status page, the support banner, a leadership notice and the student template are all done inside the first hour | `docs/operating-model/INCIDENT-COMMUNICATIONS.md` | never |

## Board-level reporting

The quarterly report to the executive risk committee covers:

1. Top risks and trends
2. P0/P1 incidents
3. Security, privacy and accessibility finding status
4. SLO and error-budget status
5. Customer concentration and renewal risk
6. Cash runway and vendor dependency
7. Legal and regulatory developments
8. Major architecture and AI decisions
9. Open exceptions
10. Business continuity readiness

## The decision rule

Before approving a feature, integration, policy, marketing claim or customer launch, answer:

- Is the user value real and evidenced?
- Is the data authority, source and retention clear?
- Is the permission and consent model explicit?
- Is the workflow accessible?
- Can it fail safely and recover?
- Can Semester observe and support it?
- Can it be explained to a student, a faculty member, an accessibility reviewer, a privacy officer, a CISO, a registrar and a regulator?
- Can it be contracted and offboarded responsibly?
- Can the company afford to maintain it?

If any answer is not clearly yes, it is not launch-ready: narrow the scope, add controls, or defer it.

## The enterprise maturity systems

The eighteen systems the maturity brief asks for, and where each stands. Where
the repository already answers one, this points there rather than copying it.

| # | System | State | Where it is answered | Note |
| --- | --- | --- | --- | --- |
| 1 | Software assurance program | partly | `.github/workflows/ci.yml`<br>`app/src/lib/supplychain.ts`<br>`docs/SUPPLY-CHAIN.md`<br>`docs/trust/PENETRATION-TEST-PLAN.md`<br>`docs/BRANCH-PROTECTION.md`<br>`docs/operating-model/QUALITY-MANAGEMENT.md` | CI runs audit, types, lint, tests, shuffle, build, policy checks and secret scans on every change; licences, registry provenance and approved Actions are build failures and each deploy keeps an SBOM (#904); a penetration-test plan and a branch ruleset exist as files (#906). No threat-model template, release attestation or vulnerability SLA, and the ruleset is not active until the owner imports it. |
| 2 | Exception and risk-acceptance process | covered | `app/src/lib/governance/risk.ts`<br>`docs/operating-model/RISK-GOVERNANCE.md` | This page: the fields, the rules and reviewException(). The register is empty because nobody has approved one. |
| 3 | Configuration drift detection | partly | `app/src/lib/integration/drift.ts`<br>`supabase/migrations/20260927170000_integration_control_plane.sql`<br>`docs/operating-model/CONFIGURATION-TIERS.md` | Provider schema drift is detected, and tenant policy changes are audited. Nothing compares a tenant's settings, scopes, flags or model against an approved baseline. |
| 4 | Contract-to-configuration enforcement | partly | `docs/ENTITLEMENT-RESOLUTION.md`<br>`supabase/functions/_shared/entitlement.ts`<br>`supabase/migrations/20260928004730_tenant_plan.sql`<br>`app/src/lib/governance/config-tiers.ts` | One current plan per school decides entitlement, written by the service role. Nothing links an executed order form, DPA or support tier to it. |
| 5 | Safe migration and schema-evolution system | partly | `MIGRATION-HISTORY.md`<br>`ROLLBACK.md`<br>`app/src/lib/migrationorder.test.ts`<br>`supabase/ledger.snapshot`<br>`docs/SCHEMA-DRIFT-AND-CONTRACT-TESTING.md` | Order against production's ledger is enforced and the history of repairs is kept. No per-migration metadata (RLS impact, lock risk, backfill, rollback, validation query); approval before production is a person's decision. |
| 6 | Content and policy integrity system | partly | `supabase/coursestudio.check.sql`<br>`app/src/lib/source.ts` | Course Studio publishes immutable versions under a live faculty grant; only school-confirmed facts carry institution_verified. No effective date, expiry, review date, audience or retraction on other institution-published content. |
| 7 | Data classification enforcement | partly | `app/src/lib/integration/classification.ts`<br>`app/src/lib/integration/classification.test.ts`<br>`docs/operating-model/DATA-STEWARDSHIP.md` | Seven tiers are seeded and a tenant may only be stricter. The tier is not yet consulted by AI retrieval, export, logging redaction or notification content. |
| 8 | Privacy impact assessment workflow | partly | `app/src/lib/governance/pia.ts`<br>`docs/operating-model/PRIVACY-IMPACT-ASSESSMENT.md`<br>`.github/pull_request_template.md` | The template’s eleven questions; five surfaces (support tickets, beta feedback, the pilot figures, AI conversations, billing) answered against the tree with the answers a test holds marked apart from the ones only written; six surfaces owed; and the pull-request template asks the question of every new module. No assessment has been reviewed by the privacy seat, which is vacant. |
| 9 | Abuse-resistance architecture | partly | `docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md`<br>`supabase/rate-limits.check.sql`<br>`supabase/migrations/20260921002428_invites.sql`<br>`app/src/community/safeguards.test.ts` | Invite-only sign-up, per-account write limits, community safeguards and an honest inventory. No account-takeover controls, session anomaly detection, bot detection or RPC call limits. |
| 10 | Customer-specific encryption and key strategy | missing | — | Provider-managed encryption only. Not promised, and should not be until the operational and recovery model is tested. |
| 11 | Disaster-recovery communication simulator | partly | `docs/operating-model/INCIDENT-COMMUNICATIONS.md`<br>`app/src/lib/governance/incident-comms.ts`<br>`docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md`<br>`app/public/status.html` | The messages are composed and refused when incomplete, and a status page exists. GD-16 has never been run. |
| 12 | Accessibility regression prevention | partly | `app/src/a11y/axe.test.tsx`<br>`app/scripts/accessibility-smoke.mjs`<br>`app/scripts/keyboard-pass.mjs`<br>`docs/accessibility/AT-PASS-PROTOCOL.md`<br>`app/src/a11y/motion.test.ts`<br>`app/src/lib/contrast.test.ts`<br>`app/src/screens/Calendar.keyboard.test.tsx`<br>`docs/operating-model/ACCESSIBILITY-GOVERNANCE.md` | axe-core walks the rendered app in CI, contrast tokens, reduced motion and keyboard alternatives are tested, and the keyboard pass records covered Tab stops at 320px (#906). The keyboard pass is not in CI; no screen-reader scripts, reflow screenshots, release-blocking severity policy or accessibility error budget. |
| 13 | Credential trust, revocation and verification | partly | `docs/CREDENTIAL-WALLET.md` | The wallet is designed over what exists and names issuer revocation as the missing piece (#904). Career evidence is a student's own résumé material, not a verifiable credential: no issuer identity, schema, revocation status or verification endpoint exists; Open Badges 3.0 and CLR 2.0 are planned, not built. |
| 14 | Model and provider portability | partly | `packages/institution/src/intelligence.ts`<br>`app/src/lib/trust/subprocessors.ts`<br>`docs/operating-model/AI-LIFECYCLE-GATES.md` | Model choice is policy-driven under a cost ceiling. One gateway adapter and one edge-function provider; no fallback model, prompt template versioning, evaluation corpus or migration runbook. |
| 15 | Operational analytics ethics board | partly | `docs/PRODUCT-ANALYTICS-DATA-ETHICS.md`<br>`app/src/lib/cohortfloor.test.ts`<br>`docs/operating-model/AI-GOVERNANCE-BOARD.md` | What is never measured is written down and the small-cell floor is held by a test. No board reviews non-AI analytics proposals, and the eight questions are not a gate. |
| 16 | Service deprecation and end-of-life policy | partly | `docs/operating-model/PORTFOLIO-GOVERNANCE.md`<br>`app/src/lib/governance/charters.ts` | A sunset process exists for modules. No customer notice period, security-maintenance period, flag sunset or final archive/deletion step. |
| 17 | Information architecture governance | covered | `docs/DO-NOT-BUILD.md`<br>`app/src/donotbuild.test.ts`<br>`app/src/lib/tabbar.ts` | No new top-level destination without portfolio approval, held by a test against ROOTS. The five student destinations sit behind journeyNavigation. |
| 18 | Reputation and trust recovery plan | partly | `docs/operating-model/TRUST-BRAND-AND-LEGAL.md`<br>`docs/operating-model/INCIDENT-COMMUNICATIONS.md`<br>`SECURITY.md` | Brand commitments, audience-specific incident messages and a security contact exist. No public-statement process, spokesperson, legal review step or post-incident transparency action. |

Covered: 2. Partly: 15. Missing: 1.
