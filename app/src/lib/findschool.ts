/**
 * Finding your university, or saying you would rather not.
 *
 * The app knows one school properly and will never know all of them. That is
 * fine, because of what a school profile actually is: a handful of names, a
 * handful of links, and four or five yes/no answers. Nobody needs a database
 * to fill that in for their own university — they need to be asked in language
 * that means something, and to be let go when they do not care.
 *
 * ## Three ways through, and the third is not a trap
 *
 * 1. **Find it.** Type-ahead over what the app already has.
 * 2. **Add it.** A short form of plain-language questions, every one skippable.
 * 3. **Skip.** Nothing set. This is the honest default and roughly eighty per
 *    cent of the app works exactly as it does for anyone else — see
 *    `lib/school.ts`. Somebody who skips reaches the syllabus importer in
 *    seconds, which is the only thing on this screen that matters to them.
 *
 * The third path is a real path. A setup step that makes skipping look like a
 * mistake is a step that lies about how much it needs the answer.
 *
 * ## Why the questions are worded like this
 *
 * "Meal plan type: SWIPES | DOLLARS | BOTH | NONE" is a database column with a
 * question mark after it. Somebody filling this in has never heard their
 * dining plan described that way, and a form that speaks like a schema gets
 * abandoned or answered wrong, which is worse than blank. So each question is
 * asked the way a student would ask it, and every one of them may be left
 * alone.
 *
 * ## Email domains are a hint, never a gate
 *
 * Signing in from an address at a school the app knows preselects that school.
 * It never restricts anything and never filters the list: plenty of students
 * sign in with a personal address, plenty of people have an address at a
 * school they no longer attend, and refusing somebody their own university
 * over the domain in their email would be the single worst thing this file
 * could do.
 */

import type { Capabilities, School } from './school';

// ── Searching ───────────────────────────────────────────────────────────

function plain(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * How well one school answers a query. Higher is better; 0 is no match.
 *
 * Prefix beats contains beats every-word, because somebody typing "van" wants
 * Vanderbilt first and not every school with "van" buried in a middle word.
 */
export function score(school: School, query: string): number {
  const q = plain(query);
  if (!q) return 0;
  const name = plain(school.name);
  const short = plain(school.shortName ?? '');
  if (name.startsWith(q) || (short && short.startsWith(q))) return 3;
  if (name.includes(q) || short.includes(q)) return 2;
  const words = q.split(' ').filter(Boolean);
  if (words.length > 1 && words.every((w) => name.includes(w))) return 1;
  return 0;
}

/** The schools worth offering for what somebody has typed so far. */
export function search(query: string, all: School[], limit = 8): School[] {
  if (!plain(query)) return all.slice(0, limit);
  return all
    .map((s) => ({ s, n: score(s, query) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || a.s.name.localeCompare(b.s.name))
    .slice(0, limit)
    .map((r) => r.s);
}

/**
 * The school to preselect from an email address, or null.
 *
 * A hint. Never a filter, never a restriction, and the picker stays open on
 * the whole list either way.
 */
export function hintFor(email: string | null | undefined, all: School[]): School | null {
  const at = (email ?? '').trim().toLowerCase().split('@')[1];
  if (!at) return null;
  for (const s of all) {
    for (const d of s.emailDomains ?? []) {
      const dom = d.trim().toLowerCase().replace(/^@/, '');
      if (dom && (at === dom || at.endsWith(`.${dom}`))) return s;
    }
  }
  return null;
}

/**
 * Schools already here that look like what is being typed as a new one.
 *
 * Offered before the form, not after it. Without this you get eleven versions
 * of Ohio State, and the eleventh person's profile is the empty one.
 */
export function nearDuplicates(name: string, all: School[]): School[] {
  const q = plain(name);
  if (q.length < 3) return [];
  return all.filter((s) => {
    const n = plain(s.name);
    const short = plain(s.shortName ?? '');
    return n.includes(q) || q.includes(n) || (short !== '' && (short === q || q.includes(short)));
  });
}

/** An id for a school somebody added, unique against what is already here. */
export function idFor(name: string, all: School[]): string {
  const base = plain(name).replace(/ /g, '-').slice(0, 40) || 'school';
  const taken = new Set(all.map((s) => s.id));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now()}`;
}

// ── The form ────────────────────────────────────────────────────────────

export type Ask =
  | { id: string; kind: 'choice'; ask: string; note?: string; options: { id: string; label: string }[] }
  | { id: string; kind: 'yesno'; ask: string; note?: string }
  | { id: string; kind: 'text'; ask: string; note?: string; placeholder?: string }
  | { id: string; kind: 'url'; ask: string; note?: string; placeholder?: string };

/**
 * What the app needs to know, asked the way somebody would say it.
 *
 * Short on purpose. Every question here switches a screen on or changes a word
 * on one; a question that does neither is a question that should not be asked.
 * All of them are skippable and the answers can be changed later.
 */
export const ASKS: Ask[] = [
  {
    id: 'meals',
    kind: 'choice',
    ask: 'How does eating on campus work?',
    note: 'Turns the meal screen on, and decides what it counts.',
    options: [
      { id: 'swipes', label: 'Meals you swipe for' },
      { id: 'dollars', label: 'Money on a card' },
      { id: 'both', label: 'Both' },
      { id: 'none', label: 'Neither' },
    ],
  },
  {
    id: 'cardName',
    kind: 'text',
    ask: 'What is the money on your student card called?',
    note: 'So the app says it the way your campus does.',
    placeholder: 'Commodore Cash',
  },
  {
    id: 'swipeUnit',
    kind: 'text',
    ask: 'And what do people call one meal?',
    placeholder: 'meal swipes',
  },
  {
    id: 'housing',
    kind: 'yesno',
    ask: 'Do you live somewhere with a move-out date?',
    note: 'Adds the countdown, and the rule your school counts it by.',
  },
  {
    id: 'registrarName',
    kind: 'text',
    ask: 'What do you call the site where you register for classes?',
    placeholder: 'YES',
  },
  { id: 'registrarUrl', kind: 'url', ask: 'And its address?', placeholder: 'https://…' },
  {
    id: 'orgPortalName',
    kind: 'text',
    ask: 'Where do clubs and societies get listed?',
    placeholder: 'Anchor Link',
  },
  { id: 'orgPortalUrl', kind: 'url', ask: 'And its address?', placeholder: 'https://…' },
  {
    id: 'lmsName',
    kind: 'text',
    ask: 'What is your course site called?',
    note: 'Brightspace, Canvas, Blackboard, Moodle. The calendar feed works the same whichever it is.',
    placeholder: 'Brightspace',
  },
  { id: 'lmsUrl', kind: 'url', ask: 'And its address?', placeholder: 'https://…' },
  {
    id: 'campusMap',
    kind: 'yesno',
    ask: 'Is your campus big enough that walking time between classes matters?',
    note: 'Turns on the map and the between-classes screen.',
  },
  { id: 'athleticsName', kind: 'text', ask: 'What are your teams called?', placeholder: 'Commodores' },
];

/** Whether a URL is one the app will store. Only http(s), same as elsewhere. */
function url(v: string | undefined): string | undefined {
  const s = (v ?? '').trim();
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : undefined;
  } catch {
    return undefined;
  }
}

function text(v: string | undefined): string | undefined {
  const s = (v ?? '').trim();
  return s ? s.slice(0, 60) : undefined;
}

/**
 * The answers as capabilities.
 *
 * Everything unanswered stays off. A blank is a blank — it never becomes a
 * default that switches a screen on and then shows an empty one.
 */
export function capabilitiesFrom(answers: Record<string, string>): Capabilities {
  const meals = answers.meals;
  const out: Capabilities = {
    mealPlan: meals === 'swipes' || meals === 'dollars' || meals === 'both' ? meals : 'none',
    housing: answers.housing === 'yes',
    campusMap: answers.campusMap === 'yes',
  };
  const set = (k: keyof Capabilities, v: string | undefined) => {
    if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v;
  };
  set('cardName', text(answers.cardName));
  set('swipeUnit', text(answers.swipeUnit));
  set('registrarName', text(answers.registrarName));
  set('registrarUrl', url(answers.registrarUrl));
  set('orgPortalName', text(answers.orgPortalName));
  set('orgPortalUrl', url(answers.orgPortalUrl));
  set('lmsName', text(answers.lmsName));
  set('lmsUrl', url(answers.lmsUrl));
  set('athleticsName', text(answers.athleticsName));
  return out;
}

/**
 * A school somebody added.
 *
 * Never verified. `verified` is what stops a stranger's typo degrading the
 * profile of a school the app ships with — see `lib/school.ts` — so nothing
 * created here may claim it.
 */
export function schoolFrom(
  name: string,
  answers: Record<string, string>,
  all: School[],
): School | null {
  const n = name.trim().slice(0, 90);
  if (!n) return null;
  return {
    id: idFor(n, all),
    name: n,
    capabilities: capabilitiesFrom(answers),
    data: {},
    verified: false,
  };
}

/** How the skip reads, so it is offered rather than buried. */
export const SKIP_LINE =
  'Skip this. Your courses, deadlines, grades, study guides, papers and calendar do not depend on it, and you can set it any time.';

/** What a school somebody added is, said plainly on the row. */
export const ADDED_LINE = 'Added by you. Only on this device until you sign in.';
