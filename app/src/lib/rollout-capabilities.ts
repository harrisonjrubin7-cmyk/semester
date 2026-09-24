/**
 * The approved rollout inventory, stated once in a form the product, reports,
 * execution packets and audits can all read.
 *
 * A capability is not the same thing as a route. Several of the sixty are
 * grains inside Today or Courses, while Draw and Equations together serve the
 * graphs-and-diagrams promise. `destinations` therefore names the existing
 * doors through which the promise is delivered; it does not manufacture a
 * sixtieth top-level screen to make two unrelated counts look alike.
 */

export type CapabilityDisposition = 'preserve' | 'extend' | 'build' | 'external-gate';
export type CapabilityState = 'verified' | 'partial' | 'absent' | 'blocked' | 'conflict';
export type RolloutPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type EvidenceRef =
  | `repo:${string}`
  | `drive:${string}`
  | `web:${string}`
  | `attachment:${string}#L${number}-L${number}`;

export interface RolloutCapability {
  id: `CAP-${string}`;
  name: string;
  promise: string;
  destinations: string[];
  phase: RolloutPhase;
  disposition: CapabilityDisposition;
  currentState: CapabilityState;
  owner: string;
  dependencies: string[];
  sources: EvidenceRef[];
  acceptance: string[];
}

/** Embedded flows may be mapped here when a capability genuinely has no launcher destination. */
export const NON_DESTINATION_FLOWS = ['item'] as const;

const INVENTORY: EvidenceRef = 'attachment:Pasted text.txt#L194-L985';
const DESIGN: EvidenceRef =
  'repo:docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md';

type Row = Omit<RolloutCapability, 'id' | 'sources' | 'acceptance'> & {
  number: number;
  acceptance?: string;
};

function capability(row: Row): RolloutCapability {
  return {
    id: `CAP-${String(row.number).padStart(3, '0')}`,
    name: row.name,
    promise: row.promise,
    destinations: row.destinations,
    phase: row.phase,
    disposition: row.disposition,
    currentState: row.currentState,
    owner: row.owner,
    dependencies: row.dependencies,
    sources: [INVENTORY, DESIGN],
    acceptance: [row.acceptance ?? `${row.name} completes its stated user outcome without an unsupported claim.`],
  };
}

const rows: Row[] = [
  { number: 1, name: 'Today', promise: 'Show what is next, due, scheduled and most important today.', destinations: ['home'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Academic experience', dependencies: [] },
  { number: 2, name: 'Reports', promise: 'Summarize recorded daily, weekly and term activity without fabricated productivity scores.', destinations: ['brief'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Academic experience', dependencies: [] },
  { number: 3, name: 'Calendar', promise: 'Unify classes, deadlines, exams, events and appointments with source-aware dates.', destinations: ['calendar'], phase: 2, disposition: 'extend', currentState: 'partial', owner: 'Academic platform', dependencies: ['CAP-020', 'CAP-021'] },
  { number: 4, name: 'Exam Runway', promise: 'Build an editable backward plan from an exam date and available study time.', destinations: ['runway'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Learning experience', dependencies: [] },
  { number: 5, name: 'The Week Ahead', promise: 'Show seven days of schedule, workload, locations and available hours.', destinations: ['home'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Academic experience', dependencies: [] },
  { number: 6, name: 'When You Are Behind', promise: 'Offer a calm recovery workflow for overdue work and explicit tradeoffs.', destinations: ['behind'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Academic experience', dependencies: [] },
  { number: 7, name: 'Tonight', promise: 'Create a realistic short plan from time, weight, effort and urgency.', destinations: ['home'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Academic experience', dependencies: [] },
  { number: 8, name: 'Timers and Alarms', promise: 'Run cancellable timers and alarms while stating browser delivery limits.', destinations: ['clocks'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Productivity experience', dependencies: [] },
  { number: 9, name: 'Progress', promise: 'Explain workload, completion, learning evidence and grade progress from recorded data.', destinations: ['me'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Academic experience', dependencies: [] },
  { number: 10, name: 'Account', promise: 'Make sign-in, device/account state, recovery and local-versus-cloud ownership clear.', destinations: ['account'], phase: 1, disposition: 'extend', currentState: 'partial', owner: 'Identity platform', dependencies: ['CAP-011', 'CAP-015'] },
  { number: 11, name: 'Profile', promise: 'Manage identity, institution, term and information owned by the account.', destinations: ['profile'], phase: 1, disposition: 'extend', currentState: 'partial', owner: 'Identity platform', dependencies: ['CAP-010'] },
  { number: 12, name: 'Links', promise: 'Organize campus, LMS, bookstore, ticketing and personal links.', destinations: ['links'], phase: 3, disposition: 'preserve', currentState: 'verified', owner: 'Campus experience', dependencies: [] },
  { number: 13, name: 'Connect Accounts', promise: 'Show provider connection, permissions, sync time, errors and disconnection truthfully.', destinations: ['connect'], phase: 6, disposition: 'external-gate', currentState: 'blocked', owner: 'Integration platform', dependencies: ['external:provider credentials and institution approval', 'CAP-010'] },
  { number: 14, name: 'Your Data and How It Is Running', promise: 'Expose stored records, capacity, provenance and application health.', destinations: ['data'], phase: 1, disposition: 'extend', currentState: 'partial', owner: 'Data platform', dependencies: ['CAP-015', 'CAP-016'] },
  { number: 15, name: 'Privacy and Your Rights', promise: 'Explain and control collection, sharing, consent, deletion and connected permissions.', destinations: ['privacy'], phase: 1, disposition: 'extend', currentState: 'partial', owner: 'Trust and privacy', dependencies: ['CAP-010', 'CAP-014'] },
  { number: 16, name: 'Take It With You', promise: 'Export, back up, validate and restore complete versioned user data.', destinations: ['export'], phase: 1, disposition: 'extend', currentState: 'partial', owner: 'Data platform', dependencies: ['CAP-014', 'CAP-015'] },
  { number: 17, name: 'Settings', promise: 'Control appearance, navigation, courses, grading, workload, alerts and assistant behavior.', destinations: ['settings'], phase: 1, disposition: 'preserve', currentState: 'verified', owner: 'Core application', dependencies: [] },
  { number: 18, name: 'Alerts', promise: 'Review and control deduplicated course and deadline notifications with honest delivery status.', destinations: ['notifs'], phase: 3, disposition: 'extend', currentState: 'partial', owner: 'Communication platform', dependencies: ['CAP-003', 'CAP-017'] },
  { number: 19, name: 'How This Works', promise: 'Explain features, requirements, boundaries, troubleshooting and current limitations.', destinations: ['help'], phase: 0, disposition: 'extend', currentState: 'partial', owner: 'Product education', dependencies: ['CAP-013', 'CAP-014'] },
  { number: 20, name: 'Courses', promise: 'Keep a stable source-aware hub for course details, grading, work and materials.', destinations: ['courses'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Academic platform', dependencies: [] },
  { number: 21, name: 'Assignments', promise: 'Connect instructions, sources, checklists, plans, drafts, study material and feedback.', destinations: ['work', 'item'], phase: 2, disposition: 'extend', currentState: 'partial', owner: 'Academic platform', dependencies: ['CAP-020', 'CAP-003'] },
  { number: 22, name: 'Add a Course', promise: 'Import or create a course with cited extraction and confirmation before save.', destinations: ['import'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Academic ingestion', dependencies: [] },
  { number: 23, name: 'Edit the Course', promise: 'Correct imported dates, policies, meetings, grading and course metadata.', destinations: ['edit'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Academic ingestion', dependencies: [] },
  { number: 24, name: 'A Change to a Date', promise: 'Reconcile a changed deadline while preserving the previous value and source.', destinations: ['announce'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Academic ingestion', dependencies: [] },
  { number: 25, name: 'Study', promise: 'Unify guides, eleven modes, plans, notes, groups, citations and learning evidence.', destinations: ['study'], phase: 2, disposition: 'extend', currentState: 'partial', owner: 'Learning platform', dependencies: ['CAP-020', 'CAP-028'] },
  { number: 26, name: 'Where Courses Meet', promise: 'Compare related concepts without asserting false equivalence.', destinations: ['meet'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Learning platform', dependencies: [] },
  { number: 27, name: 'Semester Tutor', promise: 'Provide persistent, source-aware, policy-aware academic conversation.', destinations: ['ask'], phase: 4, disposition: 'extend', currentState: 'partial', owner: 'Semester Intelligence', dependencies: ['CAP-025', 'CAP-038'] },
  { number: 28, name: 'Add a Reading', promise: 'Add source material once and make it available across study and tutoring tools.', destinations: ['update'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Academic ingestion', dependencies: [] },
  { number: 29, name: 'Problem Practice', promise: 'Generate and check worked practice with varied inputs and progressive hints.', destinations: ['solve'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Learning platform', dependencies: [] },
  { number: 30, name: 'Practice Exams', promise: 'Run timed course-specific attempts with scoring keys and review.', destinations: ['exam'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Learning platform', dependencies: [] },
  { number: 31, name: 'Create', promise: 'Launch and manage course-aware documents, presentations, sheets, forms, design, video and notes.', destinations: ['create'], phase: 5, disposition: 'extend', currentState: 'partial', owner: 'Workspace platform', dependencies: ['CAP-034', 'CAP-035', 'CAP-036', 'CAP-040'] },
  { number: 32, name: 'Analyse Data', promise: 'Compute transparent local summaries from CSV data before any AI explanation.', destinations: ['analyse'], phase: 5, disposition: 'preserve', currentState: 'verified', owner: 'Workspace platform', dependencies: [] },
  { number: 33, name: 'Graphs and Diagrams', promise: 'Create editable mathematical graphs, data tables and described diagrams.', destinations: ['equations', 'draw'], phase: 5, disposition: 'extend', currentState: 'partial', owner: 'Workspace platform', dependencies: ['CAP-032', 'CAP-037'] },
  { number: 34, name: 'Presentations', promise: 'Create editable decks with notes, presentation mode and genuine PPTX export.', destinations: ['deck'], phase: 5, disposition: 'extend', currentState: 'partial', owner: 'Workspace platform', dependencies: ['CAP-031', 'CAP-040'] },
  { number: 35, name: 'Documents', promise: 'Create rich documents with equations, links, history, DOCX and PDF output.', destinations: ['write'], phase: 5, disposition: 'extend', currentState: 'partial', owner: 'Workspace platform', dependencies: ['CAP-031', 'CAP-037', 'CAP-040'] },
  { number: 36, name: 'Spreadsheets', promise: 'Edit formulas and ranges, preserve work, and export XLSX or CSV.', destinations: ['sheet'], phase: 5, disposition: 'extend', currentState: 'partial', owner: 'Workspace platform', dependencies: ['CAP-031', 'CAP-040'] },
  { number: 37, name: 'Maths', promise: 'Enter, render, copy, export and insert structured mathematical notation.', destinations: ['equations'], phase: 5, disposition: 'preserve', currentState: 'verified', owner: 'Workspace platform', dependencies: [] },
  { number: 38, name: 'Sources', promise: 'Preserve reference metadata, quotations, purpose, relationships and honest BibTeX export.', destinations: ['sources'], phase: 2, disposition: 'preserve', currentState: 'verified', owner: 'Academic integrity', dependencies: [] },
  { number: 39, name: 'Draft It', promise: 'Prepare factual personal and professional writing without invented experience.', destinations: ['essay'], phase: 5, disposition: 'preserve', currentState: 'verified', owner: 'Workspace platform', dependencies: [] },
  { number: 40, name: 'Files and Notes', promise: 'Keep original files, stable identities, notes, tasks, previews, downloads and recoverable Trash.', destinations: ['mine'], phase: 5, disposition: 'extend', currentState: 'partial', owner: 'Workspace platform', dependencies: ['CAP-016', 'CAP-031'] },
  { number: 41, name: 'Family', promise: 'Grant private, expiring, revocable, category-specific access to an authorized supporter.', destinations: ['family'], phase: 6, disposition: 'external-gate', currentState: 'partial', owner: 'Institutional services', dependencies: ['external:institution-authorized payer relationship and consent', 'CAP-015'] },
  { number: 42, name: 'Athletics', promise: 'Plan practices, competition, training, travel and academic conflicts.', destinations: ['athletics'], phase: 6, disposition: 'extend', currentState: 'partial', owner: 'Campus experience', dependencies: ['CAP-003', 'CAP-020'] },
  { number: 43, name: 'Campus Services', promise: 'Discover, prepare and safely act across official institutional service records.', destinations: ['university'], phase: 6, disposition: 'external-gate', currentState: 'blocked', owner: 'Institutional services', dependencies: ['external:institution agreement and approved service adapters', 'CAP-013'] },
  { number: 44, name: 'Degree Planning', promise: 'Model requirements, credits, mappings and what-if plans without claiming certification.', destinations: ['degree'], phase: 2, disposition: 'external-gate', currentState: 'partial', owner: 'Academic records', dependencies: ['external:approved catalog and degree-audit data', 'CAP-020'] },
  { number: 45, name: 'Term Deadlines', promise: 'Track registration, add/drop, withdrawal and graduation dates from authoritative sources.', destinations: ['registrar'], phase: 2, disposition: 'external-gate', currentState: 'partial', owner: 'Academic records', dependencies: ['external:authoritative registrar calendar feed', 'CAP-003'] },
  { number: 46, name: 'Money', promise: 'Explain charges, aid, installments and academic costs with their sources and assumptions.', destinations: ['costs'], phase: 6, disposition: 'external-gate', currentState: 'partial', owner: 'Institutional finance', dependencies: ['external:approved bursar and financial-aid adapters', 'CAP-043'] },
  { number: 47, name: 'Meal Plan', promise: 'Track plan, balance, pace, projections and dining preferences without inventing transactions.', destinations: ['meals'], phase: 6, disposition: 'external-gate', currentState: 'partial', owner: 'Campus services', dependencies: ['external:approved dining or campus-card adapter', 'CAP-043'] },
  { number: 48, name: 'Housing', promise: 'Compare options and manage preference, move-in and move-out plans.', destinations: ['housing'], phase: 6, disposition: 'external-gate', currentState: 'partial', owner: 'Campus services', dependencies: ['external:approved housing data and transaction adapter', 'CAP-043'] },
  { number: 49, name: 'Maps', promise: 'Search campus places and calculate class-aware departure guidance.', destinations: ['maps'], phase: 3, disposition: 'extend', currentState: 'partial', owner: 'Campus experience', dependencies: ['CAP-003', 'CAP-020'] },
  { number: 50, name: 'Registration', promise: 'Search, compare and validate schedules before any confirmed official registration action.', destinations: ['yes'], phase: 6, disposition: 'external-gate', currentState: 'blocked', owner: 'Academic records', dependencies: ['external:approved SIS registration adapter and write authorization', 'CAP-043', 'CAP-044'] },
  { number: 51, name: 'Clubs and Activities', promise: 'Discover real organizations and events and plan participation around coursework.', destinations: ['activities'], phase: 3, disposition: 'external-gate', currentState: 'blocked', owner: 'Campus graph', dependencies: ['external:approved organization and event source', 'CAP-003'] },
  { number: 52, name: 'People and Letters', promise: 'Track professional relationships and prepare evidence-based recommendation requests.', destinations: ['people'], phase: 7, disposition: 'extend', currentState: 'partial', owner: 'Career platform', dependencies: ['CAP-040', 'CAP-054'] },
  { number: 53, name: 'Pathway', promise: 'Support prospective, transfer, graduate, international and alumni lifecycle planning.', destinations: ['pathway'], phase: 7, disposition: 'extend', currentState: 'partial', owner: 'Lifecycle platform', dependencies: ['CAP-040', 'CAP-054'] },
  { number: 54, name: 'Career', promise: 'Maintain opportunity, experience, education, skills, network and achievement records.', destinations: ['career'], phase: 7, disposition: 'extend', currentState: 'partial', owner: 'Career platform', dependencies: ['CAP-040'] },
  { number: 55, name: 'Applications', promise: 'Track opportunity requirements, documents, stages, follow-up and academic conflicts.', destinations: ['applying'], phase: 7, disposition: 'extend', currentState: 'partial', owner: 'Career platform', dependencies: ['CAP-003', 'CAP-040', 'CAP-054'] },
  { number: 56, name: 'Check the Writing', promise: 'Review mechanics, read-back, quotations and citation integrity without replacing authorship.', destinations: ['proof'], phase: 5, disposition: 'preserve', currentState: 'verified', owner: 'Academic integrity', dependencies: [] },
  { number: 57, name: 'Video Call', promise: 'Join a browser call with explicit device, permission and connection boundaries.', destinations: ['call'], phase: 5, disposition: 'external-gate', currentState: 'partial', owner: 'Communication platform', dependencies: ['external:approved signaling and meeting provider configuration'] },
  { number: 58, name: 'Group Work', promise: 'Coordinate members, roles, responsibilities and deadlines with visible sync truth.', destinations: ['groupwork'], phase: 3, disposition: 'external-gate', currentState: 'partial', owner: 'Collaboration platform', dependencies: ['external:authenticated collaboration and synchronization service', 'CAP-020'] },
  { number: 59, name: 'Email', promise: 'Draft, receive and send course-aware email through an explicitly connected provider.', destinations: ['mail'], phase: 3, disposition: 'external-gate', currentState: 'partial', owner: 'Communication platform', dependencies: ['external:approved Google or Microsoft mail connection', 'CAP-013'] },
  { number: 60, name: 'Chat', promise: 'Provide membership-aware course and group communication with honest sample and delivery states.', destinations: ['classmates'], phase: 3, disposition: 'external-gate', currentState: 'partial', owner: 'Communication platform', dependencies: ['external:authenticated messaging backend and institution membership source', 'CAP-020'] },
];

export const CAPABILITIES: readonly RolloutCapability[] = rows.map(capability);

export function capabilityIds(): string[] {
  return CAPABILITIES.map((item) => item.id);
}

export function dispositionCounts(): Record<CapabilityDisposition, number> {
  const counts: Record<CapabilityDisposition, number> = {
    preserve: 0,
    extend: 0,
    build: 0,
    'external-gate': 0,
  };
  for (const item of CAPABILITIES) counts[item.disposition] += 1;
  return counts;
}
