import { cloud } from './cloud';

/**
 * Getting from "I'm stuck" to the right person, with the student holding the pen.
 *
 * The app can explain, quiz and plan, and none of that replaces an advisor who
 * knows the degree, a tutor who can watch you work a problem, or a librarian
 * who knows which database to search. This is the route from one to the other.
 * It is deliberately narrow, and each narrowness is a rule the database
 * enforces as well (`supabase/migrations/20260927230000_help_requests.sql`):
 *
 * ## Nothing leaves that the student did not write or tick
 *
 * A request is their question plus any of seven named context fields — which
 * course, which assignment, which requirement. The fields start **unticked**:
 * the minimum-necessary default is the question alone. `preview` is what the
 * confirm screen shows and `payload` is what is sent, and `payload` is built
 * from `preview` rather than beside it, so the two cannot say different
 * things. `CONTEXT_KEYS` is the database's vocabulary exactly;
 * `help-routes.test.ts` reads the migration and fails when they drift.
 *
 * ## Some needs are a directory, never a request
 *
 * Wellbeing, accessibility and money are routed to the official office
 * directly. Semester shows the link and the hours and stores nothing: a
 * student's mental health, disability or finances are not something an app
 * should be carrying between them and an office, and a stored request would be
 * one more copy of the most sensitive thing they have. The database has no
 * destination kind for wellbeing at all, and refuses `accepts_requests` on the
 * other two.
 *
 * ## Nobody is referred automatically
 *
 * There is no code path that sends a request the student did not confirm, and
 * nothing here reads grades, risk, or behaviour to suggest one. A need is
 * something the student picks.
 */

// ── The needs a student can name ─────────────────────────────────────────

export type DestinationKind =
  | 'advisor'
  | 'registrar'
  | 'transfer_center'
  | 'tutoring'
  | 'writing_center'
  | 'library'
  | 'instructor'
  | 'career_center'
  | 'accessibility_office'
  | 'financial_aid'
  | 'campus_service';

/** The kinds the database will store a request for. The rest are directory-only. */
export const DIRECTORY_ONLY: ReadonlySet<DestinationKind> = new Set(['accessibility_office', 'financial_aid']);

export const KIND_TEXT: Record<DestinationKind, string> = {
  advisor: 'Academic advisor',
  registrar: 'Registrar',
  transfer_center: 'Transfer center',
  tutoring: 'Tutoring',
  writing_center: 'Writing center',
  library: 'Librarian',
  instructor: 'Instructor or TA office hours',
  career_center: 'Career coach',
  accessibility_office: 'Accessibility office',
  financial_aid: 'Financial aid',
  campus_service: 'Campus office',
};

export type NeedId =
  | 'course'
  | 'writing'
  | 'research'
  | 'registration'
  | 'career'
  | 'accessibility'
  | 'money'
  | 'wellbeing'
  | 'community';

export interface Need {
  id: NeedId;
  label: string;
  /** Where to go, best first. Empty for wellbeing, which is directory-only by construction. */
  kinds: DestinationKind[];
  /** Context fields worth offering for this need. Still unticked by default. */
  offer: ContextKey[];
  /** When true, Semester only points; it never stores a request. */
  directoryOnly: boolean;
  /** One sentence the student reads before choosing. */
  note: string;
}

export const NEEDS: Need[] = [
  {
    id: 'course',
    label: 'Stuck on course material',
    kinds: ['instructor', 'tutoring'],
    offer: ['course', 'assignment', 'tried'],
    directoryOnly: false,
    note: 'Office hours and tutoring are for exactly this. Bring what you tried.',
  },
  {
    id: 'writing',
    label: 'A paper or writing project',
    kinds: ['writing_center', 'instructor'],
    offer: ['course', 'assignment', 'deadline'],
    directoryOnly: false,
    note: 'The writing center works on drafts at any stage, including none.',
  },
  {
    id: 'research',
    label: 'Finding or checking sources',
    kinds: ['library'],
    offer: ['course', 'assignment', 'source'],
    directoryOnly: false,
    note: 'A subject librarian can point you at the right database in minutes.',
  },
  {
    id: 'registration',
    label: 'Registration or degree requirements',
    kinds: ['advisor', 'registrar', 'transfer_center'],
    offer: ['requirement', 'plan', 'deadline'],
    directoryOnly: false,
    note: 'Semester’s requirement checks are estimates. Your advisor and the registrar are the official answer.',
  },
  {
    id: 'career',
    label: 'Career or internship decisions',
    kinds: ['career_center'],
    offer: ['plan', 'deadline'],
    directoryOnly: false,
    note: 'A career coach can review an application or talk through options.',
  },
  {
    id: 'community',
    label: 'Finding people or a group',
    kinds: ['campus_service'],
    offer: [],
    directoryOnly: false,
    note: 'Campus offices can point you to groups, mentors and events.',
  },
  {
    id: 'accessibility',
    label: 'Accessibility or accommodations',
    kinds: ['accessibility_office'],
    offer: [],
    directoryOnly: true,
    note: 'Contact the office directly. Semester does not send or store anything about this.',
  },
  {
    id: 'money',
    label: 'Financial aid or a bill',
    kinds: ['financial_aid'],
    offer: [],
    directoryOnly: true,
    note: 'Use the official office. Semester does not send or store anything about this.',
  },
  {
    id: 'wellbeing',
    label: 'Wellbeing or someone to talk to',
    kinds: [],
    offer: [],
    directoryOnly: true,
    note: 'Your campus counseling service is the place to start. If you are in danger, call or text 988, or your local emergency number. Semester does not send or store anything about this.',
  },
];

export function needById(id: NeedId): Need {
  const found = NEEDS.find((n) => n.id === id);
  if (!found) throw new Error(`unknown need ${id}`);
  return found;
}

// ── What a request may carry ─────────────────────────────────────────────

/** The database's vocabulary, in the same order. Adding one is a privacy decision. */
export const CONTEXT_KEYS = ['course', 'assignment', 'requirement', 'plan', 'deadline', 'source', 'tried'] as const;
export type ContextKey = (typeof CONTEXT_KEYS)[number];

export const CONTEXT_TEXT: Record<ContextKey, string> = {
  course: 'Which course',
  assignment: 'Which assignment',
  requirement: 'Which requirement',
  plan: 'Your plan or options',
  deadline: 'The deadline',
  source: 'The source or citation',
  tried: 'What you already tried',
};

/**
 * Named here so the confirm screen can say it, and so a later field added to
 * `CONTEXT_KEYS` has to be argued past this list in review.
 */
export const NEVER_SENT = [
  'Grades or GPA',
  'Health, disability or counseling records',
  'Financial aid or billing details',
  'Immigration or visa status',
  'Conduct records',
  'Your messages, notes or AI conversations',
  'Your location',
] as const;

/**
 * Sent with every request, whatever is ticked, because an office cannot book
 * an appointment with a question alone. Shown on the confirm screen with the
 * student's real values before they send, and read by
 * `send_help_request` at the moment of sending, so the office sees exactly
 * what the student saw even if they rename themselves later. Withdrawal
 * erases it with the rest of the request.
 */
export const IDENTITY_SENT = [
  { key: 'name', label: 'Your name on Semester' },
  { key: 'email', label: 'Your university email' },
] as const;

/** The limits the database checks, so the screen refuses first and says why. */
export const QUESTION_MAX = 2000;
export const FIELD_MAX = 600;

export interface Draft {
  question: string;
  /** Whatever the student typed into each field, ticked or not. */
  fields: Partial<Record<ContextKey, string>>;
  /** The fields they chose to send. Starts empty. */
  ticked: ReadonlySet<ContextKey>;
}

export const emptyDraft = (): Draft => ({ question: '', fields: {}, ticked: new Set() });

export interface PreviewLine {
  key: 'question' | ContextKey;
  label: string;
  value: string;
}

/**
 * Exactly what will leave, in the order the student reads it. A ticked field
 * with nothing in it is dropped rather than sent empty — the database would
 * refuse it, and "you ticked it but it said nothing" is not worth an error.
 */
export function preview(draft: Draft): PreviewLine[] {
  const lines: PreviewLine[] = [];
  const question = draft.question.trim().slice(0, QUESTION_MAX);
  if (question) lines.push({ key: 'question', label: 'Your question', value: question });
  for (const key of CONTEXT_KEYS) {
    if (!draft.ticked.has(key)) continue;
    const value = (draft.fields[key] ?? '').trim().slice(0, FIELD_MAX);
    if (value) lines.push({ key, label: CONTEXT_TEXT[key], value });
  }
  return lines;
}

/** What `send_help_request` receives. Built from the preview, never beside it. */
export function payload(draft: Draft): { question: string; context: Partial<Record<ContextKey, string>> } {
  const lines = preview(draft);
  const context: Partial<Record<ContextKey, string>> = {};
  let question = '';
  for (const line of lines) {
    if (line.key === 'question') question = line.value;
    else context[line.key] = line.value;
  }
  return { question, context };
}

export function sendable(draft: Draft): string | null {
  if (!draft.question.trim()) return 'Write your question first.';
  return null;
}

/**
 * The same preview as plain text, for a student whose school has not
 * connected an office yet: they can take it to office hours or paste it into
 * an email themselves. Useful on its own, and nothing is stored.
 */
export function asNote(draft: Draft, to: DestinationKind | null): string {
  const lines = preview(draft);
  if (!lines.length) return '';
  const head = to ? `For: ${KIND_TEXT[to]}` : 'Questions to bring';
  return [head, '', ...lines.map((l) => (l.key === 'question' ? l.value : `${l.label}: ${l.value}`))].join('\n');
}

// ── A request once sent ──────────────────────────────────────────────────

export const REQUEST_STATUSES = ['sent', 'acknowledged', 'scheduled', 'closed', 'withdrawn'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/**
 * Who may move a request where. Staff move forward only; only the student
 * withdraws. `answer_help_request` and `withdraw_help_request` enforce the
 * same table, and the test compares them.
 */
export const STAFF_MOVES: Record<RequestStatus, readonly RequestStatus[]> = {
  sent: ['acknowledged', 'scheduled', 'closed'],
  acknowledged: ['scheduled', 'closed'],
  scheduled: ['closed'],
  closed: [],
  withdrawn: [],
};
/** Closed included: an office being done with a request does not end the student's right to erase it. */
export const WITHDRAWABLE: ReadonlySet<RequestStatus> = new Set(['sent', 'acknowledged', 'scheduled', 'closed']);

export const STATUS_TEXT: Record<RequestStatus, string> = {
  sent: 'Sent',
  acknowledged: 'Seen by the office',
  scheduled: 'Scheduled',
  closed: 'Closed',
  withdrawn: 'Withdrawn',
};

/**
 * The next thing for the student to do, if there is one. This is the
 * follow-up the handoff hands back: a request is not finished when it is sent.
 */
export function followUp(status: RequestStatus, reply: string): string | null {
  switch (status) {
    case 'sent':
      return 'Waiting for the office. You can withdraw this at any time.';
    case 'acknowledged':
      return 'The office has seen it. Watch for a reply here or by email.';
    case 'scheduled':
      return reply ? `Prepare for it: ${reply}` : 'Prepare for your appointment: bring your question and anything you tried.';
    case 'closed':
      return reply ? `Closed: ${reply}` : null;
    case 'withdrawn':
      return null;
  }
}

// ── The database ─────────────────────────────────────────────────────────

export interface Destination {
  id: string;
  kind: DestinationKind;
  name: string;
  officialUrl: string | null;
  hours: string;
  acceptsRequests: boolean;
}

export interface SentRequest {
  id: string;
  destinationId: string;
  question: string;
  context: Partial<Record<ContextKey, string>>;
  status: RequestStatus;
  reply: string;
  createdAt: string;
  opens: number;
}

const message = (error: { message?: string } | null, fallback: string) =>
  error?.message?.trim() || fallback;

const isStatus = (v: unknown): v is RequestStatus =>
  typeof v === 'string' && (REQUEST_STATUSES as readonly string[]).includes(v);

export async function loadHelp(): Promise<{ destinations: Destination[]; requests: SentRequest[]; name: string }> {
  const db = await cloud();
  const { data: me } = await db.auth.getUser();
  const [dest, reqs, events, profile] = await Promise.all([
    db.from('help_destinations').select('id, kind, name, official_url, hours, accepts_requests'),
    db.from('help_requests').select('id, destination_id, question, shared_context, status, reply, created_at').order('created_at', { ascending: false }),
    db.from('help_request_events').select('request_id, kind'),
    db.from('profiles').select('handle').eq('user_id', me.user?.id ?? '').maybeSingle(),
  ]);
  if (dest.error) throw new Error(message(dest.error, 'Could not load where to get help.'));
  if (reqs.error) throw new Error(message(reqs.error, 'Could not load your requests.'));
  const opens = new Map<string, number>();
  for (const e of (events.data ?? []) as Record<string, unknown>[]) {
    if (e.kind === 'opened') opens.set(String(e.request_id), (opens.get(String(e.request_id)) ?? 0) + 1);
  }
  return {
    name: String((profile.data as { handle?: string } | null)?.handle ?? ''),
    destinations: ((dest.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      kind: String(row.kind) as DestinationKind,
      name: String(row.name),
      officialUrl: row.official_url ? String(row.official_url) : null,
      hours: String(row.hours ?? ''),
      acceptsRequests: row.accepts_requests === true,
    })),
    requests: ((reqs.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      destinationId: String(row.destination_id),
      question: String(row.question ?? ''),
      context: (row.shared_context ?? {}) as Partial<Record<ContextKey, string>>,
      status: isStatus(row.status) ? row.status : 'sent',
      reply: String(row.reply ?? ''),
      createdAt: String(row.created_at),
      opens: opens.get(String(row.id)) ?? 0,
    })),
  };
}

export async function sendHelp(destinationId: string, draft: Draft): Promise<string> {
  const refusal = sendable(draft);
  if (refusal) throw new Error(refusal);
  const { question, context } = payload(draft);
  const db = await cloud();
  const { data, error } = await db.rpc('send_help_request', {
    want_destination: destinationId,
    want_question: question,
    want_context: context,
  });
  if (error) throw new Error(message(error, 'Could not send your request.'));
  return String(data);
}

export async function withdrawHelp(requestId: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('withdraw_help_request', { want: requestId });
  if (error) throw new Error(message(error, 'Could not withdraw the request.'));
}

// ── The staff side ───────────────────────────────────────────────────────
//
// Staff never read the request table. They learn which inboxes are theirs,
// see ids, statuses and times in each, and open one at a time — and every
// open is written down where the student can see it. The screen says so
// before the button, not after.

export interface StaffInbox {
  destination: { id: string; kind: DestinationKind; name: string };
  items: { id: string; status: RequestStatus; createdAt: string; updatedAt: string }[];
}

export interface OpenedRequest {
  studentName: string;
  studentEmail: string;
  question: string;
  context: Partial<Record<ContextKey, string>>;
  status: RequestStatus;
  /** What the office last replied, so staff coming back can see it. */
  reply: string;
  createdAt: string;
}

export const REPLY_MAX = 1000;

/**
 * The reply a request carries after an answer: the new one when there is one,
 * otherwise the one before — the rule `answer_help_request` applies, so the
 * card never shows something the database did not keep.
 */
export const replyAfter = (previous: string, sent: string): string =>
  sent.trim() ? sent.trim().slice(0, REPLY_MAX) : previous;

/**
 * How the staff inbox can be narrowed. "Open" is the working queue — anything
 * not yet closed — and is where the inbox starts. Withdrawn requests never
 * reach an inbox (`help_inbox` leaves them out), so no filter names them.
 */
export const INBOX_FILTERS = ['new', 'open', 'closed', 'all'] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];

export const INBOX_FILTER_TEXT: Record<InboxFilter, string> = {
  new: 'New',
  open: 'Open',
  closed: 'Closed',
  all: 'All',
};

/** Whether a request with this status shows under this filter. */
export function inFilter(status: RequestStatus, filter: InboxFilter): boolean {
  switch (filter) {
    case 'new':
      return status === 'sent';
    case 'open':
      return status === 'sent' || status === 'acknowledged' || status === 'scheduled';
    case 'closed':
      return status === 'closed';
    case 'all':
      return true;
  }
}

/**
 * Requests nobody at the office has marked seen yet, across every inbox this
 * account answers for. Opening a request does not change its status, so a
 * request stays new until someone moves it on.
 */
export const newRequestCount = (inboxes: readonly StaffInbox[]): number =>
  inboxes.reduce((n, box) => n + box.items.filter((item) => item.status === 'sent').length, 0);

/** Every inbox this account answers for, with what is waiting in each. */
export async function loadInboxes(): Promise<StaffInbox[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('my_help_destinations');
  if (error) throw new Error(message(error, 'Could not load your inboxes.'));
  const destinations = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    kind: String(row.kind) as DestinationKind,
    name: String(row.name),
  }));
  return Promise.all(
    destinations.map(async (destination) => {
      const res = await db.rpc('help_inbox', { want_destination: destination.id });
      if (res.error) throw new Error(message(res.error, `Could not load ${destination.name}.`));
      return {
        destination,
        items: ((res.data ?? []) as Record<string, unknown>[]).map((row) => ({
          id: String(row.request_id),
          status: isStatus(row.status) ? row.status : 'sent',
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at),
        })),
      };
    }),
  );
}

/** Opens one request. The student sees that this happened. */
export async function openRequest(requestId: string): Promise<OpenedRequest> {
  const db = await cloud();
  const { data, error } = await db.rpc('open_help_request', { want: requestId });
  if (error) throw new Error(message(error, 'Could not open the request.'));
  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) throw new Error('That request is no longer available.');
  const context: Partial<Record<ContextKey, string>> = {};
  const raw = (row.shared_context ?? {}) as Record<string, unknown>;
  for (const key of CONTEXT_KEYS) if (typeof raw[key] === 'string') context[key] = raw[key] as string;
  return {
    studentName: String(row.student_name ?? ''),
    studentEmail: String(row.student_email ?? ''),
    question: String(row.question ?? ''),
    context,
    status: isStatus(row.status) ? row.status : 'sent',
    reply: String(row.reply ?? ''),
    createdAt: String(row.created_at),
  };
}

/** Moves a request forward, refusing here any move the database would refuse. */
export async function answerRequest(
  requestId: string,
  from: RequestStatus,
  to: RequestStatus,
  reply: string,
): Promise<void> {
  if (!STAFF_MOVES[from].includes(to)) throw new Error(`A ${STATUS_TEXT[from].toLowerCase()} request cannot be moved to ${STATUS_TEXT[to].toLowerCase()}.`);
  const db = await cloud();
  const { error } = await db.rpc('answer_help_request', {
    want: requestId,
    want_status: to,
    want_reply: reply.trim().slice(0, REPLY_MAX),
  });
  if (error) throw new Error(message(error, 'Could not update the request.'));
}

// ── From an action to a person ───────────────────────────────────────────
//
// The Action Center's "Ask for help" used to end in a note on the device and
// a sentence telling the student to take it to someone. This is the bridge
// that takes them there instead: the action becomes a need and some context,
// and Get help opens on it.
//
// Three rules hold across the bridge, and each is a test:
//   * **Pre-filled, never pre-ticked.** The action's title and date arrive in
//     the fields, where the student can read and change them, and nothing is
//     included until they tick it. The minimum-necessary default does not
//     change because the app happened to know something.
//   * **Nothing is stored to make the trip.** The seed is held in memory for
//     the one navigation and taken on arrival. An action about a deadline is
//     not written anywhere new because somebody pressed a button.
//   * **Not every action has a person.** A setup step has no office, so it
//     returns null and the caller keeps what it did before.
//
// The input is structural rather than `lib/actions.ts`'s `Action`, so this
// file depends on no particular copy of the Action Center.

export interface ActionLike {
  type: string;
  title: string;
  dueAt?: number | null;
}

export interface HelpSeed {
  need: NeedId;
  fields: Partial<Record<ContextKey, string>>;
  /** Shown above the form, so the student knows why it is filled in. */
  from: string;
  /** The question, when the screen that sent the student already has it in their words. */
  question?: string;
}

const dateLine = (at: number) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(at));

/** Which need an action is about, and what to pre-fill. Null when no person is the answer. */
export function helpFromAction(action: ActionLike): HelpSeed | null {
  const title = action.title.trim().slice(0, FIELD_MAX);
  const due = typeof action.dueAt === 'number' && Number.isFinite(action.dueAt) ? dateLine(action.dueAt) : null;
  const from = `From your Action Center: ${title}`;
  switch (action.type) {
    case 'deadline':
    case 'study':
      return { need: 'course', from, fields: { assignment: title, ...(due ? { deadline: due } : {}) } };
    case 'path':
    case 'registration':
      return { need: 'registration', from, fields: { requirement: title, ...(due ? { deadline: due } : {}) } };
    default:
      return null;
  }
}

let pending: HelpSeed | null = null;

/** Whether a seed is waiting, without taking it — for the screen choosing its tab. */
export const helpSeedWaiting = (): boolean => pending !== null;

/** The waiting seed, once. */
export function takeHelpSeed(): HelpSeed | null {
  const seed = pending;
  pending = null;
  return seed;
}

/**
 * The Action Center's "Ask for help", when there is a person to ask. Returns
 * false when there is not, so the caller can fall back to recording a note.
 */
export function askForHelp(action: ActionLike, go: () => void): boolean {
  const seed = helpFromAction(action);
  if (!seed) return false;
  seedHelp(seed, go);
  return true;
}

/**
 * Leave a seed for the help screen and go there. The no-wrong-door router
 * (`lib/nowrongdoor.ts`) uses it with the student's own sentence as the
 * question; the seed is taken once by `GetHelp`, and nothing is sent until
 * the student reads the preview and confirms, the same as every other route.
 */
export function seedHelp(seed: HelpSeed, go: () => void): void {
  pending = seed;
  go();
}
