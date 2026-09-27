/**
 * The state reference: every state a Semester screen can be in, what it says,
 * and the rules each has to keep.
 *
 * Three things live here, all data, so a screen can ask rather than decide:
 *
 * 1. **`UX_STATES`** — the sortable matrix from the state-design brief. One
 *    row per state, each with its trigger, what the student is told, the one
 *    thing to press, the way out if that fails, and the accessibility rule it
 *    carries. `sortStates` is the sort the reference table uses.
 * 2. **`SYNC_POLICY`** — how each kind of object is allowed to save. The
 *    brief's rule is that there is no one universal approach: personal,
 *    reversible work updates at once and syncs quietly; official work waits
 *    for the system of record and never reads "done" before it answers.
 * 3. **`emptyStateFor`** — the empty-state decision tree. An empty list can
 *    mean seven different things, and a screen that says "Nothing here" for
 *    all of them is telling a student who has no access the same thing it
 *    tells one who has finished.
 *
 * `lib/syncstatus.ts` is the running half of the sync rows: `SYNC_WORDS` and
 * `syncLine` are what the app actually says for each one.
 */

export type UXStateCategory =
  | 'default'
  | 'loading'
  | 'first-use'
  | 'zero'
  | 'search'
  | 'source'
  | 'setup'
  | 'permission'
  | 'offline'
  | 'sync'
  | 'conflict'
  | 'error'
  | 'pending'
  | 'success'
  | 'handoff'
  | 'draft'
  | 'stale'
  | 'ai';

export type UXStateSeverity = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export interface UXStatePattern {
  id: string;
  category: UXStateCategory;
  state: string;
  severity: UXStateSeverity;
  trigger: string;
  feedback: string;
  primaryAction: string;
  fallback: string;
  wcagRule: string;
  semesterExample: string;
  /** Must not read as done until the system of record says so. */
  requiresServerConfirmation: boolean;
  supportsOffline: boolean;
  announcement: 'none' | 'polite' | 'assertive';
  reviewPriority: 'P0' | 'P1' | 'P2' | 'P3';
}

type Row = Omit<UXStatePattern, 'requiresServerConfirmation' | 'supportsOffline' | 'reviewPriority' | 'announcement'> &
  Partial<Pick<UXStatePattern, 'requiresServerConfirmation' | 'supportsOffline' | 'reviewPriority' | 'announcement'>>;

/** Defaults a row only states when it differs from them. */
function row(r: Row): UXStatePattern {
  return {
    requiresServerConfirmation: false,
    supportsOffline: true,
    announcement: 'polite',
    reviewPriority: 'P1',
    ...r,
  };
}

export const UX_STATES: readonly UXStatePattern[] = [
  row({
    id: 'default-ready', category: 'default', state: 'Ready', severity: 'neutral',
    trigger: 'Content or data available', feedback: 'Normal page', primaryAction: 'The main action',
    fallback: 'None needed', wcagRule: 'Clear heading hierarchy and visible controls.',
    semesterExample: '“Start a study session”', announcement: 'none', reviewPriority: 'P2',
  }),
  row({
    id: 'loading-initial', category: 'loading', state: 'Initial load', severity: 'neutral',
    trigger: 'A screen or its content first opens', feedback: 'A skeleton that keeps the layout',
    primaryAction: 'Wait; other areas stay usable', fallback: 'Retry only after a meaningful delay',
    wcagRule: 'Do not trap focus; announce loading only when it is meaningful.',
    semesterExample: 'Loading course assignments',
  }),
  row({
    id: 'loading-background', category: 'loading', state: 'Background refresh', severity: 'neutral',
    trigger: 'Cached data refreshes', feedback: 'Quiet inline status with freshness',
    primaryAction: 'Keep working', fallback: 'See when it was last updated',
    wcagRule: 'Polite status; never obscure the content.', semesterExample: 'Refreshing Canvas assignments',
    reviewPriority: 'P2',
  }),
  row({
    id: 'first-use', category: 'first-use', state: 'No personal data yet', severity: 'info',
    trigger: 'The student has not started this', feedback: 'What it is for, and one way to begin',
    primaryAction: 'Begin', fallback: 'Learn more',
    wcagRule: 'Text carries the purpose; an illustration alone does not.', semesterExample: '“Build your first-week plan”',
  }),
  row({
    id: 'zero-complete', category: 'zero', state: 'Nothing required', severity: 'success',
    trigger: 'Nothing due or remaining', feedback: 'Reassurance, and what comes next',
    primaryAction: 'Plan ahead', fallback: 'See what is coming',
    wcagRule: 'Never imply a judgement of the student’s performance.', semesterExample: '“You are caught up for today”',
  }),
  row({
    id: 'search-empty', category: 'search', state: 'No results', severity: 'neutral',
    trigger: 'A query or filter excludes everything', feedback: 'Repeat the query and filters back',
    primaryAction: 'Clear filters', fallback: 'Browse everything',
    wcagRule: 'Announce the result count when it changes.', semesterExample: '“No services match ‘late-night tutoring’”',
  }),
  row({
    id: 'source-no-data', category: 'source', state: 'No data yet', severity: 'info',
    trigger: 'Connected, but the source sent nothing', feedback: 'Say which source, and when it last answered',
    primaryAction: 'Refresh', fallback: 'Open the source',
    wcagRule: 'Never present absence as completion.', semesterExample: '“Assignments are not available yet”',
  }),
  row({
    id: 'setup-missing', category: 'setup', state: 'Connection missing', severity: 'info',
    trigger: 'A source or profile the screen needs is not set up', feedback: 'What setting it up unlocks',
    primaryAction: 'Connect', fallback: 'Skip, when it is optional',
    wcagRule: 'Explain what data moves before anything connects.', semesterExample: 'Connect your course site',
  }),
  row({
    id: 'permission-restricted', category: 'permission', state: 'Restricted', severity: 'warning',
    trigger: 'A role or policy prevents access', feedback: 'Say who owns it and why',
    primaryAction: 'Contact the owner', fallback: 'Go back',
    wcagRule: 'State the restriction plainly; show nothing restricted.', semesterExample: 'An advisor-only record',
  }),
  row({
    id: 'offline-idle', category: 'offline', state: 'Offline, nothing waiting', severity: 'neutral',
    trigger: 'The network is unavailable', feedback: 'A quiet status line',
    primaryAction: 'Keep working with saved content', fallback: 'See what works offline',
    wcagRule: 'Text and icon, exposed as a status; not colour alone.', semesterExample: '“Offline”',
    reviewPriority: 'P0',
  }),
  row({
    id: 'offline-queued', category: 'offline', state: 'Offline, changes waiting', severity: 'warning',
    trigger: 'The network went after changes were made', feedback: 'Status line plus the count waiting',
    primaryAction: 'See what is waiting', fallback: 'They go up on reconnecting',
    wcagRule: 'Never say “Saved” about work that is only on the device.', semesterExample: '“Offline · changes waiting”',
    reviewPriority: 'P0',
  }),
  row({
    id: 'offline-blocked', category: 'offline', state: 'Needs a connection', severity: 'warning',
    trigger: 'An action needs the system of record', feedback: 'Why it cannot finish here',
    primaryAction: 'Save a draft', fallback: 'Open the official system',
    wcagRule: 'Explain why a control is unavailable.', semesterExample: 'Final appointment booking',
    requiresServerConfirmation: true, supportsOffline: false, reviewPriority: 'P0',
  }),
  row({
    id: 'sync-local', category: 'sync', state: 'Saved on this device', severity: 'neutral',
    trigger: 'Work saved locally, not yet in an account', feedback: 'Quiet inline status',
    primaryAction: 'Keep working', fallback: 'None needed',
    wcagRule: 'Polite status; never move focus.', semesterExample: '“Draft saved on this device”', reviewPriority: 'P0',
  }),
  row({
    id: 'sync-syncing', category: 'sync', state: 'Syncing', severity: 'info',
    trigger: 'Changes going up', feedback: 'Status text', primaryAction: 'Keep working', fallback: 'See details',
    wcagRule: 'Do not move focus for routine status.', semesterExample: '“Syncing your changes…”',
  }),
  row({
    id: 'sync-current', category: 'sync', state: 'Saved', severity: 'success',
    trigger: 'The account confirmed the change', feedback: 'Brief confirmation',
    primaryAction: 'Keep working', fallback: 'History',
    wcagRule: 'Confirm without interrupting.', semesterExample: '“Saved”', reviewPriority: 'P0',
  }),
  row({
    id: 'sync-delayed', category: 'sync', state: 'Delayed', severity: 'warning',
    trigger: 'A retryable network or server failure', feedback: 'Quiet warning; the work stays saved here',
    primaryAction: 'Try again', fallback: 'Wait, or reconnect',
    wcagRule: 'Say whether the work is safe; no colour-only warning.', semesterExample: '“Couldn’t sync yet”',
    reviewPriority: 'P0',
  }),
  row({
    id: 'sync-blocked', category: 'sync', state: 'Blocked', severity: 'error',
    trigger: 'Sign-in, permission or policy stops the sync', feedback: 'An inline warning with the fix',
    primaryAction: 'Sign in', fallback: 'Copy the work out',
    wcagRule: 'Alert only if the current action is blocked.', semesterExample: '“Sign in to sync your changes”',
    announcement: 'assertive', reviewPriority: 'P0',
  }),
  row({
    id: 'sync-rejected', category: 'sync', state: 'Rejected', severity: 'error',
    trigger: 'The server refused a change for good', feedback: 'Keep the draft; say why',
    primaryAction: 'Fix and retry', fallback: 'Copy or keep as a separate draft',
    wcagRule: 'Name the problem and the way to recover it.', semesterExample: 'An invalid service-request field',
    announcement: 'assertive', reviewPriority: 'P0',
  }),
  row({
    id: 'conflict-merge-silent', category: 'conflict', state: 'Silent merge', severity: 'neutral',
    trigger: 'Independent fields changed', feedback: 'Quiet confirmation', primaryAction: 'Keep working',
    fallback: 'History', wcagRule: 'Do not interrupt without a real risk of loss.', semesterExample: 'A preference update',
    reviewPriority: 'P2',
  }),
  row({
    id: 'conflict-server-wins', category: 'conflict', state: 'Official source wins', severity: 'info',
    trigger: 'The official source changed', feedback: 'Say what the official update was',
    primaryAction: 'Review the change', fallback: 'Open the official system',
    wcagRule: 'Name the source and when it changed.', semesterExample: 'A course section filled',
  }),
  row({
    id: 'conflict-choose', category: 'conflict', state: 'Choose one', severity: 'warning',
    trigger: 'The same simple value changed twice', feedback: 'Both values, with where and when',
    primaryAction: 'Keep mine / use latest', fallback: 'Cancel',
    wcagRule: 'Do not rely on colour to tell the two apart.', semesterExample: 'A reminder time',
  }),
  row({
    id: 'conflict-merge', category: 'conflict', state: 'Merge required', severity: 'warning',
    trigger: 'Overlapping changes to the same text or plan', feedback: 'A comparison that keeps both',
    primaryAction: 'Compare versions', fallback: 'Save mine as a separate draft',
    wcagRule: 'A keyboard-usable dialog; both versions preserved.', semesterExample: 'A shared study plan',
    announcement: 'assertive', reviewPriority: 'P0',
  }),
  row({
    id: 'error-local', category: 'error', state: 'Local failure', severity: 'error',
    trigger: 'Validation or client failure', feedback: 'An inline error at the field',
    primaryAction: 'Correct it', fallback: 'Save a draft',
    wcagRule: 'Identify the error; focus the field where that helps.', semesterExample: 'An invalid date',
    announcement: 'assertive',
  }),
  row({
    id: 'error-integration', category: 'error', state: 'Source unavailable', severity: 'warning',
    trigger: 'A source or API failed', feedback: 'Which source, and how fresh the saved copy is',
    primaryAction: 'Retry', fallback: 'Keep working with the saved copy',
    wcagRule: 'Say what is still available.', semesterExample: 'Canvas temporarily unavailable',
  }),
  row({
    id: 'error-incident', category: 'error', state: 'System incident', severity: 'error',
    trigger: 'A wider outage', feedback: 'A banner with a status link', primaryAction: 'See status',
    fallback: 'A workaround or support', wcagRule: 'Calm, plain, non-technical.', semesterExample: 'Scheduled maintenance',
    supportsOffline: false, reviewPriority: 'P2',
  }),
  row({
    id: 'pending-request', category: 'pending', state: 'Processing', severity: 'info',
    trigger: 'A long-running server process', feedback: 'Progress, or a pending receipt',
    primaryAction: 'See status', fallback: 'Cancel, if safe', wcagRule: 'Announce progress updates.',
    semesterExample: 'Document processing', requiresServerConfirmation: true, supportsOffline: false,
  }),
  row({
    id: 'success-accepted', category: 'success', state: 'Request received', severity: 'success',
    trigger: 'The institution has the request', feedback: 'A receipt', primaryAction: 'View the request',
    fallback: 'Return to work', wcagRule: 'Never a toast alone for something consequential.',
    semesterExample: 'Tutoring request received', requiresServerConfirmation: true, supportsOffline: false,
    reviewPriority: 'P0',
  }),
  row({
    id: 'success-official', category: 'success', state: 'Official completion', severity: 'success',
    trigger: 'The system of record confirmed it', feedback: 'A durable receipt and history entry',
    primaryAction: 'View the confirmation', fallback: 'Copy the details',
    wcagRule: 'Say what actually completed.', semesterExample: 'Registration request confirmed',
    requiresServerConfirmation: true, supportsOffline: false, announcement: 'assertive', reviewPriority: 'P0',
  }),
  row({
    id: 'handoff-external', category: 'handoff', state: 'Leaving Semester', severity: 'neutral',
    trigger: 'The student opens another system', feedback: 'Where, why, and what goes with them',
    primaryAction: 'Continue', fallback: 'Cancel', wcagRule: 'Warn before context or data leaves.',
    semesterExample: 'Open official registration', supportsOffline: false,
  }),
  row({
    id: 'draft-restored', category: 'draft', state: 'Restored', severity: 'info',
    trigger: 'Interrupted work found', feedback: 'When it was kept, and where',
    primaryAction: 'Continue', fallback: 'Discard',
    wcagRule: 'Do not auto-show sensitive drafts on a shared device.', semesterExample: '“Picked up where you left off”',
    reviewPriority: 'P0',
  }),
  row({
    id: 'draft-expiring', category: 'draft', state: 'Expiring', severity: 'warning',
    trigger: 'A draft nears its keep limit', feedback: 'The date it goes', primaryAction: 'Resume',
    fallback: 'Discard', wcagRule: 'Explain retention plainly.', semesterExample: 'Kept for 14 days',
    reviewPriority: 'P2',
  }),
  row({
    id: 'stale-official', category: 'stale', state: 'May be out of date', severity: 'warning',
    trigger: 'Cached official data is past its freshness target', feedback: 'Source and time, at the data',
    primaryAction: 'Refresh', fallback: 'Open the official system',
    wcagRule: 'Never present a cached copy as current.', semesterExample: '“Last updated 2 hours ago”',
  }),
  row({
    id: 'ai-processing', category: 'ai', state: 'AI working', severity: 'info',
    trigger: 'An AI request is underway', feedback: 'Labelled as AI', primaryAction: 'Wait, or cancel',
    fallback: 'The manual route', wcagRule: 'Name AI use; no unsupported certainty.',
    semesterExample: 'Generating a study plan', supportsOffline: false, reviewPriority: 'P2',
  }),
  row({
    id: 'ai-unavailable', category: 'ai', state: 'AI unavailable', severity: 'neutral',
    trigger: 'The provider or policy is unavailable', feedback: 'The manual alternative',
    primaryAction: 'Use the manual tools', fallback: 'Support',
    wcagRule: 'Never block a core action on AI.', semesterExample: '“Use the planning template instead”',
    reviewPriority: 'P2',
  }),
];

/** The sort the reference table uses: any column, either way, stable on id. */
export function sortStates(
  rows: readonly UXStatePattern[],
  key: keyof UXStatePattern,
  direction: 'asc' | 'desc' = 'asc',
  category: UXStateCategory | 'all' = 'all',
): UXStatePattern[] {
  const kept = category === 'all' ? [...rows] : rows.filter((r) => r.category === category);
  return kept.sort((a, b) => {
    const order = String(a[key]).localeCompare(String(b[key])) || a.id.localeCompare(b.id);
    return direction === 'asc' ? order : -order;
  });
}

// ── How each kind of object is allowed to save ─────────────────────────────

export type SyncStrategy =
  /** Official, high stakes: review, submit, wait, receipt. */
  | 'server-first'
  /** Personal, reversible: update at once, save locally, sync quietly. */
  | 'optimistic'
  /** Medium risk: acknowledge at once, confirm later with a receipt. */
  | 'queue-and-confirm'
  /** Reference data: a cached copy with its source and freshness showing. */
  | 'cached-read'
  /** Must not submit offline: keep a private draft, confirm online. */
  | 'draft-only'
  /** Shared and editable: versions, history, and review on overlap. */
  | 'versioned';

export interface SyncPolicy {
  strategy: SyncStrategy;
  /** Who wins when both sides changed, and when the student is asked. */
  conflict: string;
}

export const SYNC_POLICY = {
  'personal-action': { strategy: 'optimistic', conflict: 'Merge the history; ask only if completed and reopened at once.' },
  'personal-note': { strategy: 'optimistic', conflict: 'Merge where safe; ask if the same text changed.' },
  'study-plan': { strategy: 'optimistic', conflict: 'Merge independent blocks; ask if the same block changed.' },
  'study-session': { strategy: 'optimistic', conflict: 'Append-only; never conflicts.' },
  preference: { strategy: 'optimistic', conflict: 'Latest change per field; almost never ask.' },
  'read-marker': { strategy: 'optimistic', conflict: 'Merge; never ask.' },
  'saved-filter': { strategy: 'optimistic', conflict: 'Latest change wins.' },
  'service-request': { strategy: 'queue-and-confirm', conflict: 'Keep the draft; the server decides.' },
  'tutoring-request': { strategy: 'queue-and-confirm', conflict: 'Availability wins; the details stay saved.' },
  'course-data': { strategy: 'cached-read', conflict: 'The official source wins; say when it changed.' },
  'service-directory': { strategy: 'cached-read', conflict: 'The official source wins.' },
  'registration-plan': { strategy: 'draft-only', conflict: 'Keep the local draft; refresh official data; always review before submitting.' },
  'appointment-booking': { strategy: 'server-first', conflict: 'Server availability wins; offer another time.' },
  registration: { strategy: 'server-first', conflict: 'The system of record wins.' },
  'financial-aid': { strategy: 'server-first', conflict: 'The system of record wins.' },
  accommodation: { strategy: 'server-first', conflict: 'The system of record wins.' },
  'official-record': { strategy: 'server-first', conflict: 'The system of record wins; explain and offer the official route.' },
  'data-export-or-delete': { strategy: 'server-first', conflict: 'The server decides.' },
  'shared-plan': { strategy: 'versioned', conflict: 'Versioned merge; always ask on a meaningful overlap.' },
} as const satisfies Record<string, SyncPolicy>;

export type SyncObject = keyof typeof SYNC_POLICY;

/**
 * Whether the interface may show this object's change before the server has
 * it. The one question every write path has to ask, and the answer the brief
 * insists on: never for anything official.
 */
export function mayShowBeforeConfirmed(object: SyncObject): boolean {
  const s: SyncStrategy = SYNC_POLICY[object].strategy;
  return s === 'optimistic' || s === 'versioned';
}

// ── The empty-state decision tree ──────────────────────────────────────────

export type EmptyKind =
  | 'loading'
  | 'error'
  | 'source-unavailable'
  | 'no-permission'
  | 'no-setup'
  | 'no-results'
  | 'first-use'
  | 'complete';

export interface EmptyFacts {
  loading?: boolean;
  failed?: boolean;
  /** The source is connected but not answering. */
  sourceDown?: boolean;
  allowed?: boolean;
  /** Whatever this area needs connected or filled in is there. */
  setUp?: boolean;
  /** A search or filter is narrowing the list. */
  filtered?: boolean;
  /** The student has ever had anything here. */
  everHad?: boolean;
}

/**
 * Why a list is empty, asked in the order the brief puts it.
 *
 * Loading before anything else, because every other answer is premature
 * until the data is in. A filter before first-use, because "no results" and
 * "start here" call for opposite buttons. And "complete" last, because it is
 * the one that tells the student they are done — the claim a screen should
 * make only when every other reason has been ruled out.
 */
export function emptyStateFor(f: EmptyFacts): EmptyKind {
  if (f.loading) return 'loading';
  if (f.failed) return 'error';
  if (f.sourceDown) return 'source-unavailable';
  if (f.allowed === false) return 'no-permission';
  if (f.setUp === false) return 'no-setup';
  if (f.filtered) return 'no-results';
  if (!f.everHad) return 'first-use';
  return 'complete';
}
