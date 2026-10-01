import { allows, type CalmSettings, type Category } from './calm-controls';
import { obj } from './device-library';
import { formatDateTime } from './locale';

/**
 * The Semester Guide bar: one persistent line that says what today holds, the
 * one next step, and why, without ever becoming a feed.
 *
 * It is a model, not a component. The bar is the same on every surface, so what
 * it says is decided once here and `GuideBar` only draws it.
 *
 * ## The contract, in order
 *
 * Notice, Understand, Decide, Act, Confirm, Continue (`STAGES`). Each is a
 * field the screen can point at, so a surface cannot skip one by accident:
 *
 * - **Notice** is `headline`: what today holds, counted, zero items left out.
 * - **Understand** is `why`, `dataUsed` and `doesNotKnow`. A suggestion that
 *   cannot say what it read and what it could not see is a guess in a tidy box.
 * - **Decide** is `actions`: why this matters, snooze, not now, and the
 *   primary action. Declining is as easy as accepting, and neither is scored.
 * - **Act** is the primary action. Anything that sends or shares is confirmed
 *   by the screen it opens, not here.
 * - **Confirm** is `confirmationFor`: it says what happened and until when.
 * - **Continue** is `continueLine`: what happens next, so a choice never ends
 *   in silence.
 *
 * ## One priority
 *
 * The input carries a single priority or none, so "never more than one" is a
 * type, not a promise. A `fallback` priority is a gentle default ("add your
 * first course") rather than something found in the student's data; it is
 * shown as the next step but not counted as a priority, because counting a
 * default would claim the guide found something it did not.
 *
 * ## Choices are the student's, and they expire
 *
 * Snooze, Not now and Hide-like-this are stored against the suggestion's id
 * with an until-time (`GuideSuppressions`). Nothing is permanent except by the
 * student's say-so, and even Hide ends after a year. Copy is neutral: no
 * counters of what was put off, nothing in red.
 */

export const SURFACES = ['today', 'path', 'plan', 'study', 'workspace', 'career', 'campus'] as const;
export type Surface = (typeof SURFACES)[number];

/** Which calm-control category governs the guide on each surface. */
export const SURFACE_CATEGORY: Record<Surface, Category> = {
  today: 'deadlines',
  path: 'plan',
  plan: 'plan',
  study: 'study',
  workspace: 'plan',
  career: 'career',
  campus: 'campus',
};

export const STAGES = ['notice', 'understand', 'decide', 'act', 'confirm', 'continue'] as const;
export type Stage = (typeof STAGES)[number];

export interface GuidePriority {
  /** Stable across renders and days: a snooze is stored against it. */
  id: string;
  title: string;
  why: string;
  /** Where this came from, in the app's source wording. */
  source: string;
  /** "Due Thursday 11:59 PM", or null when there is no date. */
  deadlineLabel: string | null;
  /** A gentle default, not something found in the student's data. */
  fallback: boolean;
  /** The primary button's words. */
  primaryLabel?: string;
}

export interface GuideCounts {
  deadlines: number;
  planDecisions: number;
  continuations: number;
}

export interface GuideInput {
  surface: Surface;
  /** Today's single priority, or null. */
  priority: GuidePriority | null;
  counts: GuideCounts;
  calm: CalmSettings;
}

export type GuideActionKind = 'why' | 'snooze' | 'notNow' | 'primary';

export interface GuideAction {
  kind: GuideActionKind;
  label: string;
}

export interface GuideModel {
  surface: Surface;
  /** True when the student's settings say not to show the guide here. Draw nothing. */
  hidden: boolean;
  minimal: boolean;
  /** The one line shown in minimal mode, and the first line otherwise. */
  line: string;
  headline: string;
  parts: string[];
  nextBestStep: string | null;
  why: string | null;
  dataUsed: string[];
  doesNotKnow: string[];
  actions: GuideAction[];
  /** The suggestion's id, for storing a choice against. Null when there is no suggestion. */
  suggestionId: string | null;
  continueLine: string;
}

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** "One deadline", "Two deadlines", "12 deadlines". Words to ten, digits after. */
export function counted(n: number, singular: string, plural = `${singular}s`): string {
  const num = Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
  return `${num} ${n === 1 ? singular : plural}`;
}

const NOTHING = 'Today, nothing is waiting for you.';
const MIN_NOTHING = 'Nothing is waiting for you today.';

const DOES_NOT_KNOW_ALWAYS = 'Anything you have not added or connected to Semester.';
const DOES_NOT_KNOW_DATES = 'Whether a date has changed since it was last checked.';
const DOES_NOT_KNOW_FALLBACK = 'What matters most to you today. This is a gentle default.';

const CONTINUE: Record<'none' | 'some', string> = {
  none: 'There is nothing else to do right now.',
  some: 'Whatever you choose, the rest of your day stays as it is.',
};

export function guideBar(input: GuideInput): GuideModel {
  const { surface, calm } = input;
  const p = input.priority;
  const counts = input.counts;

  const parts = [
    ...(p && !p.fallback ? [counted(1, 'priority')] : []),
    ...(counts.deadlines > 0 ? [counted(counts.deadlines, 'deadline')] : []),
    ...(counts.planDecisions > 0 ? [counted(counts.planDecisions, 'plan decision')] : []),
    ...(counts.continuations > 0 ? [counted(counts.continuations, 'continuation')] : []),
  ];
  const headline = parts.length ? `Today, you have: ${parts.join(' · ')}` : NOTHING;

  const hidden = !allows(SURFACE_CATEGORY[surface], calm, new Date(0), 'surface');
  const minimal = calm.minimalMode;

  const primary: GuideAction | null = p ? { kind: 'primary', label: p.primaryLabel ?? 'Start' } : null;
  const nextBestStep = p ? (p.deadlineLabel ? `${p.title} · ${p.deadlineLabel}` : p.title) : null;

  const base = {
    surface,
    hidden,
    minimal,
    headline,
    parts,
    suggestionId: p?.id ?? null,
    continueLine: CONTINUE[p ? 'some' : 'none'],
  };

  if (hidden) return { ...base, line: '', nextBestStep: null, why: null, dataUsed: [], doesNotKnow: [], actions: [] };

  if (minimal) {
    // One line, the next step if there is one, and the primary button. The
    // explanation is a tap away in the full bar; minimal mode is the student
    // asking for less on the screen, so it carries less.
    return {
      ...base,
      line: nextBestStep ?? (parts.length ? headline : MIN_NOTHING),
      nextBestStep,
      why: null,
      dataUsed: [],
      doesNotKnow: [],
      actions: primary ? [primary] : [],
    };
  }

  const dataUsed = [
    ...(p ? [p.source] : []),
    ...(counts.deadlines > 0 ? [`${counted(counts.deadlines, 'deadline')} you have added or imported`] : []),
    ...(counts.planDecisions > 0 ? [`${counted(counts.planDecisions, 'plan decision')} from your own plan`] : []),
    ...(counts.continuations > 0 ? [`${counted(counts.continuations, 'continuation')} from work you started`] : []),
  ];
  const doesNotKnow = [
    DOES_NOT_KNOW_ALWAYS,
    ...(p?.deadlineLabel || counts.deadlines > 0 ? [DOES_NOT_KNOW_DATES] : []),
    ...(p?.fallback ? [DOES_NOT_KNOW_FALLBACK] : []),
  ];

  return {
    ...base,
    line: headline,
    nextBestStep,
    why: p?.why ?? null,
    dataUsed,
    doesNotKnow,
    actions: p
      ? [
          { kind: 'why', label: 'Why this matters' },
          { kind: 'snooze', label: 'Snooze' },
          { kind: 'notNow', label: 'Not now' },
          primary!,
        ]
      : [],
  };
}

/** What was chosen, in words, with the time it lasts until. The Confirm stage. */
export function confirmationFor(kind: SuppressKind, until: number): string {
  const when = formatDateTime(until, { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  if (kind === 'snooze') return `Snoozed until ${when}.`;
  if (kind === 'notNow') return `Not now. This will not come back before ${when}.`;
  return 'Hidden. You can turn it back on in the guide settings.';
}

// ── choices kept on the device ─────────────────────────────────────────────

export const SUPPRESS_KEY = 'semester.guide-choices.v1';

export type SuppressKind = 'snooze' | 'notNow' | 'hide';
export const SUPPRESS_KINDS: readonly SuppressKind[] = ['snooze', 'notNow', 'hide'];

const HOUR = 3_600_000;
/** How long each choice lasts. Hide is long, not forever. */
export const SUPPRESS_FOR: Record<SuppressKind, number> = {
  snooze: 4 * HOUR,
  notNow: 24 * HOUR,
  hide: 365 * 24 * HOUR,
};

export const SUPPRESS_LIMIT = 200;

export interface Suppression {
  kind: SuppressKind;
  /** Epoch ms. The suggestion may return at or after this moment. */
  until: number;
}

export interface GuideSuppressions {
  version: 1;
  items: Record<string, Suppression>;
}

export const EMPTY_SUPPRESSIONS: GuideSuppressions = { version: 1, items: {} };

export function readSuppressions(value: unknown): GuideSuppressions {
  const bad = () => new Error('Saved guide choices are not valid.');
  if (!obj(value) || value.version !== 1 || !obj(value.items)) throw bad();
  const entries = Object.entries(value.items);
  if (entries.length > SUPPRESS_LIMIT) throw bad();
  const items: Record<string, Suppression> = {};
  for (const [id, s] of entries) {
    if (!id || id.length > 200 || !obj(s) || !SUPPRESS_KINDS.includes(s.kind as SuppressKind) || typeof s.until !== 'number' || !Number.isFinite(s.until)) throw bad();
    items[id] = { kind: s.kind as SuppressKind, until: s.until };
  }
  return { version: 1, items };
}

/**
 * Whether the student has asked not to see this suggestion yet. Expired
 * choices stop counting the moment their time passes; nothing has to run to
 * clear them.
 */
export function isSuppressed(record: GuideSuppressions, id: string, now: number): boolean {
  const s = Object.hasOwn(record.items, id) ? record.items[id] : undefined;
  return !!s && s.until > now;
}

/**
 * Record a choice. Expired entries are dropped on the way, and past the limit
 * the ones that end soonest go first, so the record cannot grow without bound
 * and the longest-lived choices (a Hide) are the last to be forgotten.
 */
export function suppress(record: GuideSuppressions, id: string, kind: SuppressKind, now: number): GuideSuppressions {
  const live = Object.entries(record.items).filter(([k, s]) => k !== id && s.until > now);
  live.push([id, { kind, until: now + SUPPRESS_FOR[kind] }]);
  const kept = live.sort((a, b) => b[1].until - a[1].until).slice(0, SUPPRESS_LIMIT);
  return { version: 1, items: Object.fromEntries(kept) };
}

/** Take a choice back: the suggestion may show again straight away. */
export function unsuppress(record: GuideSuppressions, id: string): GuideSuppressions {
  const { [id]: _gone, ...rest } = record.items;
  return { version: 1, items: rest };
}

/** The priority to show, or null when the student has put it off. The input to `guideBar`. */
export function visiblePriority(priority: GuidePriority | null, record: GuideSuppressions, now: number): GuidePriority | null {
  return priority && !isSuppressed(record, priority.id, now) ? priority : null;
}
