/**
 * The launch go/no-go, written as data so a test can hold it to its evidence.
 *
 * `docs/LAUNCH-READINESS-COUNCIL.md` is the prose half and says why this is a
 * function rather than a checklist. In short: every readiness document in this
 * repository has been wrong at least once, and a checkbox is ticked by whoever
 * is holding the pen. `decide()` can only answer `go` when the evidence it
 * cites exists, the named people have signed, and nothing at all is open. It
 * answers `go-with-conditions` when the only things open are P2/P3 blockers
 * the founder has accepted in writing — each with a reason, an expiry and what
 * pilot users are told — and it lists those conditions, so a go that rests on
 * waivers is never mistaken for a clean one (D-117). There is deliberately no
 * argument that forces the answer.
 *
 * Nothing here reads the network, the database or the clock. The state is
 * passed in, so the same inputs always give the same verdict, and a verdict can
 * be attached to a decision record and re-derived later from what it cites.
 */

/** A council seat. The ten from the launch command, in its order, and the finance and operations seats added on 2026-09-29 (D-118, D-120). */
export const SEATS = [
  'founder',
  'product',
  'engineering',
  'security',
  'privacy',
  'accessibility',
  'success',
  'trust',
  'data',
  'finance',
  'operations',
  'champion',
] as const;

export type Seat = (typeof SEATS)[number];

export interface SeatDefinition {
  seat: Seat;
  title: string;
  decides: string;
  /**
   * A role label once somebody has accepted the seat in writing — never a
   * personal address, and never a repository username standing in for an
   * accountability nobody accepted. `null` is vacant.
   */
  holder: string | null;
  /** The seat must be held by someone at the institution, not at Semester. */
  institutional?: true;
}

/*
 * Four seats held since 2026-09-28, on the founder's instruction (decision 1 in
 * `docs/LAUNCH-DECISIONS.md`): the founder seat, and product, engineering and
 * customer success held by the same person, acting, until someone else
 * accepts each — which the council document allows at pilot scale. Role
 * labels, as the document requires; never an address. Holding a seat is not
 * signing: `signoffs` stays empty until there is a decision to sign for, so
 * `decide()` now says "has not signed" for these four rather than "is vacant".
 *
 * Three more on 2026-09-30, on the founder's word: privacy / legal by outside
 * counsel, and accessibility and operations by the founder, acting.
 */
export const COUNCIL: readonly SeatDefinition[] = [
  { seat: 'founder', title: 'Founder / CEO', decides: 'Risk acceptance, customer commitment, commercial launch', holder: 'Founder' },
  { seat: 'product', title: 'Product lead', decides: 'Golden path and its acceptance criteria', holder: 'Founder, acting' },
  { seat: 'engineering', title: 'Engineering lead', decides: 'Reliability, release, rollback', holder: 'Founder, acting' },
  { seat: 'security', title: 'Security / vCISO', decides: 'Threat model, pen-test findings, access controls', holder: null },
  { seat: 'privacy', title: 'Privacy / legal', decides: 'Terms, privacy, DPA/FERPA/COPPA posture, consent', holder: 'Outside counsel' },
  { seat: 'accessibility', title: 'Accessibility lead', decides: 'WCAG/VPAT status, blockers, remediation', holder: 'Founder, acting' },
  { seat: 'success', title: 'Customer success', decides: 'Onboarding, training, support, communication', holder: 'Founder, acting' },
  { seat: 'trust', title: 'Trust & Safety', decides: 'Reporting, escalation, moderation scope', holder: null },
  { seat: 'data', title: 'Data / integration owner', decides: 'Source quality, freshness, connector health', holder: null },
  { seat: 'finance', title: 'Finance / commercial', decides: 'Price floors, discount and pilot-credit approvals at the deal desk, margin, contract terms', holder: null },
  { seat: 'operations', title: 'Operations / SRE', decides: 'Monitoring, on-call, incident readiness, support operations, release readiness', holder: 'Founder, acting' },
  { seat: 'champion', title: 'Pilot institution champion', decides: 'Institutional workflow and communications', holder: null, institutional: true },
];

export type GateStatus = 'met' | 'partial' | 'unmet';

/** A repository file that shows something, and what it shows. */
export interface Evidence {
  /** Repository-relative. A test fails if it does not exist. */
  path: string;
  shows: string;
}

export interface Gate {
  id: string;
  /** The requirement exactly as the launch command words it. */
  requirement: string;
  owner: Seat;
  status: GateStatus;
  /** What exists. Required for `met` and `partial`, and must exist on disk. */
  evidence: Evidence[];
  /** What is still missing. Required unless `met`. */
  gap?: string;
  /**
   * Lines of `docs/market-readiness/GO_LIVE_CHECKLIST.md` this gate depends
   * on. While any of them is unticked the gate cannot be `met` — the two
   * documents are not allowed to disagree.
   */
  goLive?: RegExp[];
}

const GO_LIVE = 'docs/market-readiness/GO_LIVE_CHECKLIST.md';

/**
 * The twelve go/no-go requirements, audited against `origin/main` at
 * `1dd79cd` on 2026-09-27 and moved on 2026-09-28. `docs/LAUNCH-READINESS-AUDIT.md`
 * has the long form.
 *
 * One is `met` (`known-limitations`, the one that asked only for something to
 * be published). The other eleven are not, and that is the finding, not a
 * placeholder: the repository has a great deal of the machinery, and none of
 * those eleven is a statement about machinery alone — each needs something to
 * have been run, reviewed, agreed or signed by someone the tree cannot name.
 */
export const GATES: readonly Gate[] = [
  {
    id: 'golden-path',
    requirement: 'Golden student path passes end-to-end.',
    owner: 'product',
    status: 'partial',
    evidence: [
      { path: 'app/scripts/accessibility-smoke.mjs', shows: 'critical journeys driven in a real browser for accessibility' },
      { path: 'app/scripts/cold-smoke.mjs', shows: 'the built app boots cold in a browser' },
      {
        path: 'app/scripts/golden-path.mjs',
        shows: 'one student journey in CI at two viewports: first run and the account step, a course added from a pasted syllabus through the review and its approval (the one model reply stubbed, and refused unless it carries the syllabus), an action made and seen on Today, the deadline on Plan and something added to its day, path details saved on My Path, a deadline\'s own page with the syllabus sentence it came from and its Source & details, the Guide, the right door for a problem and — in a second CI run with VITE_HUMAN_HELP on — the request to a person previewed and never sent, Support, completion, resume after reload and in a second tab, and restore from the backup file into a fresh browser context',
      },
      {
        path: 'app/scripts/account-sync.mjs',
        shows: 'resume on a second device through an account, in CI at two viewports against a local Supabase built from this repository: sign-up in the first run, an action made and finished, the server shown to hold it, a fresh second context signed in and showing it done, and a change from the second device carried back to the first',
      },
    ],
    gap: 'Syllabus import is proved with the model reply stubbed, and account sync against a local Supabase rather than the production project. Human help is proved in a build with VITE_HUMAN_HELP on; whether the deployed build has it on is a repository variable nothing here reads. Phase 1.',
  },
  {
    id: 'no-blockers',
    requirement: 'No P0/P1 security, privacy, accessibility, reliability, or safety blocker.',
    owner: 'security',
    status: 'unmet',
    evidence: [{ path: GO_LIVE, shows: 'the blocking list, most of it unticked' }],
    gap: 'The go-live checklist still has unticked Blocking lines. Each is a release blocker by that document\'s own definition.',
    goLive: [/^- \[.\] /],
  },
  {
    id: 'staging-parity',
    requirement: 'Staging configuration mirrors intended production configuration.',
    owner: 'engineering',
    status: 'partial',
    evidence: [{ path: 'STAGING.md', shows: 'preview branches build per pull request; Edge Function parity settled' }],
    gap: 'STAGING.md itself says nobody has established that a preview branch matches production.',
  },
  {
    id: 'backup-restore',
    requirement: 'Backup/restore tested.',
    owner: 'engineering',
    status: 'partial',
    evidence: [
      { path: 'supabase/restore.sh', shows: 'a logical-dump restore rehearsal, run on 2026-09-21 and passing' },
      { path: 'RESTORE.md', shows: 'the production procedure, with every measurement still blank' },
    ],
    gap: 'The production project has never been restored: recovery point, recovery time and post-restore policy checks are all unmeasured. The rehearsal runs in CI on every change, against a disposable database.',
    goLive: [/Restore tested from backup/, /Gateway journal backed up/],
  },
  {
    id: 'operations-live',
    requirement: 'Monitoring, alerting, incident process, status page, and support routing live.',
    owner: 'engineering',
    status: 'partial',
    evidence: [
      { path: '.github/workflows/production-smoke.yml', shows: 'hourly synthetic check of the public app, its assets and PostgREST, and a job that records each hour’s result for the status page’s 90-day history' },
      { path: 'app/src/lib/statushistory.test.ts', shows: 'the history’s rules: an unchecked day is never up, uptime is checks passed over checks made, and the pages and feed are held to it' },
      { path: 'docs/market-readiness/INCIDENT_RESPONSE.md', shows: 'the incident process, written and never exercised' },
    ],
    gap: 'No alert reaches a named person and no support address exists that a university could be given. A public status page is live at /status.html (28 September) with an Atom incident feed and a 90-day history that begins with the first hourly record; it has no subscriber notifications yet, and is not hosted apart from the app it reports on.',
    goLive: [/Error monitoring live and alerting/, /Incident process with named owner/],
  },
  {
    id: 'escalation-owners',
    requirement: 'Named escalation owners and response windows.',
    owner: 'success',
    status: 'partial',
    evidence: [{ path: 'docs/vanderbilt/incident-routing.md', shows: 'response windows per signal, every owner marked unassigned' }],
    gap: 'The response windows exist. Every owner is unassigned.',
  },
  {
    id: 'terms-reviewed',
    requirement: 'Terms, privacy, consent, and acceptable-use content reviewed.',
    owner: 'privacy',
    status: 'partial',
    evidence: [
      { path: 'app/src/lib/privacy.ts', shows: 'the privacy disclosure written as data and tested against the code' },
      { path: 'docs/legal/PRIVACY-POLICY-DRAFT.md', shows: 'a privacy policy draft for counsel, held to the subprocessor register' },
      { path: 'docs/legal/TERMS-OF-SERVICE-DRAFT.md', shows: 'a terms of service draft for counsel, with acceptable use' },
    ],
    gap: 'No qualified legal or privacy review of terms, privacy notice, consent or acceptable use has been recorded. The drafts carry open [DECIDE] items: legal entity, liability, governing law; the minimum age is set at 13 (D-139) and awaits counsel.',
  },
  {
    id: 'data-scope',
    requirement: 'Pilot data scope/source ownership approved.',
    owner: 'data',
    status: 'unmet',
    evidence: [],
    gap: 'No pilot data scope exists to approve, and no source owner has been named for any institutional content.',
  },
  {
    id: 'onboarding-support',
    requirement: 'Student/staff onboarding and accessibility support ready.',
    owner: 'success',
    status: 'partial',
    evidence: [
      { path: 'docs/pilot/QUICK-START.md', shows: 'the first session for a pilot student, from the five-screen first run to the first deadline on Today, with every address checked against the router by pilotdocs.test.ts' },
      { path: 'docs/pilot/FIRST-DAY-CHECKLIST.md', shows: 'the first-day list for a student and for the staff member running the pilot' },
      { path: 'app/src/site/pages.tsx', shows: 'the accessibility support route — "Report a barrier" on /accessibility/, with escalation to the accessibility seat — which both documents point at' },
    ],
    gap: 'Only the qualified accessibility audit of the piloted workflows remains (decision 11 in docs/LAUNCH-DECISIONS.md); the go-live line for it is unticked.',
    goLive: [/Accessibility audit of the piloted workflows/],
  },
  {
    id: 'flags-rollback',
    requirement: 'Feature flags, kill switches, rollback runbooks tested.',
    owner: 'engineering',
    status: 'partial',
    evidence: [
      { path: 'ROLLBACK.md', shows: 'the rollback runbook, with measured timings' },
      { path: 'app/src/lib/flags.ts', shows: 'the flag registry, its evaluator, and six database-backed kill switches' },
      { path: 'docs/FEATURE-FLAG-REGISTRY.md', shows: 'each flag\'s owner and rollback, the kill-switch runbook, and the read-only mode with its engage, confirm and rollback steps' },
      { path: 'app/src/lib/readonly.ts', shows: 'the app-wide read-only mode: VITE_READ_ONLY stops every push and shows a standing banner; SEMESTER_READ_ONLY makes the gateway refuse every write with a retryable 503; each side tested, and each guard shown red under revert' },
    ],
    gap: 'No kill switch and no read-only mode has been engaged against production, and rollback has not been tested on the production deployment path.',
    goLive: [/Rollback tested on the production deployment path/],
  },
  {
    id: 'pilot-outcome',
    requirement: 'Pilot outcome baseline and decision criteria agreed.',
    owner: 'champion',
    status: 'partial',
    evidence: [{ path: 'docs/market-readiness/PILOT_PLAYBOOK.md', shows: 'which criteria to agree, and that stop must be a real option' }],
    gap: 'The criteria to agree are listed. Nothing has been agreed with any institution, and no baseline has been measured.',
  },
  {
    id: 'known-limitations',
    requirement: 'Known limitations published internally and appropriately to pilot users.',
    owner: 'product',
    status: 'met',
    evidence: [
      { path: 'SEMESTER_MARKET_READINESS.md', shows: 'the internal scorecard, including how it has been wrong' },
      {
        path: 'docs/pilot/KNOWN-LIMITATIONS.md',
        shows: 'the same limitations for pilot users, dated 2026-10-03, each with what to do instead, how to report, and the file that states it — rendered from app/src/lib/knownlimitations.ts and held to it by pilotdocs.test.ts',
      },
      {
        path: 'app/src/components/KnownLimitations.tsx',
        shows: 'the list printed on the Help screen of the deployed app, the copy a pilot user can open; the public site prints it at /known-limitations/ from the same data',
      },
    ],
  },
];

/** The eight parts of the launch condition, each resolved to gates. */
export const CONDITION: readonly { part: string; gates: string[] }[] = [
  { part: 'One excellent golden journey', gates: ['golden-path'] },
  { part: 'one controlled beta', gates: ['flags-rollback', 'known-limitations'] },
  { part: 'one named institutional champion', gates: ['pilot-outcome'] },
  { part: 'one approved data scope', gates: ['data-scope'] },
  { part: 'one support and incident process', gates: ['operations-live', 'escalation-owners'] },
  { part: 'one real trust/accessibility/privacy evidence package', gates: ['no-blockers', 'terms-reviewed', 'onboarding-support'] },
  { part: 'one measurable pilot outcome', gates: ['pilot-outcome'] },
  { part: 'one repeatable implementation path', gates: ['staging-parity', 'backup-restore'] },
];

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';

export interface Blocker {
  id: string;
  severity: Severity;
  summary: string;
  /** The gate it holds shut, if any. */
  gate?: string;
}

export interface RiskAcceptance {
  blocker: string;
  by: Seat;
  reason: string;
  /**
   * What pilot users are told about the accepted blocker, in their words. An
   * accepted risk the affected people do not know about is not a condition of
   * launch; it is a surprise. Required, and it is what `go-with-conditions`
   * discloses.
   */
  disclosure: string;
  /** ISO date. Required; an acceptance nobody has to revisit is not one. */
  expires: string;
}

export interface LaunchState {
  gates: readonly Gate[];
  council: readonly SeatDefinition[];
  signoffs: readonly Seat[];
  blockers: readonly Blocker[];
  acceptances: readonly RiskAcceptance[];
  /** ISO date the decision is taken on, so expiry is judged without a clock. */
  on: string;
}

/** An accepted blocker the launch proceeds under: time-bound, owned, disclosed. */
export interface Condition {
  blocker: string;
  severity: Severity;
  by: Seat;
  reason: string;
  disclosure: string;
  expires: string;
}

export interface Verdict {
  /**
   * `go`: nothing open. `go-with-conditions`: nothing open except P2/P3
   * blockers under a valid acceptance, listed in `conditions`. `no-go`:
   * anything in `reasons`.
   */
  verdict: 'go' | 'go-with-conditions' | 'no-go';
  reasons: string[];
  conditions: Condition[];
}

/** Only these may be waived, and only by this seat. */
const WAIVABLE: readonly Severity[] = ['P2', 'P3'];
const ACCEPTS_RISK: Seat = 'founder';

/**
 * Why each acceptance does not count, or nothing if it does. Split out because
 * an invalid acceptance is itself a reason for `no-go`: a waiver that is
 * silently ignored reads, to whoever wrote it, as a waiver that worked.
 */
export function invalidAcceptances(state: LaunchState): string[] {
  const reasons: string[] = [];
  for (const a of state.acceptances) {
    const blocker = state.blockers.find((b) => b.id === a.blocker);
    if (!blocker) reasons.push(`Risk acceptance names ${a.blocker}, which is not an open blocker.`);
    else if (!WAIVABLE.includes(blocker.severity)) {
      reasons.push(`${blocker.id} is ${blocker.severity}; a ${blocker.severity} cannot be accepted, only fixed.`);
    }
    if (a.by !== ACCEPTS_RISK) reasons.push(`Risk acceptance for ${a.blocker} is by ${a.by}; only ${ACCEPTS_RISK} accepts risk.`);
    if (!a.reason.trim()) reasons.push(`Risk acceptance for ${a.blocker} gives no reason.`);
    if (!a.disclosure.trim()) reasons.push(`Risk acceptance for ${a.blocker} says nothing about what pilot users are told.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.expires)) reasons.push(`Risk acceptance for ${a.blocker} has no valid expiry.`);
    else if (a.expires <= state.on) reasons.push(`Risk acceptance for ${a.blocker} expired on ${a.expires}.`);
  }
  return reasons;
}

/**
 * The go/no-go. Every reason is collected rather than stopping at the first,
 * because the list is the agenda for the next council meeting and a verdict
 * that names one problem hides the other eleven.
 */
export function decide(state: LaunchState): Verdict {
  const reasons: string[] = [];

  // The decision date gates every waiver's expiry, and a string comparison
  // against a malformed date keeps an expired waiver alive. So it is checked
  // first, and nothing is accepted against a date that is not a real one.
  const dated = /^\d{4}-\d{2}-\d{2}$/.test(state.on) && !Number.isNaN(Date.parse(state.on));
  if (!dated) reasons.push(`The decision date "${state.on}" is not a date (YYYY-MM-DD).`);

  for (const gate of state.gates) {
    if (gate.status !== 'met') reasons.push(`${gate.id}: ${gate.status} — ${gate.gap ?? 'no gap recorded'}`);
    else if (gate.evidence.length === 0) reasons.push(`${gate.id}: marked met with no evidence.`);
  }

  for (const part of CONDITION) {
    const open = part.gates.filter((id) => state.gates.find((g) => g.id === id)?.status !== 'met');
    if (open.length > 0) reasons.push(`Launch condition “${part.part}” is not satisfied (${open.join(', ')}).`);
  }

  // Every seat, exactly once. A state that leaves a seat out has no entry
  // for it to be vacant or unsigned in, and a duplicate can stand in its place.
  for (const want of SEATS) {
    const held = state.council.filter((s) => s.seat === want).length;
    if (held === 0) reasons.push(`Seat ${want} is missing from the council.`);
    else if (held > 1) reasons.push(`Seat ${want} appears ${held} times on the council.`);
  }

  for (const seat of state.council) {
    if (seat.holder === null) reasons.push(`Seat ${seat.seat} is vacant.`);
    else if (!state.signoffs.includes(seat.seat)) reasons.push(`Seat ${seat.seat} has not signed.`);
  }

  const invalid = invalidAcceptances(state);
  reasons.push(...invalid);
  const accepted = (dated ? state.acceptances : []).filter((a) => invalidAcceptances({ ...state, acceptances: [a] }).length === 0);
  const acceptedIds = new Set(accepted.map((a) => a.blocker));
  for (const blocker of state.blockers) {
    if (!acceptedIds.has(blocker.id)) reasons.push(`Open ${blocker.severity} ${blocker.id}: ${blocker.summary}`);
  }

  // A valid acceptance removes the blocker from the reasons, not from the
  // record: the verdict carries each one as a condition, in the blockers'
  // order, so the decision record says what the launch proceeds under.
  const conditions: Condition[] = state.blockers
    .filter((b) => acceptedIds.has(b.id))
    .map((b) => {
      const a = accepted.find((x) => x.blocker === b.id)!;
      return { blocker: b.id, severity: b.severity, by: a.by, reason: a.reason, disclosure: a.disclosure, expires: a.expires };
    });

  // A no-go carries no conditions: nothing is proceeding, so nothing is
  // proceeding under them. The reasons are the whole of that record.
  if (reasons.length > 0) return { verdict: 'no-go', reasons, conditions: [] };
  return { verdict: conditions.length > 0 ? 'go-with-conditions' : 'go', reasons, conditions };
}

/** Where things stand. What the council would be handed today. */
export const CURRENT: LaunchState = {
  gates: GATES,
  council: COUNCIL,
  signoffs: [],
  blockers: [],
  acceptances: [],
  on: '2026-09-27',
};
