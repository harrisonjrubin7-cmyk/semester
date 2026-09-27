/**
 * The feature-flag registry and its one evaluator.
 *
 * A flag's *state* for a school is data: a row in `public.tenant_feature_policy`
 * (read through `public.feature_state`), and a kill switch is a row in
 * `public.feature_kill_switch`. What a flag *is* — who owns it, when it is
 * reviewed, how it is rolled back — lives here, once, and
 * `docs/FEATURE-FLAG-REGISTRY.md` is held to this list by a test.
 *
 * Every flag defaults off. The evaluator walks the order the University OS
 * command sets out, and the first step that says no is the answer:
 *
 *   kill switch → environment → tenant entitlement → connection approval
 *   → scope approval → capability → role policy → data classification
 *   → course/assignment rule → user eligibility → allowed
 *
 * It never throws and never answers "allowed" for a key it does not know.
 */
import type { FeatureState } from '../intelligence/contracts';
import { routeAllowed, type DataClass, type Destination } from './integration/classification';

export type FlagType =
  | 'module'
  | 'connector'
  | 'scope'
  | 'release'
  | 'experiment'
  | 'ops'
  | 'safety'
  | 'writeback';

export type FlagScope = 'global' | 'environment' | 'tenant' | 'role' | 'course' | 'assignment' | 'user';

export type KillSwitchKey =
  | 'kill.integration_sync'
  | 'kill.ai_generation'
  | 'kill.data_upload'
  | 'kill.code_execution'
  | 'kill.sharing'
  | 'kill.writeback';

export const KILL_SWITCHES: readonly KillSwitchKey[] = [
  'kill.integration_sync',
  'kill.ai_generation',
  'kill.data_upload',
  'kill.code_execution',
  'kill.sharing',
  'kill.writeback',
];

export interface FlagDefinition {
  key: string;
  description: string;
  type: FlagType;
  owner: string;
  scopes: readonly FlagScope[];
  /** Always false. Stated so the test can say so rather than assume it. */
  defaultEnabled: false;
  /** High-risk flags are never on by default and need a named approval. */
  highRisk: boolean;
  created: string;
  reviewAt: string;
  /** Required for release and experiment flags, which are temporary. */
  expiresAt?: string;
  rollout: string;
  successCriteria: string;
  rollback: string;
  runbook: string;
  /** Which switches stop this flag, besides a per-connection one. */
  killSwitches: readonly KillSwitchKey[];
  /** The tenant module entitlement this flag sits under, if any. */
  module?: string;
  /** Needs an approved, live integration connection. */
  needsConnection?: boolean;
  /** Needs these provider scopes approved and unexpired. */
  needsScopes?: readonly string[];
  /** The verified capability (over the tenant) the actor must hold. */
  capability?: string;
  /** Where the data this flag moves would go, for the classification check. */
  destination?: Destination;
}

const RUNBOOK = 'docs/FEATURE-FLAG-REGISTRY.md#kill-switch-runbook';
const CREATED = '2026-09-27';
const REVIEW = '2026-12-15';

function flag(d: Omit<FlagDefinition, 'defaultEnabled' | 'created' | 'runbook'> & { runbook?: string }): FlagDefinition {
  return { defaultEnabled: false, created: CREATED, runbook: RUNBOOK, ...d };
}

export const FLAGS: readonly FlagDefinition[] = [
  // ── Modules ─────────────────────────────────────────────────────────────
  flag({
    key: 'module.integration_dashboard',
    description: 'The staff Integration Dashboard: architecture map, connections, mappings, sync history and conflicts.',
    type: 'module', owner: 'Integrations', scopes: ['tenant', 'role'], highRisk: false, reviewAt: REVIEW,
    rollout: 'One pilot school in preview, then its production tenant after an accessibility review.',
    successCriteria: 'Integration staff find a failing connection and its cause without a support ticket.',
    rollback: 'Set the tenant policy row to off. The dashboard reads only; nothing to undo.',
    killSwitches: [], capability: 'integration:view',
  }),
  flag({
    key: 'module.institutional_operations',
    description: 'The staff Operations studio: data dictionary and lineage, suppressed aggregate export, curriculum simulation, accreditation evidence, developer-platform policy and readiness checks.',
    type: 'module', owner: 'Institutional research', scopes: ['tenant', 'role'], highRisk: false, reviewAt: REVIEW,
    rollout: 'Preview for one pilot school’s institutional research office, then its production tenant after a governance review.',
    successCriteria: 'An analyst produces a suppressed, lineage-labelled export without a spreadsheet step; no per-student figure is ever rendered.',
    rollback: 'Unset VITE_INSTITUTIONAL_OPERATIONS (or set it to off) and redeploy: the screen reads the build-time flag, not the tenant policy row. The studio stores its drafts on the analyst’s device only; nothing to undo server-side.',
    killSwitches: [], capability: 'outcomes:read',
  }),
  flag({
    key: 'module.source_freshness_cards',
    description: 'Source and freshness labels on Today, Plan and Me cards that show imported institutional facts.',
    type: 'module', owner: 'Student experience', scopes: ['tenant'], highRisk: false, reviewAt: REVIEW,
    rollout: 'Off until a connection is live for the tenant; then preview for staff accounts first.',
    successCriteria: 'No imported fact is shown without its source and freshness.',
    rollback: 'Set to off. Cards fall back to the student-entered data they show today.',
    // No connection gate: a student cannot read connections, so the evaluator
    // would refuse every student. The card shows only rows RLS already lets
    // the student read, and there are none without a live connection.
    killSwitches: ['kill.integration_sync'],
  }),

  // ── Release (temporary) ─────────────────────────────────────────────────
  flag({
    key: 'release.integration_dashboard_v1',
    description: 'First release of the dashboard screens, while the module flag carries the entitlement.',
    type: 'release', owner: 'Integrations', scopes: ['environment', 'tenant'], highRisk: false,
    reviewAt: REVIEW, expiresAt: '2027-03-01',
    rollout: 'Preview environments, then one production tenant.',
    successCriteria: 'Accessibility journey passes; no credential or student record rendered.',
    rollback: 'Set to off; the University screen shows the control plane as it did before.',
    killSwitches: [], module: 'module.integration_dashboard', capability: 'integration:view',
  }),

  // ── Connectors (every one high-risk) ────────────────────────────────────
  ...([
    ['integration.lms_lti', 'Any LMS through LTI 1.3 / LTI Advantage (Brightspace today): launch context and assignment dates only.'],
    ['integration.sis_read', 'Student information system, read-only: term, program, section, enrollment, registration window.'],
    ['integration.degree_audit_read', 'Degree audit, read-only: requirement status with the audit system named as source.'],
    ['integration.advising_crm', 'Advising CRM: appointment times and referral actions for the student themselves.'],
    ['integration.career', 'Career platform: jobs, internships and events.'],
    ['integration.campus_services', 'Library, tutoring, events, organizations, transit and official alerts.'],
    ['integration.erp_bursar_actions', 'Bursar and aid: a minimal action item and a deep link. No amounts, no decisions, no payments.'],
  ] as const).map(([key, description]) =>
    flag({
      key, description, type: 'connector', owner: 'Integrations', scopes: ['tenant'], highRisk: true,
      reviewAt: REVIEW,
      rollout: 'Sandbox tenant with provider fixtures, then a named pilot with a signed data agreement.',
      successCriteria: 'Contract tests pass against the provider sandbox; freshness meets the target for 14 days.',
      rollback: 'Engage the connection kill switch, set the flag off, then disconnect and revoke.',
      killSwitches: ['kill.integration_sync'], needsConnection: true, destination: 'semester',
    })),

  // ── Scopes ──────────────────────────────────────────────────────────────
  flag({
    key: 'scope.sis.enrollment_read',
    description: 'Read the student’s own enrollments to scope course workspaces. Never a roster.',
    type: 'scope', owner: 'Integrations', scopes: ['tenant', 'user'], highRisk: true, reviewAt: REVIEW,
    rollout: 'After integration.sis_read is live; consent shown before first read.',
    successCriteria: 'Course workspaces match the registrar for every pilot student.',
    rollback: 'Set off and withdraw the scope; mapped references stay but stop refreshing.',
    killSwitches: ['kill.integration_sync'], module: 'integration.sis_read', needsConnection: true,
    needsScopes: ['scope.sis.enrollment_read'], destination: 'semester',
  }),
  flag({
    key: 'scope.lms.assignment_dates_read',
    description: 'Read assignment titles and due dates to place them on Today and Plan.',
    type: 'scope', owner: 'Integrations', scopes: ['tenant', 'course'], highRisk: true, reviewAt: REVIEW,
    rollout: 'After integration.lms_lti is live, one course at a time.',
    successCriteria: 'Due dates match the LMS; stale dates are labelled stale.',
    rollback: 'Set off and withdraw the scope.',
    killSwitches: ['kill.integration_sync'], module: 'integration.lms_lti', needsConnection: true,
    needsScopes: ['scope.lms.assignment_dates_read'], destination: 'semester',
  }),
  flag({
    key: 'scope.sis.registration_hold_summary_read',
    description: 'Whether the student has an action-required hold, and the office’s link. Never the reason.',
    type: 'scope', owner: 'Integrations', scopes: ['tenant', 'user'], highRisk: true, reviewAt: REVIEW,
    rollout: 'After integration.sis_read; registrar signs off the wording.',
    successCriteria: 'Every shown hold resolves at the official link.',
    rollback: 'Set off and withdraw the scope.',
    killSwitches: ['kill.integration_sync'], module: 'integration.sis_read', needsConnection: true,
    needsScopes: ['scope.sis.registration_hold_summary_read'], destination: 'semester',
  }),

  // ── Write-back (every one high-risk, none built) ────────────────────────
  flag({
    key: 'writeback.registration_submit',
    description: 'Submit a registration change to the SIS. Not implemented; the flag exists so the gate does.',
    type: 'writeback', owner: 'Integrations', scopes: ['tenant', 'user'], highRisk: true, reviewAt: REVIEW,
    rollout: 'Not before a separate design review, a registrar agreement and a two-step confirmation.',
    successCriteria: 'n/a until built.',
    rollback: 'Engage kill.writeback.',
    killSwitches: ['kill.writeback', 'kill.integration_sync'], needsConnection: true,
    needsScopes: ['scope.sis.registration_write'], capability: 'integration:approve',
  }),
  flag({
    key: 'writeback.space_booking',
    description: 'Book a study room in the school\'s own booking system on the student\'s behalf. Not implemented; the flag exists so the gate does. Until then "Book" opens the school\'s booking page.',
    type: 'writeback', owner: 'Integrations', scopes: ['tenant', 'user'], highRisk: true, reviewAt: REVIEW,
    rollout: 'Not before a library agreement, a design review and a confirmation step that shows the room, time and rules before anything is sent.',
    successCriteria: 'n/a until built.',
    rollback: 'Engage kill.writeback.',
    killSwitches: ['kill.writeback', 'kill.integration_sync'], needsConnection: true,
    needsScopes: ['scope.library.booking_write'], capability: 'integration:approve',
  }),
  flag({
    key: 'writeback.lms_grade_passback',
    description: 'LTI Assignment and Grade Services passback. Needs tenant, instructor, course and assignment approval.',
    type: 'writeback', owner: 'Integrations', scopes: ['tenant', 'course', 'assignment'], highRisk: true,
    reviewAt: REVIEW,
    rollout: 'Not before an instructor opts a single assignment in.',
    successCriteria: 'n/a until approved.',
    rollback: 'Engage kill.writeback.',
    killSwitches: ['kill.writeback', 'kill.integration_sync'], module: 'integration.lms_lti',
    needsConnection: true, needsScopes: ['scope.lms.score_publish'],
  }),

  // ── Operations and safety ───────────────────────────────────────────────
  flag({
    key: 'ops.external_ai_generation',
    description: 'Generation through an external AI provider for institution-connected data.',
    type: 'ops', owner: 'AI platform', scopes: ['tenant', 'course'], highRisk: true, reviewAt: REVIEW,
    rollout: 'Tenant AI policy and provider agreement first.',
    successCriteria: 'No T3+ datum reaches the provider (classification tests and audit).',
    rollback: 'Engage kill.ai_generation.',
    killSwitches: ['kill.ai_generation'], destination: 'approved_ai',
  }),
  flag({
    key: 'ops.data_upload',
    description: 'Uploading files into institution-connected workspaces.',
    type: 'ops', owner: 'Platform', scopes: ['tenant'], highRisk: true, reviewAt: REVIEW,
    rollout: 'After malware scanning and retention are in place.',
    successCriteria: 'Every upload scanned and retained per tenant policy.',
    rollback: 'Engage kill.data_upload.',
    killSwitches: ['kill.data_upload'],
  }),
  flag({
    key: 'ops.code_sandbox_enabled',
    description: 'Notebook and code execution.',
    type: 'ops', owner: 'Platform', scopes: ['tenant', 'course'], highRisk: true, reviewAt: REVIEW,
    rollout: 'Isolated sandbox review first.', successCriteria: 'No escape in the sandbox review.',
    rollback: 'Engage kill.code_execution.', killSwitches: ['kill.code_execution'],
  }),
  flag({
    key: 'safety.scoped_pseudonymity',
    description: 'Course-scoped pseudonyms in Community.',
    type: 'safety', owner: 'Trust & Safety', scopes: ['tenant', 'course'], highRisk: true, reviewAt: REVIEW,
    rollout: 'After moderation staffing is confirmed.', successCriteria: 'Report response under 24h.',
    rollback: 'Set off; pseudonyms fall back to names at next load.', killSwitches: ['kill.sharing'],
  }),
  flag({
    key: 'safety.volunteer_moderation',
    description: 'Student volunteers moderating course communities.',
    type: 'safety', owner: 'Trust & Safety', scopes: ['tenant', 'course'], highRisk: true, reviewAt: REVIEW,
    rollout: 'Training and an escalation path first.', successCriteria: 'Escalations reach staff within policy.',
    rollback: 'Set off.', killSwitches: ['kill.sharing'],
  }),
  flag({
    key: 'safety.institution_escalation',
    description: 'Escalating a report to the institution.',
    type: 'safety', owner: 'Trust & Safety', scopes: ['tenant'], highRisk: true, reviewAt: REVIEW,
    rollout: 'Named institutional contact and agreement first.', successCriteria: 'Every escalation acknowledged.',
    rollback: 'Set off.', killSwitches: [],
  }),

  // ── Experiments (temporary) ─────────────────────────────────────────────
  flag({
    key: 'experiment.today_action_ranking_v2',
    description: 'A second ranking of Today’s action cards that weighs source freshness.',
    type: 'experiment', owner: 'Student experience', scopes: ['tenant', 'user'], highRisk: false,
    reviewAt: REVIEW, expiresAt: '2027-01-31',
    rollout: '10% of pilot students, compared on actions completed before their deadline.',
    successCriteria: 'More actions completed on time, no rise in dismissals.',
    rollback: 'Set off; Today returns to the current ranking.', killSwitches: [],
    module: 'module.source_freshness_cards',
  }),
];

export const FLAG_KEYS: ReadonlySet<string> = new Set(FLAGS.map((f) => f.key));

export function flagDefinition(key: string): FlagDefinition | undefined {
  return FLAGS.find((f) => f.key === key);
}

// ── Evaluation ────────────────────────────────────────────────────────────

export type Environment = 'development' | 'preview' | 'production';

export interface KillSwitchRow {
  key: string;
  /** Null for a global switch. */
  tenantId: string | null;
  engaged: boolean;
}

export interface ScopeGrant {
  key: string;
  approved: boolean;
  expiresAt?: string | null;
}

export interface FlagContext {
  environment: Environment;
  tenantId: string | null;
  now: Date;
  killSwitches: readonly KillSwitchRow[];
  /** `tenant_feature_policy` rows for this tenant, by key. Absent means off. */
  tenantPolicy: Readonly<Record<string, { state: FeatureState; permittedRoles?: readonly string[] }>>;
  connection?: { publicId: string; approved: boolean; status: string } | null;
  scopes?: readonly ScopeGrant[];
  /** Capabilities *verified* over this tenant — never a role picker. */
  capabilities: readonly string[];
  role?: string;
  classification?: DataClass;
  /** A course or assignment rule that applies, when there is one. */
  courseRule?: { allowed: boolean } | null;
  /** Per-user eligibility (consent given, account in good standing). */
  userEligible?: boolean;
}

export type FlagStep =
  | 'unknown_flag'
  | 'kill_switch'
  | 'environment'
  | 'tenant_entitlement'
  | 'connection'
  | 'scope'
  | 'capability'
  | 'role_policy'
  | 'classification'
  | 'course_rule'
  | 'user_eligibility'
  | 'allowed';

export interface FlagDecision {
  allowed: boolean;
  step: FlagStep;
  reason: string;
}

const deny = (step: FlagStep, reason: string): FlagDecision => ({ allowed: false, step, reason });

/** Which tenant states a given environment accepts as "on". */
function stateIsOn(state: FeatureState, environment: Environment): boolean {
  if (state === 'off') return false;
  if (environment === 'production') return state === 'production';
  return true;
}

function tenantOn(key: string, ctx: FlagContext): boolean {
  const row = ctx.tenantPolicy[key];
  return !!row && stateIsOn(row.state, ctx.environment);
}

export function evaluateFlag(key: string, ctx: FlagContext): FlagDecision {
  const def = flagDefinition(key);
  if (!def) return deny('unknown_flag', `No flag is registered as ${key}.`);

  // 1. Kill switches: global first, then this tenant, then this connection.
  for (const sw of ctx.killSwitches) {
    if (!sw.engaged) continue;
    if (sw.tenantId !== null && sw.tenantId !== ctx.tenantId) continue;
    const perConnection = ctx.connection && sw.key === `kill.connection.${ctx.connection.publicId}`;
    if (def.killSwitches.includes(sw.key as KillSwitchKey) || perConnection) {
      return deny('kill_switch', `${sw.key} is engaged${sw.tenantId === null ? ' for every school' : ''}.`);
    }
  }

  // 2. Environment. Temporary flags past expiry are off everywhere.
  if (def.expiresAt && ctx.now >= new Date(def.expiresAt)) {
    return deny('environment', `${key} expired on ${def.expiresAt} and is off until it is removed or renewed.`);
  }
  if (!ctx.tenantId) return deny('environment', 'No verified school, so no tenant flag can apply.');

  // 3. Tenant entitlement: the parent module, then the flag itself.
  if (def.module && !tenantOn(def.module, ctx)) {
    return deny('tenant_entitlement', `${def.module} is not enabled for this school in ${ctx.environment}.`);
  }
  if (!tenantOn(key, ctx)) {
    return deny('tenant_entitlement', `${key} is not enabled for this school in ${ctx.environment}.`);
  }

  // 4. Connection approval.
  if (def.needsConnection) {
    const c = ctx.connection;
    if (!c || !c.approved) return deny('connection', 'No approved connection backs this feature.');
    if (!['healthy', 'degraded'].includes(c.status)) {
      return deny('connection', `The connection is ${c.status}.`);
    }
  }

  // 5. Provider scopes.
  for (const want of def.needsScopes ?? []) {
    const s = ctx.scopes?.find((g) => g.key === want);
    if (!s || !s.approved) return deny('scope', `${want} is not approved.`);
    if (s.expiresAt && ctx.now >= new Date(s.expiresAt)) return deny('scope', `${want} has expired.`);
  }

  // 6. Capability over this tenant.
  if (def.capability && !ctx.capabilities.includes(def.capability)) {
    return deny('capability', `This needs ${def.capability} at this school.`);
  }

  // 7. Role policy from the tenant row, when it names roles.
  const permitted = ctx.tenantPolicy[key]?.permittedRoles ?? [];
  if (permitted.length > 0 && (!ctx.role || !permitted.includes(ctx.role))) {
    return deny('role_policy', 'This school has limited this feature to other roles.');
  }

  // 8. Data classification.
  if (def.destination && ctx.classification && !routeAllowed(ctx.classification, def.destination)) {
    return deny('classification', `${ctx.classification} data may not go to ${def.destination}.`);
  }

  // 9. Course or assignment rule.
  if (ctx.courseRule && !ctx.courseRule.allowed) return deny('course_rule', 'The course policy does not allow this.');

  // 10. User eligibility.
  if (ctx.userEligible === false) return deny('user_eligibility', 'This account is not eligible (consent or standing).');

  return { allowed: true, step: 'allowed', reason: 'Every gate passed.' };
}
