/**
 * Internships, jobs, research posts, fellowships — the other deadline set.
 *
 * A term has two calendars running at once and the app only knew about one.
 * The syllabus calendar is the one professors publish and the app can read;
 * the recruiting calendar is the one that actually decides what happens after
 * graduation, and it arrives by email, on a careers portal, and in a
 * conversation at a coffee chat. It has been sitting in a spreadsheet, in
 * somebody's inbox, or nowhere.
 *
 * It belongs here for one reason: those deadlines land on the same days as
 * coursework. A first-round application due the same Friday as a paper is not
 * two separate problems, it is one Friday — and until both were in the app
 * nothing could say so. `asItems` puts the dated ones into the same shape as
 * coursework, which is what lets the collision detector see the whole Friday
 * rather than half of it.
 *
 * ## Stages describe what has happened, not how it is going
 *
 * There is no probability, no score, and no "strength of fit". The app knows
 * six facts about an application — that you found it, that you are writing it,
 * that you sent it, that somebody is talking to you, that there is an offer,
 * or that it is over — and it will not derive a seventh from them. A funnel
 * with eight applications in it produces conversion rates that are noise, and
 * a number that looks like a measurement gets believed.
 *
 * ## The next action is yours, in your words
 *
 * Every row carries one thing you have to do next and, optionally, when by.
 * Not a status — a status is something you read, and a next action is
 * something you do. This is the field the whole thing turns on, and it is
 * deliberately free text, because "email Priya about the referral" is not one
 * of eight options a dropdown could have offered.
 *
 * ## Silence is a fact and gets counted
 *
 * The one derived thing here is how long something has sat in its stage. An
 * application sent five weeks ago with no word is not a feeling, it is
 * thirty-five days, and the app says the number rather than deciding what it
 * means.
 */

import type { CourseId, DatedItem } from './types';

/** What kind of thing is being applied for. */
export type ApplyKind =
  | 'internship'
  | 'job'
  | 'research'
  | 'fellowship'
  | 'grad'
  | 'scholarship'
  | 'program'
  | 'other';

export const KINDS: { id: ApplyKind; label: string }[] = [
  { id: 'internship', label: 'Internship' },
  { id: 'job', label: 'Job' },
  { id: 'research', label: 'Research' },
  { id: 'fellowship', label: 'Fellowship' },
  { id: 'grad', label: 'Grad school' },
  { id: 'scholarship', label: 'Scholarship' },
  { id: 'program', label: 'Programme' },
  { id: 'other', label: 'Something else' },
];

/**
 * Where it has got to.
 *
 * Six, and each one is a thing that either happened or did not. "Maybe" and
 * "promising" are not stages.
 */
export type Stage = 'found' | 'writing' | 'sent' | 'talking' | 'offer' | 'closed';

export const STAGES: { id: Stage; label: string; means: string }[] = [
  { id: 'found', label: 'Found it', means: 'Noted, not started.' },
  { id: 'writing', label: 'Writing it', means: 'The application is being put together.' },
  { id: 'sent', label: 'Sent', means: 'In, and waiting.' },
  { id: 'talking', label: 'Talking', means: 'An interview, a coffee chat, an assessment.' },
  { id: 'offer', label: 'Offer', means: 'Theirs to give, yours to answer.' },
  { id: 'closed', label: 'Closed', means: 'A no, a withdrawal, or a deadline gone.' },
];

/** Stages where a deadline still matters. Nothing is due on a closed one. */
export const LIVE: Stage[] = ['found', 'writing', 'sent', 'talking', 'offer'];

export interface Move {
  stage: Stage;
  /** Epoch ms. */
  at: number;
}

export interface Application {
  id: string;
  /** Who it is with. */
  org: string;
  /** What the post is. */
  role: string;
  kind: ApplyKind;
  /** The posting, so it can be opened again. Never fetched by the app. */
  url: string;
  where: string;
  /** `YYYY-MM-DD`, or empty for rolling and for anything with no stated date. */
  due: string;
  /** Applications open until filled. A real state, and not the same as no date. */
  rolling: boolean;
  stage: Stage;
  /** The one thing you have to do next, in your own words. */
  next: string;
  /** `YYYY-MM-DD` that next thing is wanted by. Empty when there is no date. */
  nextBy: string;
  note: string;
  created: number;
  /** Every stage it has been in, so time-in-stage is a fact and not a guess. */
  moves: Move[];
}

/** After this long with no movement, an application is worth a look. */
export const QUIET_DAYS = 21;

export function newApplication(patch: Partial<Application>, at: number): Application {
  const stage = patch.stage ?? 'found';
  return {
    id: `ap${at}${Math.random().toString(36).slice(2, 7)}`,
    org: (patch.org ?? '').trim(),
    role: (patch.role ?? '').trim(),
    kind: patch.kind ?? 'internship',
    url: (patch.url ?? '').trim(),
    where: (patch.where ?? '').trim(),
    due: patch.due ?? '',
    rolling: patch.rolling ?? false,
    stage,
    next: (patch.next ?? '').trim(),
    nextBy: patch.nextBy ?? '',
    note: patch.note ?? '',
    created: at,
    moves: [{ stage, at }],
  };
}

/**
 * A stage change, recorded rather than overwritten.
 *
 * Overwriting loses the one thing worth knowing later — that this was sent in
 * September and it is now November. Moving to the stage it is already in
 * changes nothing, so tapping the current stage twice does not fake activity.
 */
export function moveTo(a: Application, stage: Stage, at: number): Application {
  if (a.stage === stage) return a;
  return { ...a, stage, moves: [...a.moves, { stage, at }] };
}

/** Days it has sat where it is. */
export function daysInStage(a: Application, now: Date): number {
  const last = a.moves.length > 0 ? a.moves[a.moves.length - 1].at : a.created;
  return Math.max(0, Math.floor((now.getTime() - last) / 86_400_000));
}

/**
 * Sent, and nothing since, for longer than most processes take.
 *
 * Only from `sent`: an application still being written is not quiet, it is
 * unfinished, and a nudge is not what it needs.
 */
export function quiet(a: Application, now: Date): boolean {
  return a.stage === 'sent' && daysInStage(a, now) >= QUIET_DAYS;
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(iso: string, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const then = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((then.getTime() - today.getTime()) / 86_400_000);
}

/** One thing standing on a day, ready for a rail. */
export interface Standing {
  id: string;
  application: Application;
  /** 'due' is the posting's own deadline; 'next' is the thing you set. */
  what: 'due' | 'next';
  date: string;
  daysAway: number;
  /** One line for the row. */
  says: string;
}

/**
 * Everything with a date on it, soonest first.
 *
 * Both kinds of date, because they are different obligations: the posting's
 * deadline is theirs and cannot move, and the next action is yours and can.
 * A closed application has neither.
 */
export function standing(apps: Application[], now: Date): Standing[] {
  const out: Standing[] = [];
  for (const a of apps) {
    if (!LIVE.includes(a.stage)) continue;
    const label = title(a);
    const dueIn = daysBetween(a.due, now);
    if (dueIn !== null) {
      out.push({
        id: `${a.id}:due`,
        application: a,
        what: 'due',
        date: a.due,
        daysAway: dueIn,
        says: `${label} closes`,
      });
    }
    const nextIn = daysBetween(a.nextBy, now);
    if (nextIn !== null && a.next) {
      out.push({
        id: `${a.id}:next`,
        application: a,
        what: 'next',
        date: a.nextBy,
        daysAway: nextIn,
        says: `${a.next} — ${label}`,
      });
    }
  }
  return out.sort((a, b) => a.daysAway - b.daysAway);
}

/**
 * Dated applications in the shape the rest of the app's day arithmetic takes.
 *
 * Not a hack — it is the point. `lib/clash.ts` decides whether a day is going
 * to hurt, and a day with three assignments and a first-round application on
 * it is a harder day than one with three assignments. Until these were the
 * same shape the collision detector could not see half of the Friday.
 *
 * Effort is deliberately left unknowable: `lib/pace.ts` has never timed an
 * application and will not be told a made-up figure, so each of these counts
 * as one of the things a heavy day says it could not weigh. The alternative —
 * calling an application "about two hours" — is a number that is confidently
 * wrong for a résumé tweak and for a fourteen-question written assessment
 * alike.
 *
 * `c` is empty on purpose. Nothing in the app treats an empty course id as a
 * course, so these cannot leak into a grade, a guide or a course page.
 */
export function asItems(apps: Application[], now: Date): DatedItem[] {
  return standing(apps, now).map((s) => {
    const [y, m, d] = s.date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return {
      id: s.id,
      c: '' as CourseId,
      title: s.says,
      kind: s.what === 'due' ? 'Application' : 'Application step',
      month: m - 1,
      day: d,
      year: y,
      // No hour: a careers portal states a day, and inventing 11:59 PM for it
      // would put it in a midnight stack it was never part of.
      dueTime: '',
      dueAt: 24 * 60,
      weight: '',
      where: s.application.where,
      detail: title(s.application),
      quote: '',
      source: 'applications',
      date,
      dueShort: '',
      dow: '',
      mon: '',
      isToday: s.daysAway === 0,
      isPast: s.daysAway < 0,
      daysAway: s.daysAway,
    };
  });
}

/** What is standing on one day. */
export function standingOn(apps: Application[], now: Date, day: Date): Standing[] {
  const iso = isoOf(day);
  return standing(apps, now).filter((s) => s.date === iso);
}

/** What is due in the next `days`, still ahead. */
export function ahead(apps: Application[], now: Date, days: number): Standing[] {
  return standing(apps, now).filter((s) => s.daysAway >= 0 && s.daysAway <= days);
}

/** What has gone by without being moved on. */
export function missed(apps: Application[], now: Date): Standing[] {
  return standing(apps, now).filter((s) => s.daysAway < 0);
}

/** "Summer Analyst at Goldman Sachs", or whichever half was filled in. */
export function title(a: Application): string {
  if (a.role && a.org) return `${a.role} at ${a.org}`;
  return a.role || a.org || 'Untitled application';
}

/** Counts per stage. A count, never a rate — see the header. */
export function counts(apps: Application[]): Record<Stage, number> {
  const out = {} as Record<Stage, number>;
  for (const s of STAGES) out[s.id] = 0;
  for (const a of apps) out[a.stage] += 1;
  return out;
}

/**
 * The headline: what there is, and what it is waiting on.
 *
 * No verdict on how it is going. "Four sent" is something the app knows;
 * "going well" is not.
 */
export function summary(apps: Application[], now: Date): string {
  const live = apps.filter((a) => LIVE.includes(a.stage));
  if (live.length === 0) {
    return apps.length === 0
      ? 'Nothing tracked yet.'
      : `Nothing open. ${apps.length} closed out.`;
  }
  const c = counts(live);
  const bits: string[] = [];
  if (c.writing > 0) bits.push(`${c.writing} being written`);
  if (c.sent > 0) bits.push(`${c.sent} sent`);
  if (c.talking > 0) bits.push(`${c.talking} talking`);
  if (c.offer > 0) bits.push(`${c.offer} with an offer`);
  const quietOnes = live.filter((a) => quiet(a, now)).length;
  const head = bits.length > 0 ? bits.join(', ') : `${live.length} open`;
  return quietOnes > 0
    ? `${head}. ${quietOnes} sent over ${QUIET_DAYS} days ago with no word.`
    : `${head}.`;
}

/**
 * What to say about one row underneath its title.
 *
 * The next action first where there is one, because that is the half somebody
 * can act on. Otherwise the fact that there is not one, which is itself the
 * commonest reason an application stalls.
 */
export function line(a: Application, now: Date): string {
  const bits: string[] = [STAGES.find((s) => s.id === a.stage)?.label ?? a.stage];
  if (a.rolling) bits.push('rolling');
  else if (a.due) {
    const away = daysBetween(a.due, now);
    if (away !== null) {
      bits.push(away < 0 ? 'closed' : away === 0 ? 'closes today' : `closes in ${away} days`);
    }
  }
  if (LIVE.includes(a.stage) && !a.next) bits.push('no next step set');
  if (quiet(a, now)) bits.push(`${daysInStage(a, now)} days, no word`);
  return bits.join(' · ');
}

/**
 * A URL made safe to open, or empty.
 *
 * Same rule as everywhere else in the app: an `http`/`https` link out, and
 * nothing else. A pasted `javascript:` from a careers page is the one way a
 * field like this becomes a problem.
 */
export function safeUrl(url: string): string {
  const s = url.trim();
  if (!s) return '';
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

/** Newest interest first, but anything with an offer above everything. */
export function order(apps: Application[], now: Date): Application[] {
  const rank = (a: Application) => {
    if (a.stage === 'offer') return 0;
    if (a.stage === 'closed') return 3;
    const soon = daysBetween(a.due, now);
    return soon !== null && soon >= 0 ? 1 : 2;
  };
  return [...apps].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    const da = daysBetween(a.due, now);
    const db = daysBetween(b.due, now);
    if (da !== null && db !== null && da !== db) return da - db;
    return b.created - a.created;
  });
}

/** A stored list made safe to render from. */
export function readApplications(raw: unknown): Application[] {
  if (!Array.isArray(raw)) return [];
  const stages = new Set(STAGES.map((s) => s.id));
  const kinds = new Set(KINDS.map((k) => k.id));
  return raw
    .filter((a): a is Application => Boolean(a) && typeof a === 'object')
    .map((a) => ({
      ...a,
      stage: stages.has(a.stage) ? a.stage : 'found',
      kind: kinds.has(a.kind) ? a.kind : 'other',
      moves: Array.isArray(a.moves) ? a.moves.filter((m) => stages.has(m?.stage)) : [],
      // An application with no `moves` at all — from an older build, or a
      // half-written sync — would report zero days in every stage, which reads
      // as "just moved" and is the opposite of the truth.
    }))
    .map((a) => (a.moves.length > 0 ? a : { ...a, moves: [{ stage: a.stage, at: a.created }] }));
}
