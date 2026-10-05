/**
 * Risk governance: the bodies, the register, the appetite, the exceptions and
 * the game days — written as data so a review computes the answer instead of
 * arguing it, the way `error-budgets.ts` and `ai-lifecycle.ts` already do.
 *
 * `docs/operating-model/RISK-GOVERNANCE.md` is rendered from this file by
 * `risk.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * Three rules shape the file.
 *
 * **A risk cites its controls, and a control is a file.** Every path under
 * `controls` must exist, so a risk cannot be marked mitigated by a control
 * nobody wrote. The register is seeded from the master launch readiness
 * register's stop conditions and from what `docs/LAUNCH-READINESS-AUDIT.md`
 * found; it is not a list of everything that could go wrong.
 *
 * **An exception is a decision with an expiry, or it is not an exception.**
 * `reviewException()` refuses one with no expiry, one longer than
 * `MAX_EXCEPTION_DAYS`, a P0 without executive, security and legal approval,
 * one that conflicts with a customer contract, and a customer-impacting one
 * with no notification decision. An expired exception with no closure
 * evidence reads `expired-reopened`, never `closed`. `EXCEPTIONS` is empty:
 * nobody has approved one, and the gaps the risks describe are risks, not
 * accepted exceptions, until someone with the authority says otherwise.
 *
 * **A game day nobody has run is a plan.** Every scenario carries `held:
 * null`. The record fields say what a run must write down; a run that wrote
 * them down would file under `docs/evidence/`, which does not exist.
 *
 * Nothing here reads the network, the database or the clock. The date is
 * passed in, so the same register always gives the same verdict.
 */

// ── Governance bodies ────────────────────────────────────────────────────────

export interface Body {
  id: string;
  name: string;
  cadence: string;
  responsibility: string;
  /** Where its charter already lives, or null when this page is the first mention. */
  charter: string | null;
  /** Nobody is named for any body; a vacant seat is an unowned risk. */
  members: 'none named';
}

export const BODIES: readonly Body[] = [
  { id: 'executive-risk', name: 'Executive risk committee', cadence: 'Monthly, and quarterly with the board report', responsibility: 'Enterprise risk, funding, legal, major customer and incident decisions', charter: 'docs/operating-model/OPERATING-RHYTHM.md', members: 'none named' },
  { id: 'security-privacy', name: 'Security and privacy committee', cadence: 'Monthly', responsibility: 'Security, privacy, vendor risk, incidents, HECVAT and SOC 2 evidence', charter: null, members: 'none named' },
  { id: 'ai-governance', name: 'AI governance board', cadence: 'Monthly, and quarterly for policy', responsibility: 'AI use cases, models, policies, evaluation, incidents, ethics', charter: 'docs/operating-model/AI-GOVERNANCE-BOARD.md', members: 'none named' },
  { id: 'accessibility', name: 'Accessibility council', cadence: 'Monthly', responsibility: 'VPAT, barriers, remediation, release blockers, testing', charter: 'docs/operating-model/ACCESSIBILITY-GOVERNANCE.md', members: 'none named' },
  { id: 'architecture', name: 'Architecture review board', cadence: 'Monthly, and for every high-risk change', responsibility: 'Domain design, data, integration, resiliency, technical debt', charter: 'docs/architecture', members: 'none named' },
  { id: 'product', name: 'Product governance board', cadence: 'Weekly or biweekly', responsibility: 'Feature scope, user value, risk, support, success metrics, sunset', charter: 'docs/operating-model/PORTFOLIO-GOVERNANCE.md', members: 'none named' },
  { id: 'customer-advisory', name: 'Customer advisory councils', cadence: 'Quarterly', responsibility: 'Student, faculty, advisor, registrar, CIO/CISO, accessibility and enterprise input', charter: 'app/src/lib/governance/charters.ts', members: 'none named' },
  { id: 'incident-review', name: 'Incident review', cadence: 'After every P0/P1, and a monthly trend', responsibility: 'Postmortem, corrective actions, systemic learning', charter: 'docs/market-readiness/INCIDENT_RESPONSE.md', members: 'none named' },
];

// ── The register ─────────────────────────────────────────────────────────────

export const RISK_CATEGORIES = [
  'Security',
  'Privacy',
  'Accessibility',
  'AI/model risk',
  'Student harm/academic integrity',
  'Data quality',
  'Integration/vendor',
  'Reliability/availability',
  'Financial/revenue',
  'Legal/regulatory',
  'Reputation/brand',
  'People/key-person',
  'Market/customer concentration',
  'Operational/implementation',
  'Business continuity',
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

/** What every row of the register records, in the plan's words. */
export const RISK_FIELDS = [
  'Risk ID',
  'Category',
  'Description',
  'Affected assets/customers',
  'Likelihood',
  'Impact',
  'Inherent risk',
  'Controls',
  'Residual risk',
  'Owner',
  'Mitigation',
  'Due date',
  'Status',
  'Escalation threshold',
  'Customer notification requirement',
  'Review date',
  'Evidence',
] as const;

export type Tolerance = 'zero' | 'low' | 'managed';

export const APPETITE: Record<Tolerance, { label: string; meaning: string; examples: readonly string[] }> = {
  zero: {
    label: 'Zero tolerance',
    meaning: 'Any occurrence is a P0 incident and a launch stop condition. No exception may be granted.',
    examples: [
      'Cross-tenant data access.',
      'Unauthorized disclosure of restricted student data.',
      'Unlogged privileged or break-glass access.',
      'Silent loss of assessment, submission or grade data.',
      'Unsupported security, accessibility or compliance claims.',
    ],
  },
  low: {
    label: 'Low tolerance',
    meaning: 'An occurrence is a P1. An exception needs a compensating control, an owner and an expiry, and executive approval.',
    examples: [
      'Accessibility blocker in a critical workflow.',
      'Stale authoritative data presented as current.',
      'AI policy bypass.',
      'P0/P1 response failure during an academic critical period.',
    ],
  },
  managed: {
    label: 'Managed tolerance',
    meaning: 'Accepted when labelled, time-limited and documented, with a workaround and an expiry.',
    examples: [
      'Clearly labelled planning estimates.',
      'Time-limited, documented feature beta.',
      'Accepted low-severity bug with a workaround and an expiry.',
    ],
  },
};

export type Scale = 1 | 2 | 3 | 4 | 5;

export interface Control {
  /** Repository-relative. A test fails if it does not exist. */
  path: string;
  shows: string;
}

export type RiskStatus = 'open' | 'mitigating' | 'accepted' | 'closed';

export interface Risk {
  id: string;
  category: RiskCategory;
  description: string;
  affects: string;
  likelihood: Scale;
  impact: Scale;
  tolerance: Tolerance;
  controls: readonly Control[];
  /** After the controls, on the same 1–5 scale as impact × likelihood would give, divided out. */
  residual: Scale;
  /** A role label, never a person: every seat is vacant. */
  owner: string;
  mitigation: string;
  status: RiskStatus;
  escalation: string;
  notify: 'none' | 'affected customers' | 'all customers';
}

/** Likelihood × impact, 1–25. */
export const inherent = (r: Pick<Risk, 'likelihood' | 'impact'>): number => r.likelihood * r.impact;

/** The band an inherent score falls in, so a report reads the same for everyone. */
export const band = (score: number): 'critical' | 'high' | 'medium' | 'low' =>
  score >= 16 ? 'critical' : score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low';

/**
 * Whether a risk reaches the executive risk committee on its own: a zero-
 * tolerance risk always does, and so does anything critical or with a residual
 * of 4 or more after its controls.
 */
export const escalates = (r: Risk): boolean => r.tolerance === 'zero' || band(inherent(r)) === 'critical' || r.residual >= 4;

export const RISKS: readonly Risk[] = [
  {
    id: 'R-01',
    category: 'Security',
    description: 'A signed-in account reads or writes another school\'s or another student\'s rows.',
    affects: 'Every tenant and every student record',
    likelihood: 2,
    impact: 5,
    tolerance: 'zero',
    controls: [
      { path: 'supabase/rls-coverage.check.sql', shows: 'Schema-wide sweep: RLS on every table, definer search_path, no permissive writes' },
      { path: 'supabase/tenancy.check.sql', shows: 'Profile school pinned; claim_school domain checks' },
      { path: 'supabase/integration-rls-matrix.check.sql', shows: 'Refusal matrix across the integration tables' },
    ],
    residual: 2,
    owner: 'Security lead',
    mitigation: 'Export the policy listing for reviewers; complete the legacy RLS re-keying (SOC 2 CC6-04); engage a firm against docs/trust/PENETRATION-TEST-PLAN.md.',
    status: 'mitigating',
    escalation: 'Any finding, however small, is a P0 incident.',
    notify: 'affected customers',
  },
  {
    id: 'R-02',
    category: 'Security',
    description: 'Privileged access without MFA and without a periodic review: an admin or support account is taken over or misused.',
    affects: 'Every tenant; support-granted student data',
    likelihood: 3,
    impact: 5,
    tolerance: 'zero',
    controls: [
      { path: 'supabase/support-access.check.sql', shows: 'Every support read is recorded against a consent-bound, time-limited grant' },
      { path: 'supabase/role-grant-audit.check.sql', shows: 'Role grant changes are audited' },
    ],
    residual: 4,
    owner: 'Security lead',
    mitigation: 'Enforce MFA (aal2) for platform_admin and support_agent; hold the first privileged-access review and file it.',
    status: 'open',
    escalation: 'Any privileged action without an audit row is a P0.',
    notify: 'affected customers',
  },
  {
    id: 'R-03',
    category: 'Student harm/academic integrity',
    description: 'A student\'s plan, draft or agenda is lost or overwritten silently: the save looks successful and is not.',
    affects: 'Every student\'s own work',
    likelihood: 2,
    impact: 5,
    tolerance: 'zero',
    controls: [
      { path: 'app/src/lib/governance/error-budgets.ts', shows: 'Durable-write journeys at 99.95–99.99% with the six bad-write outcomes named' },
      { path: 'app/src/lib/merge.test.ts', shows: 'Two devices merging the same account\'s state' },
      { path: 'app/src/lib/offline.test.ts', shows: 'Writes queued offline are replayed' },
    ],
    residual: 3,
    owner: 'Engineering lead',
    mitigation: 'Measure the write SLIs; run the rehearsal against production and file the timings (R-10); add a conflict report the student can see.',
    status: 'mitigating',
    escalation: 'One confirmed silent loss is a P0.',
    notify: 'affected customers',
  },
  {
    id: 'R-04',
    category: 'Reputation/brand',
    description: 'A public or procurement claim (SOC 2, HECVAT, VPAT, FERPA, WCAG, uptime) exceeds what is implemented.',
    affects: 'Every prospective customer; the company\'s standing with reviewers',
    likelihood: 2,
    impact: 4,
    tolerance: 'zero',
    controls: [
      { path: 'app/src/lib/trust.test.ts', shows: 'No line in docs/trust/ may affirm a certification; a score needs a check that runs on every change' },
      { path: 'app/src/lib/hecvat-readiness.test.ts', shows: 'HECVAT register statuses held to evidence paths' },
      { path: 'app/src/lib/gtm/rfp.test.ts', shows: 'RFP answers refuse "available" without a source' },
    ],
    residual: 2,
    owner: 'Product executive',
    mitigation: 'Write the product claims register (PRG-002) so external claims, not only trust documents, are held to evidence.',
    status: 'mitigating',
    escalation: 'A claim found live without evidence is withdrawn the same day.',
    notify: 'affected customers',
  },
  {
    id: 'R-05',
    category: 'Accessibility',
    description: 'A keyboard or screen-reader user cannot complete a critical student workflow, and nobody qualified has looked.',
    affects: 'Students who rely on assistive technology; the ADA Title II position of every customer',
    likelihood: 3,
    impact: 4,
    tolerance: 'low',
    controls: [
      { path: 'app/src/a11y/axe.test.tsx', shows: 'axe-core over the rendered app on the screens a student lives in' },
      { path: 'app/scripts/accessibility-smoke.mjs', shows: 'Automated accessibility smoke over the main routes' },
      { path: 'app/src/screens/Calendar.keyboard.test.tsx', shows: 'Calendar actions reachable without dragging' },
      { path: 'app/src/a11y/motion.test.ts', shows: 'Reduced-motion behaviour' },
      { path: 'app/src/lib/contrast.test.ts', shows: 'Every ground walked against both faded rungs' },
    ],
    residual: 3,
    owner: 'Accessibility lead',
    mitigation: 'Commission the external review docs/LAUNCH-DECISIONS.md item 11 asks for; add screen-reader and focus-obscured regression tests.',
    status: 'mitigating',
    escalation: 'A blocker on Today, My Path, Plan or account is a P1 and a release stop.',
    notify: 'affected customers',
  },
  {
    id: 'R-06',
    category: 'Data quality',
    description: 'Institution-derived data (seats, requirements, deadlines) is shown as current when the source is stale or the sync failed.',
    affects: 'Students planning registration; the institution\'s registrar',
    likelihood: 3,
    impact: 3,
    tolerance: 'low',
    controls: [
      { path: 'app/src/lib/integration/freshness.ts', shows: 'Stale or estimated is never shown as official current' },
      { path: 'app/src/components/schoolrecords.test.tsx', shows: 'School-records freshness display' },
      { path: 'app/src/lib/source.ts', shows: 'Only school-confirmed facts carry institution_verified' },
    ],
    residual: 2,
    owner: 'Product executive',
    mitigation: 'Turn on module.source_freshness_cards once a connection is live; test freshness end to end against a real sync.',
    status: 'mitigating',
    escalation: 'Stale data shown as current on a registration surface is a P1.',
    notify: 'affected customers',
  },
  {
    id: 'R-07',
    category: 'AI/model risk',
    description: 'Injection is held structurally and, once, behaviourally: every prompt builder fences the material, a suite proves the instructions cannot be reached, and the live red-team held 21 of 21 on claude-opus-5 (29 September 2026), but that is one model and one run, and nothing screens material before it is sent. The AI kill switch was drilled against production the same day and held on the deployed claude function; the institution gateway is not deployed and a per-tenant row has not been drilled.',
    affects: 'Every student using Ask Semester; every tenant\'s AI policy',
    likelihood: 2,
    impact: 4,
    tolerance: 'low',
    controls: [
      { path: 'docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json', shows: 'The drill against production: answered, refused with the runtime’s own sentence while engaged, answered again after release' },
      { path: 'docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json', shows: 'The red-team against the real model: 21 cases, no canary followed' },
      { path: 'app/src/lib/aikillswitch.test.ts', shows: 'The shared decision — the global row stops everyone, a school’s row its school, an unreadable switch is thrown — and the shared-key edge function refusing before the body is read' },
      { path: 'app/server/institution/intelligence.test.ts', shows: 'The institution gateway refuses policy and respond with ai-generation-killed while the switch is engaged' },
      { path: 'app/src/lib/flags.test.ts', shows: 'The flag evaluator lets a kill switch override tenant policy' },
      { path: 'supabase/integration-control-plane.check.sql', shows: 'kill_switch_engaged() and its audit' },
      { path: 'app/src/ai/injection.test.ts', shows: 'Twelve injection-shaped texts through every builder that carries someone else’s text: inside a fence, the instructions byte-for-byte unchanged, a closing tag in the material disarmed' },
      { path: 'app/src/lib/studystudio.test.ts', shows: 'One injection-shaped source stays data inside the JSON prompt' },
      { path: 'app/src/ai/helpstate.test.tsx', shows: 'An unreachable gateway is named to the student, with a safe local fallback' },
    ],
    residual: 3,
    owner: 'AI governance lead',
    mitigation: 'Run the red-team again (REDTEAM=write, app/src/ai/injection.live.test.ts) on every model change and each quarter, and fix any builder whose canary a model follows (AI-010); drill a per-tenant row, and the institution gateway once it is deployed, with npm run drill:killswitch, filing each under docs/evidence/ai/.',
    status: 'mitigating',
    escalation: 'A switch engaged and generation continuing is a P1 and an AI incident.',
    notify: 'affected customers',
  },
  {
    id: 'R-08',
    category: 'Reliability/availability',
    description: 'A P0 during registration or finals with one person to page and no rota.',
    affects: 'Every student in an academic critical period',
    likelihood: 4,
    impact: 4,
    tolerance: 'low',
    controls: [
      { path: '.github/workflows/production-smoke.yml', shows: 'Hourly synthetic probe of the public app and its database' },
      { path: 'docs/vanderbilt/incident-routing.md', shows: 'Response windows per signal; every owner unassigned' },
      { path: 'app/public/status.html', shows: 'A status page that checks from the reader\'s browser' },
    ],
    residual: 4,
    owner: 'SRE lead',
    mitigation: 'Make a failed production check reach a phone (docs/LAUNCH-DECISIONS.md item 3); name a backup; publish the critical-period calendar and freeze.',
    status: 'open',
    escalation: 'Any P0 in a critical period without a response inside the window.',
    notify: 'all customers',
  },
  {
    id: 'R-09',
    category: 'People/key-person',
    description: 'One person holds every seat: founder, product, engineering, security, privacy, accessibility, support and on-call.',
    affects: 'The whole company and every customer\'s continuity',
    likelihood: 5,
    impact: 5,
    tolerance: 'low',
    controls: [
      { path: 'docs/LAUNCH-DECISIONS.md', shows: 'Names the seats the owner can hold and the ones that need someone qualified' },
      { path: 'docs/LAUNCH-READINESS-COUNCIL.md', shows: 'Council seats and decision rights; every holder null' },
    ],
    residual: 5,
    owner: 'Executive launch authority',
    mitigation: 'Take the seats that can be taken this week; recruit security, privacy and accessibility advisors; write down what happens if the owner is unavailable for a month.',
    status: 'open',
    escalation: 'Standing item at every executive risk committee until two people can operate production.',
    notify: 'none',
  },
  {
    id: 'R-10',
    category: 'Business continuity',
    description: 'Production has never been restored from a backup; RTO and RPO are unmeasured and the backup tier is unconfirmed.',
    affects: 'Every record in production',
    likelihood: 2,
    impact: 5,
    tolerance: 'low',
    controls: [
      { path: 'supabase/restore.sh', shows: 'Dump/restore rehearsal comparing schema and row counts, on every change in CI; never against production' },
      { path: 'RESTORE.md', shows: 'Production restore procedure with every measurement blank' },
    ],
    residual: 4,
    owner: 'SRE lead',
    mitigation: 'Grant engineering access to production (docs/LAUNCH-DECISIONS.md item 10), run the drill, file the timings under docs/evidence/.',
    status: 'open',
    escalation: 'A restore that fails validation is a P0 whether or not data was needed.',
    notify: 'all customers',
  },
  {
    id: 'R-11',
    category: 'Operational/implementation',
    description: 'The live site is deployed as the demo: fictional tenant, persona switcher and fixture data shown where the product should be. It happened on 28 September 2026.',
    affects: 'Every visitor the company site\'s Log in button sends to the app',
    likelihood: 1,
    impact: 4,
    tolerance: 'managed',
    controls: [
      { path: 'app/src/lib/pagesdemo.test.ts', shows: 'Runs the workflow\'s own script with the switch set and reads $GITHUB_ENV: the product build never carries it' },
      { path: '.github/workflows/pages.yml', shows: 'The product pins VITE_INSTITUTIONAL_PREVIEW off; the demo is built separately into /demo/ with the account service blanked' },
    ],
    residual: 1,
    owner: 'Engineering lead',
    mitigation: 'Delete the repository variable so the notice stops firing; keep the guard.',
    status: 'mitigating',
    escalation: 'A demo label seen on the product address is a P1.',
    notify: 'none',
  },
  {
    id: 'R-12',
    category: 'Security',
    description: 'A signed-in account calls a database function in a tight loop: writes are rate-limited, calls are not.',
    affects: 'Database capacity for every tenant',
    likelihood: 3,
    impact: 3,
    tolerance: 'managed',
    controls: [
      { path: 'supabase/rate-limits.check.sql', shows: 'Per-account sliding windows on inserts into the fourteen tables that reach other people or staff queues' },
      { path: 'docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md', shows: 'The abuse inventory names the RPC call-rate gap and the two realistic options' },
    ],
    residual: 3,
    owner: 'Security lead',
    mitigation: 'Use the platform\'s own rate limiting when the plan offers it, or move the heaviest RPCs behind an Edge Function with the gateway\'s limiter.',
    status: 'accepted',
    escalation: 'Database CPU saturation attributable to one account.',
    notify: 'none',
  },
  {
    id: 'R-13',
    category: 'Legal/regulatory',
    description: 'No legal entity, and no terms of service or privacy policy in force: nothing can be sold and nothing binds a user.',
    affects: 'Every user and every prospective contract',
    likelihood: 4,
    impact: 4,
    tolerance: 'low',
    controls: [
      { path: 'docs/legal/TERMS-OF-SERVICE-DRAFT.md', shows: 'Draft for counsel, marked not in force' },
      { path: 'docs/legal/PRIVACY-POLICY-DRAFT.md', shows: 'Draft for counsel, held to the subprocessor register' },
      { path: 'app/src/lib/trust/legal-drafts.test.ts', shows: 'The drafts name every subprocessor and no more' },
    ],
    residual: 4,
    owner: 'Counsel/privacy lead',
    mitigation: 'Form the entity and get the drafts reviewed (docs/LAUNCH-DECISIONS.md items 4 and 5); resolve every [DECIDE].',
    status: 'open',
    escalation: 'Any sale or institutional pilot attempted before terms are in force.',
    notify: 'none',
  },
  {
    id: 'R-14',
    category: 'Integration/vendor',
    description: 'AI spend and availability depend on two providers behind one shared key, with no fallback route and no signed data-handling terms recorded.',
    affects: 'Ask Semester for every student; the monthly bill',
    likelihood: 3,
    impact: 3,
    tolerance: 'managed',
    controls: [
      { path: 'supabase/functions/_shared/clamp.ts', shows: 'Clamps what the shared key will pay for' },
      { path: 'app/src/lib/trust/subprocessors.test.ts', shows: 'The provider list is held to the CSP hosts and the edge functions' },
      { path: 'packages/institution/src/intelligence.ts', shows: 'chooseModel picks the cheapest allowed model under the tenant ceiling' },
    ],
    residual: 3,
    owner: 'AI governance lead',
    mitigation: 'Record provider terms and retention settings (AI-002); add a fallback route and a provider outage runbook.',
    status: 'accepted',
    escalation: 'Provider spend alert at half the cap, or a provider outage longer than an hour in term.',
    notify: 'none',
  },
  {
    id: 'R-15',
    category: 'Privacy',
    description: 'Support, analytics or a beta queue learns who a student is from a row that was meant to be anonymous.',
    affects: 'Every student who writes to support or appears in a count',
    likelihood: 2,
    impact: 4,
    tolerance: 'zero',
    controls: [
      { path: 'supabase/support-tickets.check.sql', shows: 'The staff functions\' return types are read and any identity-shaped column fails' },
      { path: 'app/src/lib/cohortfloor.test.ts', shows: 'Every SQL small-cell floor held to MIN_COHORT' },
      { path: 'supabase/beta.check.sql', shows: 'Triage reads feedback without the sender\'s identity' },
      { path: 'app/src/lib/governance/pia.ts', shows: 'Five surfaces answer the eleven privacy questions with evidence; the pull-request template asks the same of every new module' },
    ],
    residual: 2,
    owner: 'Counsel/privacy lead',
    mitigation: 'Keep the return-type checks on every new staff function; answer the privacy impact assessment for the six surfaces it still owes before any ships to a pilot, and have the privacy seat, once held, read the five written.',
    status: 'mitigating',
    escalation: 'Any identifying column reaching a staff or analytics reader is a P0.',
    notify: 'affected customers',
  },
  {
    id: 'R-16',
    category: 'Market/customer concentration',
    description: 'The plan rests on one prospective pilot school, with no champion named and no success measures agreed.',
    affects: 'Revenue and the evidence the next customer will ask for',
    likelihood: 4,
    impact: 3,
    tolerance: 'managed',
    controls: [
      { path: 'docs/market-readiness/PILOT_PLAYBOOK.md', shows: 'Success measures and a baseline to agree with the champion' },
      { path: 'docs/PILOT-TO-ANNUAL-CONVERSION.md', shows: 'What converts a pilot to a contract' },
    ],
    residual: 3,
    owner: 'Product executive',
    mitigation: 'Find the champion and agree 2–3 measures (docs/LAUNCH-DECISIONS.md items 7 and 9); run the individual package in parallel so one school is not the only route.',
    status: 'open',
    escalation: 'Quarterly report shows no signed pilot.',
    notify: 'none',
  },
  {
    id: 'R-17',
    category: 'Financial/revenue',
    description: 'Billing is built and off until its secrets are set, and no price is decided, so the individual package cannot earn and the runway is unmeasured here.',
    affects: 'The company',
    likelihood: 4,
    impact: 3,
    tolerance: 'managed',
    controls: [
      { path: 'docs/operating-model/COMMERCIAL-GOVERNANCE.md', shows: 'Pricing governance and the financial controls the company owes' },
      { path: 'app/src/lib/governance/deal-desk.ts', shows: 'Proposed deal thresholds; no price book exists' },
      { path: 'docs/COMMERCIAL-CORE.md', shows: 'The commercial core, wired to Stripe and off until keyed; the seeded prices are planning figures' },
      { path: 'supabase/commercial.check.sql', shows: 'Cancelling is one call by the owner and nobody else; export and deletion stay available on every plan' },
    ],
    residual: 3,
    owner: 'Executive launch authority',
    mitigation: 'Decide pricing; set the billing secrets only once the price is decided, keeping cancellation one call and export available after it, which commercial.check.sql holds.',
    status: 'open',
    escalation: 'Cash runway under six months.',
    notify: 'none',
  },
];

// ── Exceptions ───────────────────────────────────────────────────────────────

/** What every exception records, in the plan's words. */
export const EXCEPTION_FIELDS = [
  'Exception ID',
  'Control/requirement',
  'Why the exception is needed',
  'Risk description',
  'Affected tenant/system/data',
  'Severity',
  'Compensating control',
  'Owner',
  'Approver',
  'Expiration date',
  'Remediation plan',
  'Customer notification requirement',
  'Review date',
  'Closure evidence',
] as const;

export const EXCEPTION_RULES = [
  'No indefinite exception: every one expires, within 90 days of being granted.',
  'No P0 exception without executive, security and legal approval.',
  'No exception that silently conflicts with a customer contract.',
  'A customer-impacting exception triggers contract and communication review before it is granted.',
  'An expired exception re-opens and escalates by itself; nothing lapses quietly.',
  'Zero-tolerance risks admit no exception at all.',
] as const;

export const MAX_EXCEPTION_DAYS = 90;

export type Approver = 'executive' | 'security' | 'legal' | 'privacy' | 'accessibility' | 'product' | 'engineering';

export interface RiskException {
  id: string;
  control: string;
  why: string;
  risk: string;
  affects: string;
  severity: 'P0' | 'P1' | 'P2';
  /** The risk it is an exception to; a zero-tolerance risk refuses. */
  riskId: string | null;
  compensating: string;
  owner: string;
  approvers: readonly Approver[];
  /** ISO dates. */
  granted: string;
  expires: string | null;
  remediation: string;
  customerImpact: boolean;
  notification: 'not required' | 'required' | 'undecided';
  conflictsWithContract: boolean;
  review: string;
  closure: string | null;
}

/**
 * The register of approved exceptions. It is empty on purpose: an exception
 * needs an approver with the authority to grant it, and none has. What the
 * risks above describe are open risks, not accepted ones.
 */
export const EXCEPTIONS: readonly RiskException[] = [];

export interface ExceptionVerdict {
  admissible: boolean;
  refusals: string[];
  state: 'open' | 'expired-reopened' | 'closed';
  /** Days left, negative once expired; null with no expiry. */
  daysLeft: number | null;
}

const DAY = 86_400_000;
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/** Applies `EXCEPTION_RULES` to one exception on a given day. Pure. */
export function reviewException(e: RiskException, today: string, risks: readonly Risk[] = RISKS): ExceptionVerdict {
  const refusals: string[] = [];
  if (!e.expires) refusals.push('No indefinite exception.');
  else if (days(e.granted, e.expires) > MAX_EXCEPTION_DAYS) refusals.push(`Expires more than ${MAX_EXCEPTION_DAYS} days after it was granted.`);
  else if (days(e.granted, e.expires) < 0) refusals.push('Expires before it was granted.');
  if (e.severity === 'P0') {
    for (const a of ['executive', 'security', 'legal'] as const) {
      if (!e.approvers.includes(a)) refusals.push(`P0 needs ${a} approval.`);
    }
  }
  if (e.approvers.length === 0) refusals.push('No approver.');
  if (e.conflictsWithContract) refusals.push('Conflicts with a customer contract.');
  if (e.customerImpact && e.notification === 'undecided') refusals.push('Customer-impacting, and the notification decision is not made.');
  const risk = e.riskId ? risks.find((r) => r.id === e.riskId) : undefined;
  if (e.riskId && !risk) refusals.push(`Names ${e.riskId}, which is not in the register.`);
  if (risk?.tolerance === 'zero') refusals.push(`${risk.id} is zero tolerance and admits no exception.`);
  const daysLeft = e.expires ? days(today, e.expires) : null;
  const state = e.closure ? 'closed' : daysLeft !== null && daysLeft < 0 ? 'expired-reopened' : 'open';
  return { admissible: refusals.length === 0, refusals, state, daysLeft };
}

// ── Game days ────────────────────────────────────────────────────────────────

export interface GameDay {
  id: string;
  scenario: string;
  hypothesis: string;
  /** The runbook a run would follow, where one exists. */
  runbook: string | null;
  /** The date of the last run under docs/evidence/. None has been run. */
  held: null;
}

export const GAME_DAYS: readonly GameDay[] = [
  { id: 'GD-01', scenario: 'SSO unavailable during registration', hypothesis: 'Students with a password fall back to it; SSO-only students see a named reason and a human route', runbook: 'docs/INSTITUTIONAL-SSO-LAUNCH-READINESS.md', held: null },
  { id: 'GD-02', scenario: 'LMS unavailable during a deadline', hypothesis: 'Deadlines already imported still show; the connection reads stale, not current', runbook: 'docs/INTEGRATION-OPERATOR-RUNBOOK.md', held: null },
  { id: 'GD-03', scenario: 'SIS source stale or incorrect', hypothesis: 'Freshness labels change; nothing derived from the source reads as verified', runbook: 'docs/INTEGRATION-OPERATOR-RUNBOOK.md', held: null },
  { id: 'GD-04', scenario: 'AI provider outage', hypothesis: 'Ask Semester says it cannot reach help and offers a retry; planning help still works; nothing is billed', runbook: null, held: null },
  { id: 'GD-05', scenario: 'Database connection pool saturation', hypothesis: 'The app reads as "not synced", not as broken; the hourly probe fails and someone is paged', runbook: 'docs/trust/APM-RUNBOOK.md', held: null },
  { id: 'GD-06', scenario: 'Integration queue backlog and dead letters', hypothesis: 'The dashboard shows the backlog; replay is idempotent', runbook: 'docs/INTEGRATION-OPERATOR-RUNBOOK.md', held: null },
  { id: 'GD-07', scenario: 'Webhook replayed and delivered out of order', hypothesis: 'The duplicate is counted once; the older event does not overwrite the newer', runbook: null, held: null },
  { id: 'GD-08', scenario: 'Grade passback ambiguity', hypothesis: 'Not applicable until AGS writes grades; the drill records that', runbook: null, held: null },
  { id: 'GD-09', scenario: 'Network interruption during an assessment', hypothesis: 'Not applicable until an assessment engine exists; the drill records that', runbook: null, held: null },
  { id: 'GD-10', scenario: 'Feature flag misconfigured in production', hypothesis: 'The kill switch disengages the feature for one tenant inside five minutes and the audit row exists', runbook: 'docs/FEATURE-FLAG-REGISTRY.md', held: null },
  { id: 'GD-11', scenario: 'Accidental platform-wide role grant', hypothesis: 'The grant is audited; revocation takes effect on the next request', runbook: null, held: null },
  { id: 'GD-12', scenario: 'Cross-tenant regression detection', hypothesis: 'A deliberately weakened policy fails supabase/check.sh before it can deploy', runbook: null, held: null },
  { id: 'GD-13', scenario: 'Backup restore', hypothesis: 'A restore of production into a branch meets the RTO and passes the row-count and policy comparison', runbook: 'RESTORE.md', held: null },
  { id: 'GD-14', scenario: 'Production rollback', hypothesis: 'The previous deploy is live again within the timing ROLLBACK.md measured', runbook: 'ROLLBACK.md', held: null },
  { id: 'GD-15', scenario: 'Payment webhook delayed or failed', hypothesis: 'Not applicable until billing exists; the drill records that', runbook: null, held: null },
  { id: 'GD-16', scenario: 'Status-page and customer communication drill, during finals', hypothesis: 'Detection, an incident commander, the status page, the support banner, a leadership notice and the student template are all done inside the first hour', runbook: 'docs/operating-model/INCIDENT-COMMUNICATIONS.md', held: null },
];

/** What every game day writes down. */
export const GAME_DAY_RECORD = [
  'Scenario',
  'Hypothesis',
  'Expected user experience',
  'Expected telemetry/alert',
  'Runbook',
  'Owner',
  'Observed result',
  'Time to detect',
  'Time to mitigate',
  'Customer communication',
  'Corrective action',
  'Retest date',
] as const;

// ── Board reporting, and the decision rule ───────────────────────────────────

export const BOARD_REPORT = [
  'Top risks and trends',
  'P0/P1 incidents',
  'Security, privacy and accessibility finding status',
  'SLO and error-budget status',
  'Customer concentration and renewal risk',
  'Cash runway and vendor dependency',
  'Legal and regulatory developments',
  'Major architecture and AI decisions',
  'Open exceptions',
  'Business continuity readiness',
] as const;

export const DECISION_QUESTIONS = [
  'Is the user value real and evidenced?',
  'Is the data authority, source and retention clear?',
  'Is the permission and consent model explicit?',
  'Is the workflow accessible?',
  'Can it fail safely and recover?',
  'Can Semester observe and support it?',
  'Can it be explained to a student, a faculty member, an accessibility reviewer, a privacy officer, a CISO, a registrar and a regulator?',
  'Can it be contracted and offboarded responsibly?',
  'Can the company afford to maintain it?',
] as const;

export const DECISION_RULE = 'If any answer is not clearly yes, it is not launch-ready: narrow the scope, add controls, or defer it.';

// ── The enterprise maturity systems ──────────────────────────────────────────

export type MaturityState = 'covered' | 'partly' | 'missing';

export interface Maturity {
  n: number;
  system: string;
  state: MaturityState;
  /** Where the repository already answers it. Empty when missing. */
  covered: readonly string[];
  note: string;
}

/**
 * The eighteen systems the maturity brief asks for, and where each stands.
 * Where the repository already answers one it points there rather than
 * copying, the rule `docs/trust/` follows.
 */
export const MATURITY: readonly Maturity[] = [
  { n: 1, system: 'Software assurance program', state: 'partly', covered: ['.github/workflows/ci.yml', 'app/src/lib/supplychain.ts', 'docs/SUPPLY-CHAIN.md', 'docs/trust/PENETRATION-TEST-PLAN.md', 'docs/BRANCH-PROTECTION.md', 'docs/operating-model/QUALITY-MANAGEMENT.md'], note: 'CI runs audit, types, lint, tests, shuffle, build, policy checks and secret scans on every change; licences, registry provenance and approved Actions are build failures and each deploy keeps an SBOM (#904); a penetration-test plan and a branch ruleset exist as files (#906). No threat-model template, release attestation or vulnerability SLA, and the ruleset is not active until the owner imports it.' },
  { n: 2, system: 'Exception and risk-acceptance process', state: 'covered', covered: ['app/src/lib/governance/risk.ts', 'docs/operating-model/RISK-GOVERNANCE.md'], note: 'This page: the fields, the rules and reviewException(). The register is empty because nobody has approved one.' },
  { n: 3, system: 'Configuration drift detection', state: 'partly', covered: ['app/src/lib/integration/drift.ts', 'supabase/migrations/20260927170000_integration_control_plane.sql', 'docs/operating-model/CONFIGURATION-TIERS.md'], note: 'Provider schema drift is detected, and tenant policy changes are audited. Nothing compares a tenant\'s settings, scopes, flags or model against an approved baseline.' },
  { n: 4, system: 'Contract-to-configuration enforcement', state: 'partly', covered: ['docs/ENTITLEMENT-RESOLUTION.md', 'supabase/functions/_shared/entitlement.ts', 'supabase/migrations/20260928004730_tenant_plan.sql', 'app/src/lib/governance/config-tiers.ts'], note: 'One current plan per school decides entitlement, written by the service role. Nothing links an executed order form, DPA or support tier to it.' },
  { n: 5, system: 'Safe migration and schema-evolution system', state: 'partly', covered: ['MIGRATION-HISTORY.md', 'ROLLBACK.md', 'app/src/lib/migrationorder.test.ts', 'supabase/ledger.snapshot', 'docs/SCHEMA-DRIFT-AND-CONTRACT-TESTING.md'], note: 'Order against production\'s ledger is enforced and the history of repairs is kept. No per-migration metadata (RLS impact, lock risk, backfill, rollback, validation query); approval before production is a person\'s decision.' },
  { n: 6, system: 'Content and policy integrity system', state: 'partly', covered: ['supabase/coursestudio.check.sql', 'app/src/lib/source.ts'], note: 'Course Studio publishes immutable versions under a live faculty grant; only school-confirmed facts carry institution_verified. No effective date, expiry, review date, audience or retraction on other institution-published content.' },
  { n: 7, system: 'Data classification enforcement', state: 'partly', covered: ['app/src/lib/integration/classification.ts', 'app/src/lib/integration/classification.test.ts', 'docs/operating-model/DATA-STEWARDSHIP.md'], note: 'Seven tiers are seeded and a tenant may only be stricter. The tier is not yet consulted by AI retrieval, export, logging redaction or notification content.' },
  { n: 8, system: 'Privacy impact assessment workflow', state: 'partly', covered: ['app/src/lib/governance/pia.ts', 'docs/operating-model/PRIVACY-IMPACT-ASSESSMENT.md', '.github/pull_request_template.md'], note: 'The template’s eleven questions; five surfaces (support tickets, beta feedback, the pilot figures, AI conversations, billing) answered against the tree with the answers a test holds marked apart from the ones only written; six surfaces owed; and the pull-request template asks the question of every new module. No assessment has been reviewed by the privacy seat, which is vacant.' },
  { n: 9, system: 'Abuse-resistance architecture', state: 'partly', covered: ['docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md', 'supabase/rate-limits.check.sql', 'supabase/migrations/20260921002428_invites.sql', 'app/src/community/safeguards.test.ts'], note: 'Invite-only sign-up, per-account write limits, community safeguards and an honest inventory. No account-takeover controls, session anomaly detection, bot detection or RPC call limits.' },
  { n: 10, system: 'Customer-specific encryption and key strategy', state: 'missing', covered: [], note: 'Provider-managed encryption only. Not promised, and should not be until the operational and recovery model is tested.' },
  { n: 11, system: 'Disaster-recovery communication simulator', state: 'partly', covered: ['docs/operating-model/INCIDENT-COMMUNICATIONS.md', 'app/src/lib/governance/incident-comms.ts', 'docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md', 'app/public/status.html'], note: 'The messages are composed and refused when incomplete, and a status page exists. GD-16 has never been run.' },
  { n: 12, system: 'Accessibility regression prevention', state: 'partly', covered: ['app/src/a11y/axe.test.tsx', 'app/scripts/accessibility-smoke.mjs', 'app/scripts/keyboard-pass.mjs', 'docs/accessibility/AT-PASS-PROTOCOL.md', 'app/src/a11y/motion.test.ts', 'app/src/lib/contrast.test.ts', 'app/src/screens/Calendar.keyboard.test.tsx', 'docs/operating-model/ACCESSIBILITY-GOVERNANCE.md'], note: 'axe-core walks the rendered app in CI, contrast tokens, reduced motion and keyboard alternatives are tested, and the keyboard pass records covered Tab stops at 320px (#906). The keyboard pass is not in CI; no screen-reader scripts, reflow screenshots, release-blocking severity policy or accessibility error budget.' },
  { n: 13, system: 'Credential trust, revocation and verification', state: 'partly', covered: ['docs/CREDENTIAL-WALLET.md'], note: 'The wallet is designed over what exists and names issuer revocation as the missing piece (#904). Career evidence is a student\'s own résumé material, not a verifiable credential: no issuer identity, schema, revocation status or verification endpoint exists; Open Badges 3.0 and CLR 2.0 are planned, not built.' },
  { n: 14, system: 'Model and provider portability', state: 'partly', covered: ['packages/institution/src/intelligence.ts', 'app/src/lib/trust/subprocessors.ts', 'docs/operating-model/AI-LIFECYCLE-GATES.md'], note: 'Model choice is policy-driven under a cost ceiling. One gateway adapter and one edge-function provider; no fallback model, prompt template versioning, evaluation corpus or migration runbook.' },
  { n: 15, system: 'Operational analytics ethics board', state: 'partly', covered: ['docs/PRODUCT-ANALYTICS-DATA-ETHICS.md', 'app/src/lib/cohortfloor.test.ts', 'docs/operating-model/AI-GOVERNANCE-BOARD.md'], note: 'What is never measured is written down and the small-cell floor is held by a test. No board reviews non-AI analytics proposals, and the eight questions are not a gate.' },
  { n: 16, system: 'Service deprecation and end-of-life policy', state: 'partly', covered: ['docs/operating-model/PORTFOLIO-GOVERNANCE.md', 'app/src/lib/governance/charters.ts'], note: 'A sunset process exists for modules. No customer notice period, security-maintenance period, flag sunset or final archive/deletion step.' },
  { n: 17, system: 'Information architecture governance', state: 'covered', covered: ['docs/DO-NOT-BUILD.md', 'app/src/donotbuild.test.ts', 'app/src/lib/tabbar.ts'], note: 'No new top-level destination without portfolio approval, held by a test against ROOTS. The five student destinations sit behind journeyNavigation.' },
  { n: 18, system: 'Reputation and trust recovery plan', state: 'partly', covered: ['docs/operating-model/TRUST-BRAND-AND-LEGAL.md', 'docs/operating-model/INCIDENT-COMMUNICATIONS.md', 'SECURITY.md'], note: 'Brand commitments, audience-specific incident messages and a security contact exist. No public-statement process, spokesperson, legal review step or post-incident transparency action.' },
];
