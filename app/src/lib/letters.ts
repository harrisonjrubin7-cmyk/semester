/**
 * The people who will write about you, and what you asked them for.
 *
 * Two years from now three letters have to come from somewhere, and the
 * difference between "of course" and "I don't really know you well enough"
 * was decided by a handful of twenty-minute conversations nobody wrote down.
 * It is the highest-cost thing a student can start late and it is completely
 * invisible until it is not — there is no deadline, no reminder, and nothing
 * anywhere in an app to suggest it exists.
 *
 * ## Facts about what happened, never a score
 *
 * There is no "relationship strength", no readiness percentage, and no
 * prediction of whether somebody will say yes. Those would be the app making
 * confident claims about other people's regard for a student from four rows in
 * a database, and being wrong in either direction is worse than silence: a
 * green bar produces complacency and a red one produces an email that should
 * not have been sent.
 *
 * What is here is what was recorded — when you saw them, what you talked
 * about, what you are working on with them — and arithmetic over it: how long
 * you have known them, how many conversations there have been, how much notice
 * a request is giving.
 *
 * ## Notice is a convention, not a rule
 *
 * Three weeks is what most letter-writers ask for and it is not a law; some
 * want a month, some are happy with ten days, and a professor you have worked
 * with for two years is a different case from one whose lecture you attended.
 * So the figure is stated, adjustable, and labelled as a convention wherever
 * it appears.
 */

export interface Person {
  id: string;
  name: string;
  /** "Professor, ECON 1020", "Research supervisor". Free text. */
  role: string;
  /** The course they teach, where the app knows it. Empty otherwise. */
  courseId: string;
  email: string;
  note: string;
  created: number;
}

/** One conversation, recorded because nobody remembers these two years on. */
export interface Visit {
  id: string;
  personId: string;
  /** Epoch ms. */
  at: number;
  /** What was discussed. */
  what: string;
  /** What you are working on with them, if anything. */
  working: string;
}

/** Where a request for a letter has got to. */
export type Ask = 'thinking' | 'asked' | 'agreed' | 'declined' | 'submitted';

export const ASKS: { id: Ask; label: string }[] = [
  { id: 'thinking', label: 'Thinking about it' },
  { id: 'asked', label: 'Asked' },
  { id: 'agreed', label: 'Agreed' },
  { id: 'declined', label: 'Declined' },
  { id: 'submitted', label: 'Submitted' },
];

export interface Letter {
  id: string;
  personId: string;
  /** What it is for — "Truman Scholarship", "State Department internship". */
  forWhat: string;
  /** `YYYY-MM-DD` the letter itself is due. */
  due: string;
  stage: Ask;
  /** `YYYY-MM-DD` you asked. Empty until you have. */
  askedOn: string;
  /** Whether they have your CV, statement and the details. */
  sentMaterials: boolean;
  thanked: boolean;
  note: string;
}

/**
 * The notice most letter-writers ask for, in days.
 *
 * A convention rather than a rule: some want a month, some are happy with ten
 * days, and a professor you have worked with for two years is a different case
 * from one whose lecture you attended. Adjustable, and labelled as a
 * convention wherever it is shown.
 */
export const NOTICE = 21;

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(from: string, to: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const [ay, am, ad] = from.split('-').map(Number);
  const [by, bm, bd] = to.split('-').map(Number);
  const a = new Date(ay, am - 1, ad);
  const b = new Date(by, bm - 1, bd);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Days until the letter is due. Null when no deadline was recorded. */
export function daysLeft(l: Letter, now: Date): number | null {
  return daysBetween(iso(now), l.due);
}

/**
 * How much notice this request gives, counted from the day it was asked — or
 * from today where it has not been asked yet, which is the number that matters
 * while there is still a choice about when to ask.
 */
export function notice(l: Letter, now: Date): number | null {
  return daysBetween(l.askedOn || iso(now), l.due);
}

/** Whether the notice is under the convention. */
export function short(l: Letter, now: Date, want = NOTICE): boolean {
  const n = notice(l, now);
  return n !== null && n < want;
}

/**
 * The one thing to do about this letter next.
 *
 * A next action rather than a status, for the same reason the applications
 * tracker takes that shape: a status is read and a next action is done. Where
 * there is nothing to do it says so rather than inventing a nudge.
 */
export function nextMove(l: Letter, now: Date, want = NOTICE): string {
  const left = daysLeft(l, now);
  const gone = left !== null && left < 0;

  switch (l.stage) {
    case 'thinking':
      if (gone) return 'The deadline has gone.';
      return short(l, now, want)
        ? `Ask now — that leaves ${notice(l, now)} days, under the ${want} most letter-writers ask for.`
        : 'Ask them. Nothing else can happen until you have.';
    case 'asked':
      return gone ? 'The deadline has gone, and there was no answer.' : 'Waiting on an answer.';
    case 'agreed':
      if (!l.sentMaterials) {
        return 'Send them what they need — your CV, the statement, the deadline and the link. A letter written from memory is a weaker letter.';
      }
      if (gone) return 'The deadline has gone. Worth checking it went in.';
      return left !== null && left <= 7
        ? `Due in ${left} ${left === 1 ? 'day' : 'days'}. A short, apologetic nudge is normal at this point.`
        : 'Nothing to do but let them write it.';
    case 'submitted':
      return l.thanked ? 'Done, and thanked.' : 'Thank them. It takes two minutes and it is remembered.';
    case 'declined':
      return 'Someone else, then — and worth asking earlier next time.';
  }
}

/**
 * Letters wanting attention, most urgent first.
 *
 * Urgency is the deadline, not the stage: a submitted-but-unthanked letter is
 * a real outstanding thing and it is not urgent.
 */
export function needing(letters: Letter[], now: Date): Letter[] {
  return letters
    .filter((l) => {
      if (l.stage === 'declined') return false;
      if (l.stage === 'submitted') return !l.thanked;
      if (l.stage === 'agreed' && l.sentMaterials) {
        const left = daysLeft(l, now);
        return left !== null && left <= 7 && left >= 0;
      }
      return true;
    })
    .sort((a, b) => (daysLeft(a, now) ?? 9999) - (daysLeft(b, now) ?? 9999));
}

export interface Known {
  /** Conversations recorded. */
  visits: number;
  /** Days since the first one. Null when there are none. */
  days: number | null;
  /** Epoch ms of the most recent. */
  last: number | null;
}

/**
 * How long you have known somebody, in facts.
 *
 * Counts and dates and nothing else. The temptation here is a score, and a
 * score would be the app making a confident claim about another person's
 * regard for a student out of four database rows — wrong in one direction it
 * produces complacency, wrong in the other it produces an email that should
 * not have been sent.
 */
export function known(visits: Visit[], personId: string, now: Date): Known {
  const mine = visits.filter((v) => v.personId === personId).sort((a, b) => a.at - b.at);
  if (mine.length === 0) return { visits: 0, days: null, last: null };
  return {
    visits: mine.length,
    days: Math.max(0, Math.floor((now.getTime() - mine[0].at) / 86_400_000)),
    last: mine[mine.length - 1].at,
  };
}

/** The line under a person's name. Counts, never a verdict. */
export function knownLine(k: Known, now: Date): string {
  if (k.visits === 0) {
    return 'Nothing recorded yet. One line after each conversation is the whole trick.';
  }
  // Clamped at zero. The store's clock zeroes seconds while a visit is stamped
  // with the real instant, so a conversation recorded a moment ago lands
  // fractionally in the future and floored to "-1 days ago" — which the
  // browser showed and no unit test would have.
  const ago = k.last === null ? 0 : Math.max(0, Math.floor((now.getTime() - k.last) / 86_400_000));
  const lastly = ago === 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`;

  // One conversation has no span to describe, and "over 0 days" is not a
  // sentence anybody writes.
  if (k.visits === 1) return `1 conversation, ${lastly}.`;

  const since =
    k.days === null || k.days === 0
      ? ''
      : k.days < 31
        ? ` over ${k.days} ${k.days === 1 ? 'day' : 'days'}`
        : ` over ${Math.round(k.days / 30)} months`;
  return `${k.visits} conversations${since}, last ${lastly}.`;
}

export function newPerson(patch: Partial<Person>, at: number): Person {
  return {
    id: `p${at}${Math.random().toString(36).slice(2, 7)}`,
    name: (patch.name ?? '').trim(),
    role: (patch.role ?? '').trim(),
    courseId: patch.courseId ?? '',
    email: (patch.email ?? '').trim(),
    note: patch.note ?? '',
    created: at,
  };
}

export function newVisit(patch: Partial<Visit>, at: number): Visit {
  return {
    id: `v${at}${Math.random().toString(36).slice(2, 7)}`,
    personId: patch.personId ?? '',
    at: patch.at ?? at,
    what: (patch.what ?? '').trim(),
    working: (patch.working ?? '').trim(),
  };
}

export function newLetter(patch: Partial<Letter>, at: number): Letter {
  return {
    id: `l${at}${Math.random().toString(36).slice(2, 7)}`,
    personId: patch.personId ?? '',
    forWhat: (patch.forWhat ?? '').trim(),
    due: patch.due ?? '',
    stage: patch.stage ?? 'thinking',
    askedOn: patch.askedOn ?? '',
    sentMaterials: patch.sentMaterials ?? false,
    thanked: patch.thanked ?? false,
    note: patch.note ?? '',
  };
}

/** Stored lists made safe. */
export function readPeople(raw: unknown): Person[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is Person => Boolean(p) && typeof p === 'object' && typeof p.id === 'string',
  );
}

export function readVisits(raw: unknown): Visit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is Visit => Boolean(v) && typeof v === 'object' && typeof v.id === 'string')
    .map((v) => ({ ...v, at: typeof v.at === 'number' ? v.at : 0 }));
}

export function readLetters(raw: unknown): Letter[] {
  if (!Array.isArray(raw)) return [];
  const stages = new Set(ASKS.map((a) => a.id));
  return raw
    .filter((l): l is Letter => Boolean(l) && typeof l === 'object' && typeof l.id === 'string')
    .map((l) => ({
      ...l,
      stage: stages.has(l.stage) ? l.stage : 'thinking',
      sentMaterials: l.sentMaterials === true,
      thanked: l.thanked === true,
    }));
}
