/**
 * Reports, triage, cases and decisions.
 *
 * Two apps set the bounds. Yik Yak let the crowd decide: five downvotes and a
 * post was gone, which made removal a thing a group could do to a person.
 * Jodel put people in the loop — several moderators must agree, a reporting
 * moderator's own vote does not count — and attached a karma penalty to a
 * blocked post. Semester keeps the people and drops both the crowd verdict and
 * the points:
 *
 * - **Reports and automated signals only triage.** They open a case, set a
 *   provisional severity and may apply a *reversible* protection (hold,
 *   reduce distribution, rate limit). They never remove, ban or escalate.
 * - **Decisions are human and role-bound.** P0/P1 go to professional Trust &
 *   Safety only. Volunteers (when that exists at all) see P3 and a narrow set
 *   of clear P2 categories.
 * - **Appeals are independent.** Nobody who decided a case may decide its
 *   appeal, and an appeal is always professional.
 * - **Everything is an audit event**, frozen when written, with a reason code,
 *   the actor's role and the state before and after.
 *
 * Thresholds are data (TRIAGE_THRESHOLDS) so a tenant's configuration can be
 * reviewed as a diff rather than read out of code.
 */

export const REPORT_CATEGORIES = [
  'harassment_or_bullying',
  'threat_or_safety_concern',
  'hate_or_discrimination',
  'private_information_or_doxxing',
  'impersonation',
  'nonconsensual_media',
  'spam_scam_or_phishing',
  'academic_integrity',
  'other',
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';

/** Categories where one report is enough to hold content and route to professionals. */
export const HIGH_RISK_CATEGORIES: readonly ReportCategory[] = [
  'threat_or_safety_concern',
  'private_information_or_doxxing',
  'nonconsensual_media',
  'hate_or_discrimination',
];

/** Qualifiers a reporter can tick; they only ever raise provisional severity. */
export interface ReportQualifiers {
  imminent?: boolean;
  involvesMinor?: boolean;
  sexual?: boolean;
  stalking?: boolean;
  selfHarmConcern?: boolean;
  credibleScam?: boolean;
  seriousImpersonation?: boolean;
  severe?: boolean;
}

export function provisionalSeverity(category: ReportCategory, q: ReportQualifiers = {}): Severity {
  if (q.imminent || q.involvesMinor) return 'P0';
  switch (category) {
    case 'private_information_or_doxxing':
    case 'nonconsensual_media':
      return 'P0';
    case 'threat_or_safety_concern':
      return 'P1';
    case 'hate_or_discrimination':
      return 'P1';
    case 'harassment_or_bullying':
      return q.stalking || q.severe || q.sexual ? 'P1' : 'P2';
    case 'impersonation':
      return q.seriousImpersonation ? 'P1' : 'P2';
    case 'spam_scam_or_phishing':
      return q.credibleScam ? 'P1' : 'P2';
    case 'academic_integrity':
      return 'P2';
    case 'other':
      return q.selfHarmConcern ? 'P1' : 'P3';
  }
}

/* ------------------------------------------------------------------ */
/* Signals and triage                                                  */
/* ------------------------------------------------------------------ */

export type SignalSource = 'report' | 'detector';

export type DetectorKind =
  | 'pii_doxxing'
  | 'threat_crisis_language'
  | 'hate_slur_risk'
  | 'scam_phishing_link'
  | 'media_safety'
  | 'bot_rate_brigading'
  | 'academic_integrity'
  | 'impersonation';

/**
 * One report or automated signal. For detectors this is the record the spec
 * asks for: what fired, how sure, which version, when, where it routed — and,
 * filled in later, what the human decided.
 */
export interface SafetySignal {
  id: string;
  targetId: string;
  source: SignalSource;
  at: string;
  category: ReportCategory;
  qualifiers?: ReportQualifiers;
  /** Reports: opaque reporter id. Never leaves the professional store. */
  reporterId?: string;
  detector?: DetectorKind;
  confidence?: number;
  version?: string;
  route?: Route;
  humanOutcome?: DecisionAction;
}

export type Protection = 'none' | 'queue' | 'monitor' | 'reduce_distribution' | 'temporary_hold';
export type Route = 'professional_urgent' | 'professional' | 'standard' | 'integrity_review';

export const TRIAGE_THRESHOLDS = {
  /** Two distinct needs-review signals inside this window → monitor. */
  monitorWindowMin: 30,
  monitorCount: 2,
  /** Distinct reporters inside this window → reduced distribution pending review. */
  reduceWindowMin: 60,
  reduceCount: 3,
  /** Detector confidence at or above this is "high". */
  highConfidence: 0.9,
  /** Account-level review triggers, over this many days. */
  accountWindowDays: 30,
  confirmedP2ForReview: 3,
  confirmedP1ForReview: 1,
  confirmedP0ForReview: 1,
} as const;

export interface Triage {
  severity: Severity;
  protection: Protection;
  route: Route;
  /** Plain reasons, recorded on the case. */
  why: string[];
}

const RANK: Record<Severity, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const PROTECTION_RANK: Record<Protection, number> = {
  none: 0,
  queue: 1,
  monitor: 2,
  reduce_distribution: 3,
  temporary_hold: 4,
};

function within(at: string, now: Date, minutes: number): boolean {
  const t = new Date(at).getTime();
  return t <= now.getTime() && now.getTime() - t <= minutes * 60_000;
}

/**
 * Triage every signal on one target. Pure and idempotent: the same signals
 * always produce the same triage, so it can be recomputed as signals arrive.
 *
 * `brigadeReporters` are reporters the integrity detector clustered as
 * coordinated. Their reports are set aside — they neither count toward the
 * reduce threshold nor punish the target — and the cluster itself goes to
 * integrity review.
 */
export function triage(signals: SafetySignal[], now: Date, brigadeReporters: ReadonlySet<string> = new Set()): Triage {
  const why: string[] = [];
  // Widened on purpose: the closures below raise these, which narrowing misses.
  let severity = 'P3' as Severity;
  let protection = 'none' as Protection;
  let route = 'standard' as Route;

  const raise = (s: Severity) => {
    if (RANK[s] < RANK[severity]) severity = s;
  };
  const protect = (p: Protection, reason: string) => {
    if (PROTECTION_RANK[p] > PROTECTION_RANK[protection]) protection = p;
    why.push(reason);
  };

  const counted = signals.filter((s) => !(s.reporterId && brigadeReporters.has(s.reporterId)));
  const setAside = signals.length - counted.length;

  if (setAside > 0) {
    route = 'integrity_review';
    why.push(`${setAside} report(s) matched a coordinated-reporting pattern and were set aside for integrity review.`);
  }
  if (counted.length > 0) protect('queue', 'At least one needs-review signal.');

  // A high-risk report holds even when it was set aside as brigading: the
  // hold protects the person the post is about and a reviewer can lift it.
  for (const s of signals) {
    if (s.source === 'report' && HIGH_RISK_CATEGORIES.includes(s.category)) {
      protect('temporary_hold', `High-risk report: ${s.category}.`);
    }
  }

  for (const s of counted) {
    raise(provisionalSeverity(s.category, s.qualifiers));
    if (
      s.source === 'detector' &&
      s.detector === 'pii_doxxing' &&
      (s.confidence ?? 0) >= TRIAGE_THRESHOLDS.highConfidence
    ) {
      raise('P0');
      protect('temporary_hold', 'High-confidence private-information detection.');
    }
  }

  const recent = counted.filter((s) => within(s.at, now, TRIAGE_THRESHOLDS.monitorWindowMin));
  const distinctRecent = new Set(recent.map((s) => s.reporterId ?? `detector:${s.detector}`));
  if (distinctRecent.size >= TRIAGE_THRESHOLDS.monitorCount) {
    protect('monitor', `${distinctRecent.size} distinct signals in ${TRIAGE_THRESHOLDS.monitorWindowMin} minutes.`);
  }

  const reporters = new Set(
    counted
      .filter((s) => s.source === 'report' && s.reporterId && within(s.at, now, TRIAGE_THRESHOLDS.reduceWindowMin))
      .map((s) => s.reporterId),
  );
  if (reporters.size >= TRIAGE_THRESHOLDS.reduceCount) {
    protect('reduce_distribution', `${reporters.size} distinct reporters in ${TRIAGE_THRESHOLDS.reduceWindowMin} minutes.`);
  }

  if (route !== 'integrity_review') {
    route = severity === 'P0' ? 'professional_urgent' : severity === 'P1' ? 'professional' : 'standard';
  } else if (severity === 'P0' || severity === 'P1') {
    // A brigade does not hide a genuine high-severity report among the rest.
    route = severity === 'P0' ? 'professional_urgent' : 'professional';
  }
  return { severity, protection, route, why };
}

/**
 * Account-level review triggers from *confirmed* outcomes. These recommend a
 * human review; they never restrict anybody on their own.
 */
export function accountReview(
  confirmed: { severity: Severity; decidedAt: string }[],
  now: Date,
): 'none' | 'professional_restriction_review' | 'temporary_restriction_senior_review' | 'immediate_hold_urgent_review' {
  const days = TRIAGE_THRESHOLDS.accountWindowDays;
  const inWindow = confirmed.filter((c) => within(c.decidedAt, now, days * 24 * 60));
  const count = (s: Severity) => inWindow.filter((c) => c.severity === s).length;
  if (count('P0') >= TRIAGE_THRESHOLDS.confirmedP0ForReview) return 'immediate_hold_urgent_review';
  if (count('P1') >= TRIAGE_THRESHOLDS.confirmedP1ForReview) return 'temporary_restriction_senior_review';
  if (count('P2') >= TRIAGE_THRESHOLDS.confirmedP2ForReview) return 'professional_restriction_review';
  return 'none';
}

/* ------------------------------------------------------------------ */
/* Cases, decisions, appeals, audit                                    */
/* ------------------------------------------------------------------ */

export const DECISION_ACTIONS = [
  'allow',
  'label',
  'reduce_distribution',
  'remove',
  'lock_thread',
  'limit_replies',
  'rate_limit',
  'community_restriction',
  'account_restriction',
  'preserve_evidence',
  'escalate',
  'close_no_action',
] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

/** What automation may apply. All temporary, all reversible. */
export const AUTOMATION_ACTIONS: readonly DecisionAction[] = ['reduce_distribution', 'rate_limit', 'preserve_evidence'];

/** What a volunteer may decide, on the queues they can see. */
export const VOLUNTEER_ACTIONS: readonly DecisionAction[] = ['allow', 'label', 'remove', 'close_no_action'];

/** Clear P2 categories a volunteer queue may include. */
export const VOLUNTEER_P2_CATEGORIES: readonly ReportCategory[] = ['spam_scam_or_phishing', 'other'];

export type ActorKind = 'student' | 'automation' | 'volunteer' | 'professional' | 'senior_professional';

export interface Actor {
  id: string;
  kind: ActorKind;
}

export type CaseStatus = 'open' | 'in_review' | 'decided' | 'appealed' | 'closed';

export interface AuditEvent {
  readonly at: string;
  readonly caseId: string;
  readonly actorKind: ActorKind;
  readonly actorId: string;
  readonly event: string;
  readonly reasonCode: string;
  readonly before: CaseStatus;
  readonly after: CaseStatus;
}

export interface Decision {
  actorId: string;
  actorKind: ActorKind;
  action: DecisionAction;
  reasonCode: string;
  at: string;
}

export interface ModerationCase {
  id: string;
  targetId: string;
  category: ReportCategory;
  severity: Severity;
  protection: Protection;
  route: Route;
  status: CaseStatus;
  decisions: Decision[];
  /** Volunteer votes awaiting a second independent volunteer. */
  pendingVolunteer: Decision[];
  appeal?: { filedAt: string; decision?: Decision };
  audit: readonly AuditEvent[];
  retainUntil?: string;
}

export class ModerationRefused extends Error {}

function audit(c: ModerationCase, actor: Actor, event: string, reasonCode: string, after: CaseStatus, at: Date): ModerationCase {
  const entry: AuditEvent = Object.freeze({
    at: at.toISOString(),
    caseId: c.id,
    actorKind: actor.kind,
    actorId: actor.id,
    event,
    reasonCode,
    before: c.status,
    after,
  });
  return { ...c, status: after, audit: Object.freeze([...c.audit, entry]) };
}

export function openCase(args: {
  id: string;
  targetId: string;
  signals: SafetySignal[];
  now: Date;
  brigadeReporters?: ReadonlySet<string>;
}): ModerationCase {
  const t = triage(args.signals, args.now, args.brigadeReporters);
  // The case's category is the one driving severity.
  const lead =
    args.signals
      .filter((s) => !(s.reporterId && args.brigadeReporters?.has(s.reporterId)))
      .sort((a, b) => RANK[provisionalSeverity(a.category, a.qualifiers)] - RANK[provisionalSeverity(b.category, b.qualifiers)])[0]
      ?.category ?? 'other';
  const blank: ModerationCase = {
    id: args.id,
    targetId: args.targetId,
    category: lead,
    severity: t.severity,
    protection: t.protection,
    route: t.route,
    status: 'open',
    decisions: [],
    pendingVolunteer: [],
    audit: Object.freeze([]),
  };
  return audit(blank, { id: 'triage', kind: 'automation' }, 'case_opened', `triage:${t.severity}:${t.protection}`, 'open', args.now);
}

/** Whether this actor may decide this case at all. */
export function mayDecide(c: ModerationCase, actor: Actor): boolean {
  if (actor.kind === 'automation' || actor.kind === 'student') return false;
  if (actor.kind === 'volunteer') {
    if (c.severity === 'P0' || c.severity === 'P1') return false;
    if (c.route !== 'standard') return false;
    if (c.severity === 'P2' && !VOLUNTEER_P2_CATEGORIES.includes(c.category)) return false;
    return true;
  }
  return true;
}

/** Automation applying a temporary protection — the only thing it may do. */
export function protect(c: ModerationCase, action: DecisionAction, now: Date): ModerationCase {
  if (!AUTOMATION_ACTIONS.includes(action)) {
    throw new ModerationRefused(`Automation may not ${action}; it can only apply reversible protections.`);
  }
  return audit(c, { id: 'triage', kind: 'automation' }, `protection:${action}`, 'automated_triage', c.status, now);
}

export function decide(c: ModerationCase, actor: Actor, action: DecisionAction, reasonCode: string, now: Date): ModerationCase {
  if (!mayDecide(c, actor)) {
    throw new ModerationRefused(`${actor.kind} may not decide a ${c.severity} ${c.category} case.`);
  }
  if (c.status === 'closed' || c.status === 'appealed') throw new ModerationRefused(`Case is ${c.status}.`);
  if (!reasonCode.trim()) throw new ModerationRefused('A policy reason code is required.');
  if (action === 'escalate' && actor.kind !== 'professional' && actor.kind !== 'senior_professional') {
    throw new ModerationRefused('Only professionals escalate.');
  }
  if (action === 'account_restriction' && c.severity === 'P0' && actor.kind === 'professional') {
    // P0 account restrictions are a senior decision.
    throw new ModerationRefused('A P0 account restriction needs a senior professional.');
  }

  const decision: Decision = { actorId: actor.id, actorKind: actor.kind, action, reasonCode, at: now.toISOString() };

  if (actor.kind === 'volunteer') {
    if (!VOLUNTEER_ACTIONS.includes(action)) throw new ModerationRefused(`Volunteers may not ${action}.`);
    if (c.pendingVolunteer.some((d) => d.actorId === actor.id)) {
      throw new ModerationRefused('The same volunteer cannot count twice.');
    }
    // Removal needs two independent volunteers who agree.
    if (action === 'remove') {
      const agreeing = c.pendingVolunteer.find((d) => d.action === 'remove');
      if (!agreeing) {
        const next = { ...c, pendingVolunteer: [...c.pendingVolunteer, decision] };
        return audit(next, actor, 'volunteer_vote:remove', reasonCode, 'in_review', now);
      }
      const next = { ...c, decisions: [...c.decisions, agreeing, decision], pendingVolunteer: [] };
      return audit(next, actor, 'decided:remove', reasonCode, 'decided', now);
    }
    // Volunteers who disagree do not settle it between them: a professional does.
    if (c.pendingVolunteer.some((d) => d.action === 'remove')) {
      const next: ModerationCase = { ...c, route: 'professional', pendingVolunteer: [...c.pendingVolunteer, decision] };
      return audit(next, actor, 'volunteer_disagreement', reasonCode, 'in_review', now);
    }
  }

  const next = { ...c, decisions: [...c.decisions, decision], pendingVolunteer: [] };
  return audit(next, actor, `decided:${action}`, reasonCode, 'decided', now);
}

/**
 * How long after a decision its subject may appeal it. Measured from the
 * decision, not from the report. The same number is in the database
 * (`appeal_community_decision`, `my_community_notices`), and
 * `appealwindow.test.ts` holds the two to each other. The words are what the
 * student notice says: it carries no digits, so that a number in it can only
 * ever be a score.
 */
export const APPEAL_RULES = { filingWindowDays: 30, filingWindowWords: 'thirty days' } as const;

export function fileAppeal(c: ModerationCase, byAccount: string, now: Date): ModerationCase {
  if (c.status !== 'decided') throw new ModerationRefused('Only a decided case can be appealed.');
  const last = c.decisions[c.decisions.length - 1];
  if (!last || last.action === 'allow' || last.action === 'close_no_action') {
    throw new ModerationRefused('There is nothing to appeal.');
  }
  if (now.getTime() - Date.parse(last.at) > APPEAL_RULES.filingWindowDays * 86_400_000) {
    throw new ModerationRefused('The appeal window has closed.');
  }
  return audit({ ...c, appeal: { filedAt: now.toISOString() } }, { id: byAccount, kind: 'student' }, 'appeal_filed', 'appeal', 'appealed', now);
}

/** An appeal is decided by a professional who took no part in the original decision. */
export function decideAppeal(c: ModerationCase, actor: Actor, action: DecisionAction, reasonCode: string, now: Date): ModerationCase {
  if (c.status !== 'appealed' || !c.appeal) throw new ModerationRefused('No appeal is open.');
  if (actor.kind !== 'professional' && actor.kind !== 'senior_professional') {
    throw new ModerationRefused('Appeals are decided by professional reviewers only.');
  }
  if (c.decisions.some((d) => d.actorId === actor.id)) {
    throw new ModerationRefused('A reviewer who decided the case may not decide its appeal.');
  }
  const decision: Decision = { actorId: actor.id, actorKind: actor.kind, action, reasonCode, at: now.toISOString() };
  return audit({ ...c, appeal: { ...c.appeal, decision } }, actor, `appeal_decided:${action}`, reasonCode, 'closed', now);
}

/** The case as a volunteer sees it: no reporter, no identity, no other votes. */
export function blindView(c: ModerationCase): Pick<ModerationCase, 'id' | 'category' | 'severity' | 'status'> {
  return { id: c.id, category: c.category, severity: c.severity, status: c.status };
}

/** What the reported student is told. Plain language, never a score. */
export function studentNotice(c: ModerationCase): string | null {
  const last = c.appeal?.decision ?? c.decisions[c.decisions.length - 1];
  if (!last) return null;
  const appealable = !c.appeal && last.action !== 'allow' && last.action !== 'close_no_action';
  const tail = appealable ? ` You can appeal this decision within ${APPEAL_RULES.filingWindowWords}.` : '';
  switch (last.action) {
    case 'remove':
      return `Your post was removed because it broke the community rules (${last.reasonCode}).${tail}`;
    case 'label':
      return `A label was added to your post (${last.reasonCode}).${tail}`;
    case 'reduce_distribution':
      return `Your post will be shown to fewer people (${last.reasonCode}).${tail}`;
    case 'limit_replies':
    case 'lock_thread':
      return `Replies to your post were limited (${last.reasonCode}).${tail}`;
    case 'rate_limit':
      return `You can post less often for a while (${last.reasonCode}).${tail}`;
    case 'community_restriction':
      return `You can't post in this community for a while (${last.reasonCode}).${tail}`;
    case 'account_restriction':
      return `Your Community access is restricted (${last.reasonCode}).${tail}`;
    default:
      return null;
  }
}
