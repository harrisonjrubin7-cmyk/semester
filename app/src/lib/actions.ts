import { obj, textValue } from './device-library';
import type { SourceLabel } from './source';

/**
 * One list of things to do next, with a reason, a source and a history.
 *
 * Before this, the app had one "Next best step" (`lib/today-decision.ts`)
 * and a dozen screens each keeping their own idea of what was outstanding.
 * The blueprint's Action Center is the one place those meet: every module may
 * *propose* an action, and the student sees a single ranked list — the most
 * important one, then up to three more.
 *
 * ## Actions are derived; only the student's choices are stored
 *
 * An action is worked out, each time, from something the app already holds —
 * a deadline, the path snapshot, the registration checklist. Storing it would
 * make a second copy of that fact which goes stale the moment the first one
 * changes. What *is* the student's, and cannot be worked out again, is what
 * they did about it: started it, snoozed it until Thursday, dismissed it,
 * said it was wrong, asked for help. That is a `Choice`, keyed by the
 * action's stable id, and it is the only thing `semester.actions.v1` holds.
 *
 * ## The lifecycle is a table, not a set of ifs
 *
 * Eight states, and `TRANSITIONS` lists every move allowed out of each. A move
 * that is not in the table is refused with a reason, never silently applied —
 * "complete" on something already dismissed is a bug in a screen, and hiding
 * it would make the history lie about what the student did.
 *
 * ## No hidden scoring
 *
 * `score` is four named terms and a penalty, each returned alongside the total
 * (`Scored.parts`), so the explanation sheet can say exactly why one action
 * sits above another. Nothing about the student is inferred: urgency comes
 * from a date, impact from the proposing module's stated priority,
 * confidence from the source label, fatigue from how often *they* snoozed it.
 */

export const ACTION_STATUSES = [
  'open',
  'in_progress',
  'blocked',
  'snoozed',
  'completed',
  'dismissed',
  'expired',
  'cancelled',
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const PRIORITIES = ['critical', 'high', 'normal', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** What a student (or the app, for `expire`) can do to an action. */
export type ActionEvent =
  | 'start'
  | 'block'
  | 'snooze'
  | 'complete'
  | 'dismiss'
  | 'reopen'
  | 'cancel'
  | 'expire'
  | 'correct'
  | 'help';

/**
 * Every allowed move. `correct` and `help` are recorded without changing
 * state: saying "this is wrong" or "I need help with this" is part of the
 * history of an action, not a new place for it to be.
 */
export const TRANSITIONS: Record<ActionStatus, Partial<Record<ActionEvent, ActionStatus>>> = {
  open: { start: 'in_progress', block: 'blocked', snooze: 'snoozed', complete: 'completed', dismiss: 'dismissed', cancel: 'cancelled', expire: 'expired', correct: 'open', help: 'open' },
  in_progress: { block: 'blocked', snooze: 'snoozed', complete: 'completed', dismiss: 'dismissed', reopen: 'open', cancel: 'cancelled', expire: 'expired', correct: 'in_progress', help: 'in_progress' },
  blocked: { start: 'in_progress', snooze: 'snoozed', complete: 'completed', dismiss: 'dismissed', reopen: 'open', cancel: 'cancelled', expire: 'expired', correct: 'blocked', help: 'blocked' },
  snoozed: { reopen: 'open', start: 'in_progress', complete: 'completed', dismiss: 'dismissed', cancel: 'cancelled', expire: 'expired', correct: 'snoozed', help: 'snoozed' },
  completed: { reopen: 'open', correct: 'completed' },
  dismissed: { reopen: 'open', correct: 'dismissed' },
  expired: { reopen: 'open', correct: 'expired' },
  cancelled: { reopen: 'open' },
};

/** The statuses a student sees in the Action Center. */
export const VISIBLE: ReadonlySet<ActionStatus> = new Set(['open', 'in_progress', 'blocked']);

export interface ActionSource {
  label: SourceLabel;
  /** Where it came from, in words: "Your syllabus for ECON 1010", "Registration day checklist". */
  system: string;
  /** When the underlying fact was last updated, epoch ms. */
  at?: number | null;
  /** Who has authority over the underlying fact. */
  authority?: string;
  /** Who maintains or corrects the underlying record. */
  dataOwner?: string;
  /** The route the student can use to correct the record. */
  correctionRoute?: string;
  /** What to use when Semester cannot confirm or complete the action. */
  officialFallback?: string;
}

/** The explanation sheet. Every field is shown; none is decoration. */
export interface Explanation {
  /** Why this appeared now. */
  trigger: string;
  /** The facts it was worked out from. */
  factors: string[];
  /** What doing it is expected to change. */
  expectedImpact: string;
  /** What the app cannot see, or might have wrong. */
  limitations: string[];
  /** Other reasonable things to do instead. */
  alternatives: string[];
}

export interface PrimaryAction {
  label: string;
  /** `navigate` opens a screen in the app; `external` hands off to an official system. */
  kind: 'navigate' | 'external';
  /** A hash route (`#/yes`) for `navigate`, an https URL for `external`. */
  target: string;
  /** Sends, shares, exports and hand-offs always confirm first. */
  requiresConfirmation: boolean;
}

/** A proposed action, derived fresh each time from something the app holds. */
export interface Action {
  /** Stable across derivations: the same deadline always yields the same id. */
  id: string;
  /** The module that proposed it: `deadline`, `path`, `registration`, … */
  type: string;
  title: string;
  whyItMatters: string;
  priority: Priority;
  dueAt?: number | null;
  /** After this the action no longer applies, and it expires. */
  expiresAt?: number | null;
  estimatedMinutes?: number | null;
  /** Actions in the same workflow group together ("Registration readiness"). */
  group?: string;
  source: ActionSource;
  explanation: Explanation;
  primary: PrimaryAction;
}

export interface HistoryEntry {
  event: ActionEvent;
  at: number;
  from: ActionStatus;
  to: ActionStatus;
  note?: string;
}

/** What the student did about one action. The only thing stored. */
export interface Choice {
  status: ActionStatus;
  snoozedUntil?: number | null;
  history: HistoryEntry[];
}

export type Refused = { ok: false; why: string };
export type Moved = { ok: true; choice: Choice };

/** At most this many entries per action; the oldest go first. */
export const HISTORY_LIMIT = 50;
const DAY = 86_400_000;

/**
 * Apply one event. Returns the new choice, or a sentence saying why not.
 * `until` is required for `snooze` and must be in the future.
 */
export function transition(
  current: Choice | undefined,
  event: ActionEvent,
  now: number,
  options: { until?: number; note?: string } = {},
): Moved | Refused {
  // A snooze that has run out is open — `effectiveStatus` says so, and the
  // list shows it with an open action's controls. Moving it has to start from
  // the same place, or the "Snooze" button it shows is refused as a second
  // snooze of something still asleep.
  const awake = current?.status === 'snoozed' && typeof current.snoozedUntil === 'number' && current.snoozedUntil <= now;
  const from: ActionStatus = awake ? 'open' : (current?.status ?? 'open');
  const to = TRANSITIONS[from][event];
  if (!to) return { ok: false, why: `Cannot ${event} an action that is ${from.replace('_', ' ')}.` };
  if (event === 'snooze') {
    if (typeof options.until !== 'number' || !(options.until > now)) {
      return { ok: false, why: 'Choose a time in the future to snooze until.' };
    }
  }
  if ((event === 'correct' || event === 'help') && !options.note?.trim()) {
    return { ok: false, why: event === 'correct' ? 'Say what is wrong.' : 'Say what you need help with.' };
  }
  const entry: HistoryEntry = { event, at: now, from, to, ...(options.note?.trim() ? { note: options.note.trim().slice(0, 1000) } : {}) };
  const history = [...(current?.history ?? []), entry].slice(-HISTORY_LIMIT);
  return {
    ok: true,
    choice: {
      status: to,
      snoozedUntil: to === 'snoozed' ? options.until : null,
      history,
    },
  };
}

/**
 * The status an action really has now: a snooze that has run out is open
 * again, and an action past its `expiresAt` is expired. Worked out on read
 * rather than on a timer, so there is nothing to clean up.
 */
export function effectiveStatus(action: Action, choice: Choice | undefined, now: number): ActionStatus {
  const status = choice?.status ?? 'open';
  if (status === 'snoozed' && typeof choice?.snoozedUntil === 'number' && choice.snoozedUntil <= now) return 'open';
  const live = status === 'open' || status === 'in_progress' || status === 'blocked' || status === 'snoozed';
  if (live && typeof action.expiresAt === 'number' && action.expiresAt <= now) return 'expired';
  return status;
}

const IMPACT: Record<Priority, number> = { critical: 40, high: 25, normal: 12, low: 4 };
const CONFIDENCE: Record<SourceLabel, number> = {
  institution_verified: 10,
  imported: 7,
  student_entered: 7,
  estimated: 4,
  needs_review: 1,
};

export interface Scored {
  action: Action;
  status: ActionStatus;
  score: number;
  /** Each term of the score, so the explanation can show its working. */
  parts: { urgency: number; impact: number; actionability: number; confidence: number; fatigue: number };
}

/**
 * urgency + impact + actionability + confidence − fatigue.
 *
 * - **urgency** 0–40, from the due date: overdue or due today is 40, falling
 *   to nothing at two weeks out. No date, no urgency.
 * - **impact** from the proposing module's stated priority.
 * - **actionability** 10 when it can be done now, 5 in progress, 0 blocked.
 * - **confidence** from the source label: an estimate ranks below a fact.
 * - **fatigue** 3 per time the student snoozed it, up to 15, so something put
 *   off repeatedly sinks rather than nagging from the top.
 */
export function score(action: Action, choice: Choice | undefined, now: number): Scored {
  const status = effectiveStatus(action, choice, now);
  let urgency = 0;
  if (typeof action.dueAt === 'number') {
    const days = (action.dueAt - now) / DAY;
    urgency = days <= 1 ? 40 : days >= 14 ? 0 : Math.round(40 * (1 - (days - 1) / 13));
  }
  const impact = IMPACT[action.priority];
  const actionability = status === 'open' ? 10 : status === 'in_progress' ? 5 : 0;
  const confidence = CONFIDENCE[action.source.label];
  const snoozes = choice?.history.filter((h) => h.event === 'snooze').length ?? 0;
  const fatigue = Math.min(15, snoozes * 3);
  return {
    action,
    status,
    score: urgency + impact + actionability + confidence - fatigue,
    parts: { urgency, impact, actionability, confidence, fatigue },
  };
}

export interface Ranked {
  mostImportant: Scored | null;
  /** Up to `NEXT_LIMIT`, after the most important. */
  next: Scored[];
  /** Visible but beyond the first four: shown behind "View all". */
  rest: Scored[];
  /** Snoozed, done, dismissed, expired or cancelled: not in the list. */
  hidden: Scored[];
}

/**
 * One most important, then up to three.
 *
 * Was five. Today is a decision surface rather than a dashboard, and a list
 * of six on a phone is a list somebody scrolls rather than chooses from — the
 * product brief for continuity (docs/EXPERIENCE-CONTINUITY.md §2) sets the
 * surface at one plus three, with everything else one tap away behind
 * "View all". Nothing is hidden by this: it only moves the fold.
 */
export const NEXT_LIMIT = 3;

/**
 * The Action Center's order. Ties break on due date, then title, so the list
 * does not reshuffle between two renders with the same inputs.
 */
export function rank(actions: Action[], choices: Record<string, Choice>, now: number): Ranked {
  const scored = actions.map((a) => score(a, choices[a.id], now));
  const visible = scored
    .filter((s) => VISIBLE.has(s.status))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.action.dueAt ?? Infinity) - (b.action.dueAt ?? Infinity) ||
        a.action.title.localeCompare(b.action.title),
    );
  return {
    mostImportant: visible[0] ?? null,
    next: visible.slice(1, 1 + NEXT_LIMIT),
    rest: visible.slice(1 + NEXT_LIMIT),
    hidden: scored.filter((s) => !VISIBLE.has(s.status)),
  };
}

// ── the stored choices ──────────────────────────────────────────────────────

export const ACTIONS_PREFIX = 'semester.actions.v1';

export interface ActionChoices {
  version: 1;
  choices: Record<string, Choice>;
}

export const EMPTY_ACTION_CHOICES: ActionChoices = { version: 1, choices: {} };

const EVENTS = new Set<string>(Object.values(TRANSITIONS).flatMap((t) => Object.keys(t)));
const isStatus = (v: unknown): v is ActionStatus =>
  typeof v === 'string' && (ACTION_STATUSES as readonly string[]).includes(v);

function readEntry(v: unknown): HistoryEntry | null {
  if (!obj(v) || typeof v.event !== 'string' || !EVENTS.has(v.event)) return null;
  if (typeof v.at !== 'number' || !Number.isFinite(v.at) || !isStatus(v.from) || !isStatus(v.to)) return null;
  return {
    event: v.event as ActionEvent,
    at: v.at,
    from: v.from,
    to: v.to,
    ...(textValue(v.note, 1000) && v.note ? { note: v.note } : {}),
  };
}

/**
 * The validator every read and write goes through (`useDeviceLibrary`). An
 * entry it cannot read is dropped, not guessed at; a store that is not this
 * shape at all throws, which the library turns into "kept as it is, export a
 * recovery copy" rather than an empty list that the next write would save.
 */
export function readActionChoices(value: unknown): ActionChoices {
  if (!obj(value) || value.version !== 1 || !obj(value.choices)) throw new Error('Not an action store.');
  const choices: Record<string, Choice> = {};
  for (const [id, raw] of Object.entries(value.choices)) {
    if (!textValue(id, 300) || !obj(raw) || !isStatus(raw.status) || !Array.isArray(raw.history)) continue;
    const history = raw.history.map(readEntry).filter((e): e is HistoryEntry => e !== null).slice(-HISTORY_LIMIT);
    choices[id] = {
      status: raw.status,
      snoozedUntil: typeof raw.snoozedUntil === 'number' && Number.isFinite(raw.snoozedUntil) ? raw.snoozedUntil : null,
      history,
    };
  }
  return { version: 1, choices };
}
