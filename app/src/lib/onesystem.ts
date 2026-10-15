/**
 * One system: the platform grammar two documents of 28 September 2026 say
 * makes Semester feel like one coherent product rather than a bunch of
 * different screens and tools — one information architecture, one object
 * model, one design system, one trust pattern, one action model, one
 * notification centre, one search, one data-agency centre, one operational
 * control plane, twelve consistency release gates and seven cross-domain
 * relationship rules — held to what the tree already has for each.
 *
 * `docs/ONE-SYSTEM-PLATFORM-GRAMMAR.md` is rendered from this file by
 * `onesystem.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## The finding
 *
 * The shared foundations mostly exist as parts. The gap is how they are
 * joined: three navigation models where the documents want one; a trust
 * vocabulary in three components where they want one; the pieces of an action
 * model with no single pipeline; notification controls spread across files;
 * an operations console whose screen unifies seven views while five more
 * stay data or University tabs. So this page is less a list of things to
 * build than a list of things to converge, and each row says which.
 *
 * ## What is held to what
 *
 * - The documents' nine top-level roots each name the app's own root
 *   (`ROOTS` in `state/shape.ts`) that carries it, or say none does; the test
 *   holds every name to that list, and notes the one app root the documents
 *   do not have.
 * - The documents' status words are held to `STATUS_WORDS` in
 *   `lib/provenance.ts`: each names the word already there, or says none is.
 * - The Me centre's ten items are held to `CONTROLS` in `lib/mecontrols.ts`.
 * - Every foundation, gate and rule cites the kind of file its status claims,
 *   and every cited path exists. A supplied PDF is never evidence.
 */

import type { Screen } from './types';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/LMS-Developer-Migration-Guide-and-One-System.pdf',
    title: 'Canvas vs Blackboard vs Moodle vs D2L Brightspace (… also anything else to make it feel like one system, consistent throughout)',
    what: 'One information architecture, one object model, one design system, the Source/Scope/Status trust pattern, one action model, one notification centre, one search and command system, one profile and data-agency centre, one operational control plane, the consistency release gates and the eleven foundations.',
  },
  {
    path: 'docs/expansion/LMS-Migration-Runbook-Blackboard-Moodle-and-Shared-Object-Model.pdf',
    title: 'Sortable LTI 1.3 dashboard (… map out the shared object model schema)',
    what: 'The core hierarchy, the universal metadata envelope, the core entities, the universal trust API shape and the cross-domain relationship rules.',
  },
];

export const PRINCIPLE = 'Build one platform with many domains, not many products stitched together.';

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export interface Held {
  /** A slug or a numbered id, stable. */
  id: string;
  what: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
}

type Row = Omit<Held, 'evidence'> & { evidence: readonly [path: string, shows: string][] };
const held = (rows: readonly Row[]): readonly Held[] => rows.map((r) => ({ ...r, evidence: r.evidence.map(([path, shows]) => ({ path, shows })) }));

// ── One information architecture ─────────────────────────────────────────────

export interface Root {
  /** The documents' top-level area. */
  area: string;
  /** The app root in `ROOTS` that carries it, or null. */
  root: Screen | null;
  note: string;
}

export const ROOT_MAP: readonly Root[] = [
  { area: 'Today', root: 'home', note: 'The Today briefing; Notices sits under it.' },
  { area: 'Learn', root: 'study', note: 'Study, the Studio, revision and practice.' },
  { area: 'Plan', root: 'calendar', note: 'The calendar, the runway and the term.' },
  { area: 'Community', root: 'mine', note: 'Community lives on the Beyond shelf under Mine; it is not a root of its own.' },
  { area: 'Opportunities', root: 'mine', note: 'The same shelf as Community.' },
  { area: 'Support', root: 'support', note: 'A root; the nav entry itself files under Me.' },
  { area: 'Messages', root: null, note: 'No Messages root: Email is a screen under the Courses root and Notices sits under Today.' },
  { area: 'Search', root: null, note: 'A screen and a shortcut (`/`, ⌘K), and a root only in the five-destination journey mode.' },
  { area: 'Me', root: 'me', note: 'The profile and data-agency centre.' },
];

/** The app root the documents have no area for. */
export const UNMAPPED_ROOT: Screen = 'courses';

export const HIERARCHY = 'Institution → Term → Course, Community or Service → Object';

export const NAVIGATION: readonly Held[] = held([
  { id: 'roots', what: 'One stable top-level structure everywhere', status: 'tested', evidence: [['app/src/state/shape.ts', 'ROOTS: the seven roots'], ['app/src/donotbuild.test.ts', 'the roots match the ones written on the do-not-build page']], gap: 'Three navigation models coexist: the seven roots, the five journey destinations in `lib/tabbar.ts`, and the institutional workspaces in `lib/institutional-ia.ts`. None is the documents’ nine.' },
  { id: 'context', what: 'Consistent contextual navigation: institution → term → course → object', status: 'building', evidence: [['app/src/components/unity/ContextBar.tsx', 'context → object → source, freshness and save → action, on the hubs and the studio'], ['app/src/components/TermSwitch.tsx', 'a term switcher, hidden with one term'], ['app/src/components/CoursePicker.tsx', 'a course picker'], ['app/src/components/SchoolPicker.tsx', 'a school picker'], ['app/src/lib/parent.ts', 'a one-level “up” link, and why there is no breadcrumb trail']], gap: 'The switchers are separate components; there is no one institution → term → course switcher, and no breadcrumb by design.' },
]);

// ── One object model ─────────────────────────────────────────────────────────

export const OBJECTS: readonly string[] = [
  'Person', 'Institution', 'Role', 'Term', 'Course', 'Community', 'Service', 'Opportunity', 'Task', 'Event', 'Document or source', 'Plan', 'Assessment', 'Submission',
  'Feedback', 'Grade', 'Share', 'Notification', 'Conversation', 'Integration', 'Audit event',
];

/** What every object carries, at what the tree has. */
export const ENVELOPE: readonly Held[] = held([
  { id: 'owner', what: 'Owner', status: 'building', evidence: [['app/src/lib/integration/lineage.ts', 'SourceOwner, per source'], ['docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md', 'the lineage model, mostly unbuilt']], gap: 'Per source, not per object.' },
  { id: 'source', what: 'Source', status: 'tested', evidence: [['app/src/lib/source.ts', 'the five labels the database enforces'], ['app/src/lib/source.test.ts', 'held to the check constraint']], gap: 'None.' },
  { id: 'authority', what: 'Authority level', status: 'building', evidence: [['app/src/intelligence/contracts.ts', 'EvidenceReference.authority on assistant citations'], ['app/src/lib/governance/rollout.ts', 'DataAuthority, per tenant']], gap: 'Only on citations and tenants; no object says who decides it.' },
  { id: 'scope', what: 'Scope and permissions', status: 'building', evidence: [['app/src/components/unity/Visibility.tsx', 'Audience: only me, course, collaborators, portfolio'], ['app/src/lib/unity.ts', 'SourceDetail.visibility']], gap: 'A display audience, not a permission model per object.' },
  { id: 'status', what: 'Status and freshness', status: 'tested', evidence: [['app/src/lib/source.ts', 'freshnessLine'], ['app/src/lib/status.ts', 'the status keys'], ['app/src/lib/integration/freshness.ts', 'freshness from age'], ['app/src/lib/source.test.ts', 'the freshness line']], gap: 'None for what is shown; nothing computes freshness for a course material.' },
  { id: 'version', what: 'Version', status: 'building', evidence: [['app/src/lib/docversions.ts', 'document versions'], ['app/src/lib/integration/mapping-versions.ts', 'mapping versions']], gap: 'Documents and mappings only.' },
  { id: 'retention', what: 'Retention class', status: 'tested', evidence: [['packages/institution/src/events.ts', 'RETENTION_CLASSES on events'], ['app/src/lib/retention.test.ts', 'every table has a retention line'], ['RETENTION.md', 'the schedule per table']], gap: 'Per table and per event, not on an object.' },
  { id: 'accessibility', what: 'Accessibility metadata', status: 'not-started', evidence: [['docs/ACCESSIBILITY-POLISH-CHECKLIST.md', 'the checklist; nothing per object']], gap: 'No object carries alt text, captions or an accessible-equivalent flag.' },
  { id: 'audit', what: 'Audit history', status: 'tested', evidence: [['app/src/lib/journal.ts', 'the activity journal with provenance on every entry'], ['app/src/lib/journal.test.ts', 'well-formed provenance required'], ['app/src/lib/audit-entities.test.ts', 'the audited entity types']], gap: 'No unified event schema: four audit tables with their own shapes.' },
  { id: 'undo', what: 'Recovery and undo state', status: 'tested', evidence: [['app/src/lib/undo.ts', 'one-step undo with field snapshots'], ['app/src/lib/undo.test.ts', 'undo and its limits'], ['app/src/screens/Recovery.tsx', 'the recovery screen']], gap: 'One step, on the device.' },
]);

export const ENVELOPE_FIELDS: readonly string[] = [
  'id', 'tenant_id', 'external_ids[]', 'object_type', 'owner_id', 'created_at', 'updated_at', 'created_by', 'updated_by',
  'source_type', 'source_system', 'source_reference', 'source_url', 'source_version', 'source_retrieved_at',
  'authority_level', 'visibility_scope', 'access_policy_id', 'retention_class', 'retention_until', 'legal_hold_status',
  'status', 'freshness_status', 'effective_at', 'expires_at', 'archived_at', 'version', 'previous_version_id', 'change_reason', 'audit_correlation_id',
  'accessibility_metadata', 'language', 'rights_classification', 'data_classification',
];

// ── One trust pattern: Source, Scope, Status ─────────────────────────────────

export interface StatusWord {
  word: string;
  /** The word in `STATUS_WORDS` that carries it, or null. */
  carriedBy: string | null;
}

/** The documents' status vocabulary against the app's. */
export const STATUS_MAP: readonly StatusWord[] = [
  { word: 'official', carriedBy: 'Verified' },
  { word: 'estimated', carriedBy: 'Estimated' },
  { word: 'draft', carriedBy: 'Draft' },
  { word: 'current', carriedBy: 'Current' },
  { word: 'pending', carriedBy: 'Pending' },
  { word: 'stale', carriedBy: 'Stale' },
  { word: 'restricted', carriedBy: 'Restricted' },
  { word: 'archived', carriedBy: 'Archived' },
  { word: 'needs review', carriedBy: null },
];

export const TRUST: readonly Held[] = held([
  { id: 'one-component', what: 'The same trust component in every product area', status: 'building', evidence: [['app/src/lib/provenance.ts', 'Provenance {source, scope, status} and the status words'], ['app/src/components/SourceBadge.tsx', 'source and freshness, in twenty-six screens; no scope'], ['app/src/components/SourceBadge.test.tsx', 'the badge'], ['app/src/lib/source.ts', 'TRUST_KINDS: the five labels plus AI-assisted and external, for display'], ['docs/design/SEMESTER-UI-CONSTITUTION.md', '§5: three trust vocabularies, marked as a fault']], gap: 'Three vocabularies (SourceBadge, NotOfficial, Disclosure), and `provenance.ts` names a component that does not exist.' },
  { id: 'trust-api', what: 'One trust payload on every user-facing object: source, authority, scope, status, version', status: 'designed', evidence: [['docs/design/SEMESTER-UI-CONSTITUTION.md', '§7: one trust vocabulary everywhere'], ['app/src/lib/provenance.ts', 'the three of the five that exist']], gap: 'No authority or version in the payload; no API returns it.' },
]);

export const TRUST_EXAMPLE = `{
  "source":    { "type": "institution_verified", "system": "Blackboard Learn", "reference": "course_48933", "last_synced_at": "2026-09-28T14:30:00Z" },
  "authority": { "level": "official_course_record", "decision_owner": "Course Instructor" },
  "scope":     { "visibility": "course_staff_and_student", "sharing": "not_shareable" },
  "status":    { "state": "released", "freshness": "current", "effective_at": "2026-09-28T14:30:00Z" },
  "version":   { "number": 4, "updated_at": "2026-09-28T14:30:00Z" }
}`;

// ── One action model ─────────────────────────────────────────────────────────

export const ACTION_MODEL: readonly Held[] = held([
  { id: 'preview', what: 'Preview, and explain the impact', status: 'tested', evidence: [['app/src/components/ConfirmDialog.tsx', 'a preview, then a choice'], ['app/src/lib/actions.test.ts', 'the action centre: every action with a why and a source']], gap: 'Per dialog; `lib/explain.ts` explains screens, not actions.' },
  { id: 'authority', what: 'Identify the target and the authority', status: 'building', evidence: [['app/src/components/ConfirmDialog.tsx', 'the external hand-off tone']], gap: 'No action names who decides it.' },
  { id: 'confirm', what: 'Confirm if consequential', status: 'tested', evidence: [['app/src/components/TypeToConfirm.tsx', 'type to confirm the irreversible'], ['app/server/institution/gateway.test.ts', 'prepare, then commit with confirmed: true and a version re-check']], gap: 'The two-phase pattern is the gateway’s; the app’s dialogs are their own.' },
  { id: 'complete', what: 'Show the completion state', status: 'building', evidence: [['app/src/components/Said.tsx', 'the live region'], ['app/src/components/unity/States.tsx', 'loading, error and success states']], gap: 'The primitives exist; nothing holds an action to announcing its outcome.' },
  { id: 'audit', what: 'Preserve an audit event', status: 'tested', evidence: [['app/src/lib/journal.ts', 'the journal'], ['app/src/lib/journal.test.ts', 'provenance on every entry']], gap: 'The device journal and four server tables; no one schema.' },
  { id: 'undo', what: 'Provide undo or recovery if possible', status: 'tested', evidence: [['app/src/lib/undo.test.ts', 'one step back'], ['app/src/components/Undone.tsx', 'the undo toast']], gap: 'None.' },
  { id: 'escalate', what: 'Show the support or escalation route if not', status: 'tested', evidence: [['app/src/lib/help-routes.test.ts', 'the routes'], ['supabase/functions/_shared/escalation.ts', 'a signed escalation webhook']], gap: 'Not attached to a failed action as a rule.' },
  { id: 'pipeline', what: 'Every action follows the same behaviour', status: 'designed', evidence: [['docs/ACTION-EXPLAINABILITY-AND-STUDENT-CONTROL.md', 'the model; nothing here is built yet'], ['packages/institution/src/workflow.ts', 'five workflow machines for institutional actions']], gap: 'The pieces exist; no single pipeline joins them.' },
]);

// ── One notification centre ──────────────────────────────────────────────────

export const NOTIFICATIONS: readonly Held[] = held([
  { id: 'inbox', what: 'Unified inbox and notification centre', status: 'building', evidence: [['app/src/screens/Hub.tsx', 'Notices'], ['app/src/lib/comms.ts', 'official, course and Semester channels; priority; digest']], gap: 'Notices, Email and reminders are three surfaces.' },
  { id: 'purpose', what: 'Notification purpose and source label', status: 'building', evidence: [['app/src/lib/comms.ts', 'admit: every message must carry a source label']], gap: 'No test on admit.' },
  { id: 'channels', what: 'In-app, email, push and optional SMS', status: 'tested', evidence: [['app/src/lib/notify.ts', 'in-app and browser notifications'], ['app/src/lib/push.ts', 'web push'], ['app/src/lib/notify.test.ts', 'the tiers and caps']], gap: 'No email and no SMS.' },
  { id: 'quiet', what: 'Quiet hours and schedule preferences', status: 'tested', evidence: [['app/src/lib/notify.ts', 'Quiet and inQuiet'], ['app/src/lib/notify.test.ts', 'quiet hours']], gap: 'None.' },
  { id: 'urgency', what: 'Urgency levels', status: 'building', evidence: [['app/src/lib/comms.ts', 'required, high, normal, low']], gap: 'No test.' },
  { id: 'digest', what: 'Digest controls', status: 'building', evidence: [['app/src/lib/comms.ts', 'instant, daily, weekly and digestGroups']], gap: 'No test; no send.' },
  { id: 'dedupe', what: 'Duplicate suppression', status: 'tested', evidence: [['app/src/lib/notify.ts', 'the seen set, last four hundred'], ['app/src/lib/notify.test.ts', 'a reminder is not repeated']], gap: 'None.' },
  { id: 'per-course', what: 'Per-course, community and service controls', status: 'building', evidence: [['app/src/components/MuteCourses.tsx', 'mute a course'], ['app/src/lib/myrules.ts', 'the student’s own rules']], gap: 'Courses only.' },
  { id: 'history', what: 'Delivery history', status: 'not-started', evidence: [['docs/ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md', 'the model']], gap: 'Only push stall detection; the screen lists today’s reminders (lib/read/notifications.ts) but keeps no history of past ones.' },
  { id: 'why', what: 'Why-am-I-seeing-this explanation', status: 'tested', evidence: [['app/src/lib/notify.ts', 'whyFor and shownBody'], ['app/src/lib/notify.test.ts', 'the why line']], gap: 'None.' },
]);

// ── One search and command system ────────────────────────────────────────────

export const PALETTE: readonly string[] = ['Add an action', 'Find a source', 'Ask Semester', 'Start a study session', 'Prepare advisor agenda', 'Find support', 'Join event', 'Upload work', 'Review feedback', 'Manage sharing', 'Report an issue'];

export const SEARCH: readonly Held[] = held([
  { id: 'one-ranker', what: 'Global search over courses, assignments, sources, services, clubs, events, opportunities, messages, support and settings', status: 'tested', evidence: [['app/src/lib/find.ts', 'findEverything, one ranker'], ['app/src/lib/find.test.ts', 'the ranking'], ['docs/architecture/0006-search-is-one-ranker.md', 'why one']], gap: 'Local device data only; messages and services are not indexed.' },
  { id: 'palette', what: 'A command palette', status: 'tested', evidence: [['app/src/components/Command.tsx', 'the overlay with typeahead'], ['app/src/lib/keys.test.ts', '`/` and ⌘K']], gap: 'Navigation and typeahead; not the eleven commands.' },
  { id: 'boundaries', what: 'Results respect tenant, course, role, source, privacy and retention boundaries', status: 'building', evidence: [['app/src/lib/find.ts', 'filtered by school capabilities and role'], ['ops/operations-console/README.md', 'search: never, for student-private records']], gap: 'No explicit tenant, course-membership or privacy-class filter; the rule is policy.' },
]);

// ── One profile and data-agency centre ───────────────────────────────────────

export interface MeItem {
  item: string;
  /** The `CONTROLS` row in `lib/mecontrols.ts` that carries it, or null. */
  carriedBy: string | null;
  note: string;
}

export const ME_CENTRE: readonly MeItem[] = [
  { item: 'Profile and accessibility preferences', carriedBy: 'accessibility', note: 'Text size, spacing, typeface, contrast and motion; the access modes.' },
  { item: 'Notification preferences', carriedBy: 'notifications', note: 'Alerts.' },
  { item: 'Connected accounts', carriedBy: 'connected', note: 'Calendars and services.' },
  { item: 'Active shares', carriedBy: 'sharing', note: 'Who can see what, until when, and how to take it back.' },
  { item: 'Mentorship and community privacy', carriedBy: null, note: 'Community identity and aliases exist; no Me row exposes them.' },
  { item: 'AI settings and history', carriedBy: 'ai', note: 'Settings; the conversation is kept in the session only.' },
  { item: 'Data export and deletion', carriedBy: 'export', note: 'Export, and a deletion row that reaches the delete-account function.' },
  { item: 'Support-access history', carriedBy: 'support-access', note: 'Windows, expired and revoked.' },
  { item: 'Security sessions and MFA', carriedBy: 'security', note: 'The row exists; the screen offers sign-out only, and no MFA for students.' },
  { item: 'Consent and policy history', carriedBy: null, note: 'The FERPA consent model and the agreements screen are staff-facing; no student timeline.' },
];

// ── One operational control plane ────────────────────────────────────────────

export const CONSOLE: readonly Held[] = held([
  { id: 'tenant-config', what: 'Tenant configuration', status: 'building', evidence: [['app/src/components/institutional/ControlPlane.tsx', 'the control plane tab'], ['app/src/lib/control-plane.ts', 'the viewed tenant']], gap: 'A flagged tab of the University screen, not a console.' },
  { id: 'entitlements', what: 'Entitlements', status: 'tested', evidence: [['supabase/functions/_shared/entitlement.ts', 'the resolver'], ['app/src/lib/entitlement.test.ts', 'the order'], ['docs/ENTITLEMENT-RESOLUTION.md', 'built; runs in shadow on LTI launches; enforces nothing']], gap: 'Shadow only; no view.' },
  { id: 'flags', what: 'Feature flags', status: 'tested', evidence: [['app/src/lib/flags.ts', 'the registry'], ['app/src/lib/flags.test.ts', 'every flag named'], ['docs/FEATURE-FLAG-REGISTRY.md', 'the register']], gap: 'No console view.' },
  { id: 'integration-health', what: 'Integration health', status: 'tested', evidence: [['app/src/components/institutional/IntegrationDashboard.tsx', 'the staff dashboard'], ['app/src/components/institutional/IntegrationDashboard.test.tsx', 'every domain with status and health']], gap: 'School staff, not operations.' },
  { id: 'freshness', what: 'Content freshness', status: 'building', evidence: [['app/src/lib/integration/lineage.ts', 'breach levels']], gap: 'Integration data only.' },
  { id: 'support', what: 'Support cases', status: 'building', evidence: [['app/src/lib/supporttickets.ts', 'tickets'], ['app/src/components/HelpInbox.tsx', 'the staff help inbox']], gap: 'No case model shared with incidents.' },
  { id: 'incidents', what: 'Incidents', status: 'tested', evidence: [['app/src/lib/governance/incident-comms.ts', 'communications by audience'], ['app/src/lib/ops/warroom.ts', 'the war room'], ['app/src/lib/ops/warroom.test.ts', 'the room']], gap: 'Data only; no screen.' },
  { id: 'ai-policy', what: 'AI policy', status: 'tested', evidence: [['app/src/lib/governance/ai-lifecycle.ts', 'the gates'], ['app/src/lib/aiflags.ts', 'the AI flags'], ['app/src/lib/governance/ai-lifecycle.test.ts', 'the gates held']], gap: 'Data only; no screen.' },
  { id: 'privacy', what: 'Privacy and consent', status: 'tested', evidence: [['app/src/lib/governance/module-privacy.ts', 'the model'], ['app/src/lib/governance/module-privacy.test.ts', 'held to app_roles']], gap: 'Data only; no screen.' },
  { id: 'a11y-issues', what: 'Accessibility issues', status: 'designed', evidence: [['docs/WCAG-UI-AUDIT-SCORECARD.md', 'the scorecard']], gap: 'No view and no issue record.' },
  { id: 'commitments', what: 'Contracts and customer commitments', status: 'tested', evidence: [['app/src/lib/ops/commitments.ts', 'the register'], ['supabase/migrations/20260929110000_console_approvals_and_break_glass.sql', 'customer, commitment and contract rows scoped to the tenant'], ['app/src/screens/console.test.tsx', 'the Customers view, with classification and access basis on every record']], gap: 'None.' },
  { id: 'billing', what: 'Billing', status: 'not-started', evidence: [['docs/DECISION-LOG.md', 'D-009: no billing exists']], gap: 'None exists, by decision.' },
  { id: 'evidence', what: 'Audit and evidence', status: 'tested', evidence: [['app/src/lib/ops/claims.ts', 'the claims register'], ['app/src/lib/ops/proofcalendar.ts', 'the proof calendar'], ['app/src/lib/ops/claims.test.ts', 'every claim with a register word']], gap: 'Registers, not a view.' },
  { id: 'release-impact', what: 'Release impact', status: 'tested', evidence: [['app/src/lib/governance/release-readiness.ts', 'the score'], ['app/src/lib/governance/consolechecks.ts', 'promises kept, release impact, on-call workload'], ['app/src/lib/governance/consolechecks.test.ts', 'the checks']], gap: 'Data only; no screen.' },
]);

export const CONSOLE_RULE = 'The console may use domain-specific views, but it uses the same identity, permission, audit, case, notification and runbook services; there is no separate admin tool per module.';

// ── Consistency release gates ─────────────────────────────────────────────────

export const GATES: readonly Held[] = held([
  { id: 'G01', what: 'Uses the shared application shell and context switcher', status: 'tested', evidence: [['app/src/pageframe.test.ts', 'every screen renders inside Page, or is on FRAMELESS with a reason']], gap: 'The shell, yes; the context switcher is not one component.' },
  { id: 'G02', what: 'Uses shared design-system components; no one-off controls without approval', status: 'tested', evidence: [['app/scripts/styles.mjs', 'the style audit on every lint'], ['app/src/lib/onecontrol.test.ts', 'one control pattern'], ['app/src/styles/tokens.test.ts', 'the tokens']], gap: 'No shared table or timeline primitive; thirteen raw tables.' },
  { id: 'G03', what: 'Displays Source, Scope and Status where information or authority matters', status: 'building', evidence: [['app/src/components/SourceBadge.tsx', 'source and freshness'], ['.github/pull_request_template.md', 'asks for SourceBadge where a decision depends on outside data']], gap: 'Source and status; scope is not shown.' },
  { id: 'G04', what: 'Uses standard loading, error, empty, permission, confirmation, recovery and support patterns', status: 'tested', evidence: [['app/src/components/unity/States.tsx', 'the states'], ['app/src/components/ui.tsx', 'EmptyState'], ['docs/EMPTY-LOADING-ERROR-SUCCESS-STATES.md', 'the contract'], ['app/src/pageframe.test.ts', 'the frame']], gap: 'Permission-denied and conflict states are per screen.' },
  { id: 'G05', what: 'Appears in global search and the command palette where appropriate', status: 'tested', evidence: [['app/src/lib/nav.test.ts', 'every destination in the registry with keywords'], ['app/src/lib/find.test.ts', 'found by keyword']], gap: 'None.' },
  { id: 'G06', what: 'Uses the unified notification system', status: 'building', evidence: [['app/src/lib/comms.ts', 'admit']], gap: 'Three surfaces, no rule that a module must use one.' },
  { id: 'G07', what: 'Honours shared profile, accessibility, privacy, retention and sharing controls', status: 'tested', evidence: [['app/src/lib/mecontrols.test.ts', 'the rows'], ['app/src/lib/retention.test.ts', 'every table has a retention line'], ['app/src/lib/sharing.ts', 'the shares']], gap: 'None as a gate; nothing checks a new module against them.' },
  { id: 'G08', what: 'Emits standard audit and activity events', status: 'building', evidence: [['app/src/lib/journal.ts', 'the journal'], ['docs/architecture/0008-event-envelope-and-outbox.md', 'the envelope']], gap: 'No unified event schema.' },
  { id: 'G09', what: 'Passes keyboard, screen-reader, zoom and reflow, mobile and low-bandwidth tests', status: 'tested', evidence: [['app/src/a11y/axe.test.tsx', 'axe on every screen'], ['app/src/a11y/dragging.test.ts', 'drag alternatives'], ['.github/pull_request_template.md', 'keyboard only, 320px and 200% zoom']], gap: 'No low-bandwidth test.' },
  { id: 'G10', what: 'Has one named owner, a source-freshness model, a support runbook and an analytics definition', status: 'building', evidence: [['app/src/lib/governance/charters.ts', 'charters with owners'], ['docs/ANALYTICS-EVENTS.md', 'the analytics definitions']], gap: 'Charters for portfolios, not per screen.' },
  { id: 'G11', what: 'Can be enabled or disabled by tenant through the same entitlement and feature-flag system', status: 'tested', evidence: [['app/src/lib/flags.test.ts', 'every flag'], ['docs/ENTITLEMENT-RESOLUTION.md', 'shadow only']], gap: 'Entitlement enforces nothing yet.' },
  { id: 'G12', what: 'Has migration, offboarding and export behaviour defined', status: 'tested', evidence: [['docs/DATA-PORTABILITY-AND-OFFBOARDING.md', 'the model'], ['app/src/lib/export.test.ts', 'export']], gap: 'Defined for the product, not per module.' },
]);

// ── The eleven foundations ───────────────────────────────────────────────────

export const FOUNDATIONS: readonly Held[] = held([
  { id: 'identity', what: 'One identity', status: 'tested', evidence: [['packages/institution/src/identity.ts', 'the claims and their minimization'], ['packages/institution/src/identity.test.ts', 'held'], ['docs/INSTITUTIONAL-SSO-ARCHITECTURE.md', 'SAML, SCIM and LTI built; OIDC and account linking not']], gap: 'No OIDC; LTI identities link to campus accounts by ticket only.' },
  { id: 'context', what: 'One context', status: 'building', evidence: [['app/src/components/unity/ContextBar.tsx', 'the context bar']], gap: 'As the navigation row: separate switchers.' },
  { id: 'objects', what: 'One object model', status: 'building', evidence: [['app/src/lib/integration/catalog.ts', 'thirty-three canonical entities for integration'], ['app/src/components/unity/ObjectCard.tsx', 'nine presentation kinds']], gap: 'No single entity type carrying the envelope.' },
  { id: 'design', what: 'One design system', status: 'tested', evidence: [['app/src/styles/tokens.css', 'the tokens'], ['app/src/lib/look.test.ts', 'the palette'], ['docs/design/SEMESTER-UI-CONSTITUTION.md', 'the constitution']], gap: 'Tables and timelines have no primitive.' },
  { id: 'trust', what: 'One trust pattern', status: 'building', evidence: [['app/src/lib/provenance.ts', 'Source, Scope, Status']], gap: 'Three vocabularies.' },
  { id: 'search', what: 'One search system', status: 'tested', evidence: [['app/src/lib/find.test.ts', 'one ranker']], gap: 'None.' },
  { id: 'notifications', what: 'One notification system', status: 'building', evidence: [['app/src/lib/comms.ts', 'channels, priority, digest']], gap: 'Three surfaces.' },
  { id: 'me', what: 'One data-agency centre', status: 'tested', evidence: [['app/src/lib/mecontrols.test.ts', 'the rows']], gap: 'Two of the documents’ ten items have no row.' },
  { id: 'events', what: 'One audit and event model', status: 'tested', evidence: [['app/server/institution/gateway.test.ts', 'the error envelope and correlation id'], ['docs/architecture/0010-correlation-ids-and-error-envelope.md', 'the ADR']], gap: 'Four audit tables; edge functions answer in their own shapes.' },
  { id: 'gateway', what: 'One integration gateway', status: 'tested', evidence: [['app/server/institution/gateway.ts', 'the gateway'], ['app/server/institution/gateway.test.ts', 'prepare, commit, reconcile'], ['docs/LMS-INTEROPERABILITY-MATRIX.md', 'the LMS side of it']], gap: 'AGS and the integration tick bypass it.' },
  { id: 'console', what: 'One operations console', status: 'tested', evidence: [['app/src/screens/Console.tsx', 'the console: context bar, approvals, break-glass, audit, customers, figures, evidence, saved views'], ['app/src/screens/console.test.tsx', 'gated by console:operate; every write under the production notice'], ['docs/OPERATIONS-CONSOLE-MAP.md', 'the map, rendered from the controls (D-110)']], gap: 'Tenant configuration, flags, incidents, AI policy and privacy are still data or University tabs, not console views.' },
]);

// ── Cross-domain relationship rules ──────────────────────────────────────────

export const RULES: readonly Held[] = held([
  { id: 'R1', what: 'A Course can link to Actions, Events, Documents, Assignments, Assessments, Submissions, Feedback, Grades, Communities, Services and Opportunities', status: 'building', evidence: [['app/src/components/CourseHub.tsx', 'assignments, study, readings, readiness and the locker on one hub']], gap: 'Communities, services and opportunities do not link to a course.' },
  { id: 'R2', what: 'A Person controls private Plans, Actions, Notes, Preferences and eligible Shares', status: 'tested', evidence: [['app/src/lib/sharing.ts', 'the shares'], ['app/src/components/SharingList.test.tsx', 'who sees what, until when']], gap: 'None.' },
  { id: 'R3', what: 'A ServiceResource creates a Referral only through consent or a documented institutional basis', status: 'tested', evidence: [['supabase/migrations/20260921002623_referrals.sql', 'a referral is the student’s own act'], ['app/src/lib/help-routes.test.ts', 'directory-only routes store nothing']], gap: 'None.' },
  { id: 'R4', what: 'A GradeEntry never becomes a career or employer data source by default', status: 'tested', evidence: [['app/src/lib/serviceregister.ts', 'EMPLOYER_NEVER: student grades, course performance'], ['app/src/lib/serviceregister.test.ts', 'held']], gap: 'None.' },
  { id: 'R5', what: 'Basic-needs browsing never becomes faculty, advisor or club visibility', status: 'tested', evidence: [['app/src/lib/governance/module-privacy.ts', 'the basic-needs row: private by default'], ['app/src/lib/governance/module-privacy.test.ts', 'held to app_roles'], ['app/src/lib/help-routes.test.ts', 'financial aid and accessibility are directory-only']], gap: 'None.' },
  { id: 'R6', what: 'AI conversations never become a shared SourceDocument unless a user deliberately saves and shares an approved artifact', status: 'tested', evidence: [['app/src/lib/chatlog.ts', 'the conversation is kept in the session only'], ['app/src/lib/governance/module-privacy.test.ts', 'the AI row']], gap: 'None.' },
  { id: 'R7', what: 'IntegrationConnection data always retains source, freshness and external id', status: 'tested', evidence: [['supabase/migrations/20260927170000_integration_control_plane.sql', 'source records with provider ids and freshness'], ['app/src/lib/integration/pipeline.test.ts', 'the external id and the timestamp on every record']], gap: 'None.' },
]);

export const ALL: readonly Held[] = [...NAVIGATION, ...ENVELOPE, ...TRUST, ...ACTION_MODEL, ...NOTIFICATIONS, ...SEARCH, ...CONSOLE, ...GATES, ...FOUNDATIONS, ...RULES];

/**
 * Found while reading the tree on 28 September and fixed the same day:
 * `provenance.ts` named a `SourceScopeStatus` component that did not exist,
 * and `comms.ts` named a `comms.test.ts` that did not exist. The test holds
 * both fixed — the reference is gone and the test file is there — so the list
 * stays empty until something new is found.
 */
export const FOUND: readonly string[] = [];
