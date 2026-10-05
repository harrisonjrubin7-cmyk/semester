/**
 * How Semester Communities is allowed to grow: the principle, the non-goals,
 * the phases, the readiness brief every community feature answers before it
 * is built, the gates a tenant passes before a programme is switched on, the
 * severity ladder, the packaging, and the money Semester will not take.
 *
 * Four blueprints (September 2026) describe the community layer — clubs,
 * events, circles, mentorship, questions, safety, services, opportunity,
 * integrations — and agree on one design principle, which is the first
 * export here. Everything below it is data so a reviewer can read a change
 * as a diff; `governance.test.ts` holds the shape, and
 * `lib/communitiesregister.ts` records where each blueprint item stands.
 *
 * ## How this relates to what is already here
 *
 * `lib/expansiongovernance.ts#admit` gates a long-horizon capability into
 * delivery and `governance/charters.ts` charters a module flag. Neither asks
 * what Semester must *not* decide or infer, what the abuse cases are, who
 * moderates, or how a student exports, deletes or revokes — the questions a
 * community feature is most likely to get wrong. `brief()` asks those and
 * nothing the other two already ask. `readyToEnable()` is per tenant and per
 * programme, which is where `community_programs` is switched, and it wants
 * the eleven conditions the blueprints list before a switch is thrown.
 */

export const DESIGN_PRINCIPLE =
  'Do not optimize for endless scrolling. Optimize for belonging, useful connection, real-world participation, accessible information, and safe next actions.';

/** What Semester Communities is not, in the blueprints' words. */
export const NON_GOALS = [
  'Not a replacement for official campus emergency services',
  'Not an unrestricted anonymous social network',
  'Not a student-risk surveillance product',
  'Not a behavioral-advertising network',
  'Not an automated disciplinary-decision system',
  'Not a default public record of student identity, activity, or affiliations',
] as const;

// ── Phases ──────────────────────────────────────────────────────────────────

export const COMMUNITY_PHASES = {
  1: { name: 'Safe foundations', build: 'Official club and service directory, events, source-labeled questions and answers, accessible discovery, privacy controls, block, mute and report, a basic moderation queue', why: 'High value; lower risk; reinforces academic navigation' },
  2: { name: 'Organization operations', build: 'Officer workspace, recognition workflow, event approvals, membership requests, forms, documents, officer transition, training acknowledgements', why: 'Real operating value for organizations and students' },
  3: { name: 'Structured belonging', build: 'Peer circles, structured study groups, trained mentorship with transparent matching, coordinator dashboard, co-design studio', why: 'Strong belonging and retention once safety operations are mature' },
  4: { name: 'Network value', build: 'Opportunity exchange, project and portfolio evidence, alumni and employer programmes, credentials', why: 'Connects academic life to career and long-term value' },
  5: { name: 'Higher-risk commerce and social', build: 'Marketplace, resale, payments, ticketing, ride coordination, external social publishing, broad social feed', why: 'Only after dedicated trust-and-safety, financial and legal infrastructure exists' },
} as const;

export type CommunityPhase = keyof typeof COMMUNITY_PHASES;

// ── The Feature Readiness Brief ─────────────────────────────────────────────

/**
 * Fourteen questions, each answered in writing before a community, AI,
 * campus-life, career, payments or operations feature is developed. A blank
 * is a no; so is a bare "yes".
 */
export const READINESS_BRIEF = [
  { id: 'who', ask: 'Who is this for?' },
  { id: 'problem', ask: 'What real problem does it solve?' },
  { id: 'outcome', ask: 'What is the first useful outcome?' },
  { id: 'never', ask: 'What must Semester not decide or infer?' },
  { id: 'data', ask: 'What data is required, optional, sensitive, or prohibited?' },
  { id: 'source', ask: 'What is the source, authority, scope, and freshness model?' },
  { id: 'accessibility', ask: 'What are the accessibility requirements?' },
  { id: 'abuse', ask: 'What are the safety and abuse cases?' },
  { id: 'owner', ask: 'Who moderates or owns it?' },
  { id: 'escalation', ask: 'What is the escalation path?' },
  { id: 'failure', ask: 'What is the failure and recovery path?' },
  { id: 'exit', ask: 'How do users export, delete, or revoke access?' },
  { id: 'proof', ask: 'What metric proves it creates value?' },
  { id: 'stop', ask: 'What evidence would make us stop or redesign it?' },
] as const;

export type BriefId = (typeof READINESS_BRIEF)[number]['id'];

export interface Brief {
  feature: string;
  answers: Partial<Record<BriefId, string>>;
}

export interface BriefVerdict {
  complete: boolean;
  unanswered: BriefId[];
}

/**
 * An answer shorter than this is a label, not a reason. It is also what
 * makes a bare "yes", "no", "n/a" or "TBD" a non-answer: none of them is
 * twenty characters, and the rule is the length rather than a list of words
 * to dodge.
 */
export const MIN_ANSWER = 20;

export function brief(b: Brief): BriefVerdict {
  const unanswered = READINESS_BRIEF.map((q) => q.id).filter((id) => (b.answers[id]?.trim().length ?? 0) < MIN_ANSWER);
  return { complete: unanswered.length === 0, unanswered };
}

// ── Launch gates, per tenant and per programme ──────────────────────────────

/**
 * Before any community or mentorship programme is enabled for a tenant. The
 * eleven the blueprints require; `community_programs.approved_ref` is where
 * the record of passing them is cited.
 */
export const LAUNCH_GATES = [
  { id: 'owner', ask: 'A named institutional owner' },
  { id: 'policy', ask: 'An approved policy and code of conduct, with a version' },
  { id: 'moderators', ask: 'Moderator roles assigned and training complete' },
  { id: 'escalation', ask: 'An escalation and emergency-routing plan' },
  { id: 'sla', ask: 'A defined support and response service level' },
  { id: 'retention', ask: 'Privacy, retention and deletion configured' },
  { id: 'accessibility', ask: 'An accessibility test of the core workflows' },
  { id: 'risk', ask: 'A tenant-specific risk review' },
  { id: 'disclosure', ask: 'Student-facing disclosure and consent language' },
  { id: 'evaluation', ask: 'A metrics and programme-evaluation plan' },
  { id: 'closure', ask: 'A closure and offboarding procedure' },
] as const;

export type GateId = (typeof LAUNCH_GATES)[number]['id'];

/** Which programmes the gate applies to: everything `community_programs` can switch, and mentorship. */
export const GATED_PROGRAMS = [
  'community_feed', 'institution_escalation', 'volunteer_moderation', 'scoped_pseudonymity',
  'account_safety_state', 'community_images', 'peer_mentorship', 'peer_circles',
] as const;
export type GatedProgram = (typeof GATED_PROGRAMS)[number];

export interface GateRecord {
  /** Who signed it off, as a seat or a name — never blank. */
  by: string;
  /** Where the evidence is: a document path, a ticket, a signed form. */
  evidence: string;
  on: string;
}

export interface EnableRequest {
  tenant: string;
  program: GatedProgram;
  gates: Partial<Record<GateId, GateRecord>>;
}

export interface EnableVerdict {
  ready: boolean;
  missing: GateId[];
  reasons: string[];
}

const filled = (r: GateRecord | undefined) => !!r && r.by.trim().length > 0 && r.evidence.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.on);

export function readyToEnable(req: EnableRequest): EnableVerdict {
  const reasons: string[] = [];
  if (!(GATED_PROGRAMS as readonly string[]).includes(req.program)) reasons.push(`"${req.program}" is not a programme this gate knows`);
  const missing = LAUNCH_GATES.map((g) => g.id).filter((id) => !filled(req.gates[id]));
  if (missing.length) reasons.push(`${missing.length} gate(s) without a signed record: ${missing.join(', ')}`);
  return { ready: reasons.length === 0, missing, reasons };
}

// ── Severity ────────────────────────────────────────────────────────────────

/**
 * The five levels the blueprints describe. `community/moderation.ts` and the
 * `community_cases` table implement P0–P3 for posts; P4 is the level that is
 * a member's own tools — mute, leave, ignore — and a club moderator's light
 * touch, and it never opens a case. The target is a promise a staffed
 * operation makes, not a timer the app runs: see the note under it.
 */
export const SEVERITY_LADDER = [
  { level: 'P0', example: 'Credible imminent danger, active threat, severe exploitation', response: 'Show official emergency guidance; preserve restricted evidence; trigger the approved escalation path', owner: 'Authorized safety or emergency process', target: 'Immediate, according to institutional protocol', opensCase: true },
  { level: 'P1', example: 'Doxxing, credible threat, severe harassment, sexual exploitation', response: 'Restrict content and relevant account capabilities pending review', owner: 'Trust and safety lead', target: 'Minutes to hours', opensCase: true },
  { level: 'P2', example: 'Targeted bullying, hate, repeated harassment, serious scam', response: 'Queue for trained review; proportionate protective action', owner: 'Trained moderator', target: 'Same business day or the defined service level', opensCase: true },
  { level: 'P3', example: 'Spam, off-topic promotion, impersonation concern, ordinary conduct breach', response: 'Filter or limit distribution; moderator review', owner: 'Moderator or club administrator', target: 'The defined routine service level', opensCase: true },
  { level: 'P4', example: 'Duplicate post, low-risk disagreement, minor etiquette issue', response: 'Member controls or light moderation', owner: 'Community or club moderator', target: 'As capacity permits', opensCase: false },
] as const;

export type SeverityLevel = (typeof SEVERITY_LADDER)[number]['level'];

/**
 * Semester is not an emergency service. The ladder's targets are what a
 * tenant's staffed operation commits to at the `sla` gate; the app shows the
 * official emergency route and never promises a response time of its own.
 */
export const NOT_AN_EMERGENCY_SERVICE =
  'Semester is not an emergency service and does not promise 24/7 crisis response. If someone is in danger now, use the official emergency route shown here.';

// ── Engagement mechanics ────────────────────────────────────────────────────

/** Mechanics that may be built, each with the rule that keeps it honest. */
export const ALLOWED_MECHANICS = [
  { mechanic: 'Progress pathways', use: 'Orientation, leadership, service, career, transfer transition, officer readiness', rule: 'Optional, non-punitive, transparent; never implies deficit or failure' },
  { mechanic: 'Verified contribution badges', use: 'Training, service, project work, leadership, skills', rule: 'Only with issuer, criteria, evidence and a correction path; portable where possible' },
  { mechanic: 'Reflection milestones', use: 'Articulating what an experience taught', rule: 'Private by default; shared only by the student\'s choice' },
  { mechanic: 'Community challenges', use: 'Collaborative service, learning or resource-discovery goals', rule: 'Team-based; no scarcity pressure and no public shaming' },
  { mechanic: 'Event passports', use: 'Exploring campus services and opportunities', rule: 'Never requires disclosing a sensitive affiliation or an attendance history' },
  { mechanic: 'Officer readiness checklist', use: 'Organizations surviving turnover', rule: 'Administrative readiness, not surveillance' },
  { mechanic: 'Recognition wall', use: 'Celebrating accomplishments', rule: 'Explicit consent; private by default' },
] as const;

/**
 * Never built. `engagement.test.ts` reads the app's rendered text for the
 * words these arrive as, so the line is held by a failing build rather than
 * by review.
 */
export const FORBIDDEN_MECHANICS = [
  { what: 'Daily streaks', why: 'Pressure on students with work, caregiving, disability, commuting or money constraints' },
  { what: 'Leaderboards based on attendance or messages', why: 'A league table of people' },
  { what: 'Randomized reward loops', why: 'A slot machine' },
  { what: 'Hidden ranking systems', why: 'DO-NOT-BUILD rule 3: nothing ranked without its reason' },
  { what: 'Punitive missed-event notifications', why: 'Shame is not a reminder' },
  { what: 'Pay-to-win club promotion', why: 'Default discovery cannot be bought' },
  { what: 'Rewards tied to disclosures or sensitive data', why: 'Nothing is earned by telling the app who you are' },
] as const;

// ── Packaging and the money not taken ───────────────────────────────────────

export const PACKAGES = [
  { id: 'foundations', name: 'Community Foundations', includes: 'Club and service directory, events, source-labeled questions and answers, accessibility fields, basic reporting', buyer: 'Student affairs, enrollment, campus experience', pricing: 'Annual platform fee by institution size and enabled modules', phase: 1 },
  { id: 'organizations', name: 'Organizations and Events', includes: 'Officer workspace, recognition workflow, elections, event approvals, forms, resource requests, transition tools', buyer: 'Student affairs, campus activities', pricing: 'Base platform plus the organization and event administration module', phase: 2 },
  { id: 'belonging', name: 'Belonging and Mentorship', includes: 'Structured circles, peer-mentor programmes, training, matching, coordinator dashboard, outcome reporting', buyer: 'Student success, orientation, accessibility, international office', pricing: 'Annual module fee by active programme capacity', phase: 3 },
  { id: 'safety', name: 'Trust and Safety', includes: 'Moderator console, reporting, case routing, audit evidence, policy templates, safety analytics', buyer: 'Student affairs, IT and security, legal and risk', pricing: 'Governance module plus an implementation and support tier', phase: 1 },
  { id: 'opportunity', name: 'Campus Opportunity Network', includes: 'Jobs, research, service, leadership, alumni and employer office hours, portfolio evidence', buyer: 'Career services, experiential learning', pricing: 'Annual module fee plus an optional verified-employer package', phase: 4 },
  { id: 'enterprise', name: 'Enterprise Campus OS', includes: 'Community plus academic navigation, AI governance, integrations, operations and enterprise support', buyer: 'Institution executive sponsor', pricing: 'Multi-year agreement with implementation and support scope', phase: 4 },
] as const satisfies readonly { id: string; name: string; includes: string; buyer: string; pricing: string; phase: CommunityPhase }[];

/** Sold to institutions, never funded by students. Each line is a refusal the register can cite. */
export const REVENUE_NOT_TAKEN = [
  'Selling student behavioral data',
  'Targeted advertising based on academic, support, accessibility or sensitive data',
  'Charging students to report a safety concern',
  'Pay-to-win visibility for clubs in default discovery',
  'Paying mentors by number of messages or confidential disclosures',
  'Opaque referral or lead-sale arrangements',
  'Charging students to export their own eligible data',
  'Gating essential institution-provided resources behind a premium student plan',
] as const;

/** What a community feature is measured by. Activity alone is never the primary metric. */
export const OUTCOME_MEASURES = [
  'Students found the right service',
  'Students joined a relevant community',
  'Organizations completed a required workflow',
  'A mentor and mentee completed a useful meeting',
  'A student received an accurate, source-labeled answer',
  'A harmful interaction was handled fairly and promptly',
] as const;

export const NOT_PRIMARY_METRICS = ['messages sent', 'minutes scrolled', 'daily active users'] as const;
