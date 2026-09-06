import type { CourseModule, CourseUpdate, Screen } from './types';

/**
 * What this course is still missing, after everything you have added.
 *
 * The half of importing nobody builds. Every screen in the app shows what is
 * there; this is the only one that says what is not, and the difference
 * matters most in the week before an exam, when "I have imported everything"
 * and "I have material for everything" feel identical and are not.
 *
 * ## It counts, it does not judge
 *
 * Every row here is a fact about the data with an action attached — a unit
 * with no cards, a graded item with nothing linked to it. None of it is about
 * the student. There is no score, no completeness percentage and no
 * encouragement: a bar that says "78% complete" invites filling the bar, and
 * the point is to find the one unit that will be on the exam and has nothing
 * behind it.
 *
 * ## Silent when there is nothing to say
 *
 * A course with no gaps produces no rows, not a row saying there are none.
 */

export type GapKind =
  | 'unit-no-cards'
  | 'graded-no-material'
  | 'topic-missing'
  | 'reading-not-imported';

export interface Gap {
  kind: GapKind;
  /** One line, factual: "Unit 9 · Externalities has no cards." */
  says: string;
  /** What to do about it, and where. */
  action: { label: string; screen: Screen };
  /**
   * How much it matters, for ordering. A graded item with no material outranks
   * a unit with no cards, because one of them has a weight attached.
   */
  rank: number;
}

/** Words that are not a topic — they appear in every syllabus. */
const NOT_A_TOPIC = new Set([
  'introduction', 'overview', 'review', 'conclusion', 'summary', 'exam',
  'midterm', 'final', 'quiz', 'holiday', 'break', 'no class', 'reading',
]);

/**
 * Everything the course holds as one lower-cased haystack.
 *
 * Used to answer "does this topic appear anywhere in the material" — the check
 * behind `topic-missing`, which is the row worth having: a topic named in the
 * syllabus schedule and absent from every unit, card and note is the thing
 * that turns up on an exam having never been studied.
 */
function haystackOf(module: CourseModule, updates: CourseUpdate[]): string {
  const parts: string[] = [];
  for (const u of module.guide.units) {
    parts.push(u.name);
    for (const c of u.cards) parts.push(c.q, c.a);
  }
  for (const t of module.guide.terms) parts.push(t.t, t.d);
  for (const up of updates) {
    parts.push(up.title, up.body);
    for (const c of up.cards) parts.push(c.q, c.a);
    for (const t of up.terms) parts.push(t.t, t.d);
  }
  return parts.join(' ').toLowerCase();
}

/**
 * A topic worth checking for, out of an item's title.
 *
 * A syllabus schedule row is "Week 6 — Externalities and public goods". The
 * week number is not a topic and neither is "week"; what is left is.
 */
function topicOf(title: string): string {
  return title
    .replace(/^\s*(week|session|lecture|unit|class|day)\s*\d+\s*[—–:.-]*\s*/i, '')
    .replace(/^\s*\d+\s*[—–:.-]\s*/, '')
    .trim();
}

/**
 * The specific thing a graded item is about, if it names one.
 *
 * "Group Assignment 1 — ECOALF case" is about ECOALF; "Midterm 1" is about
 * the course. The separator is what tells them apart, and "Read X" is the
 * other shape a named piece of material takes on a schedule.
 *
 * Returns empty for a generic assessment, which is the common case and the
 * one that must produce no row.
 */
export function subjectOf(title: string): string {
  // An em or en dash, or a hyphen with spaces around it. A bare hyphen splits
  // "Midterm case write-up — Opera Philadelphia" inside the word and yields
  // "up — Opera Philadelphia" as the subject.
  const afterDash = /(?:[—–]|\s-\s)\s*([^—–]+)$/.exec(title);
  const read = /^\s*read (?:the\s+)?(.+)$/i.exec(title);
  const rest = (afterDash?.[1] ?? read?.[1] ?? '').trim();
  if (rest.length < 4) return '';
  /*
   * A logistics note is not material.
   *
   * "SONA session 1 — last day of window 1" and "Final exam — 40 MC + 10 short
   * answer" both name something after a dash, and neither names anything to
   * study. A figure in it is the tell: material is called "Opera
   * Philadelphia" or "the wine box case", and a schedule note counts things.
   */
  if (/\d/.test(rest)) return '';
  if (/^(in class|take[- ]home|group|online|due|open|closed)\b/i.test(rest)) return '';
  return rest;
}

export function findGaps(
  module: CourseModule,
  updates: CourseUpdate[],
): Gap[] {
  const mine = updates.filter((u) => u.courseId === module.course.id);
  const gaps: Gap[] = [];
  const haystack = haystackOf(module, mine);

  /*
   * A unit with nothing to study from.
   *
   * Counting cards added since the import as well as the ones the syllabus
   * produced — a unit filled in by a slide deck in week seven is not empty,
   * and saying it is would send somebody to fill it twice.
   */
  for (const [i, unit] of module.guide.units.entries()) {
    const added = mine.filter((u) => u.unit === i).reduce((n, u) => n + u.cards.length, 0);
    if (unit.cards.length + added > 0) continue;
    gaps.push({
      kind: 'unit-no-cards',
      says: `${unit.name} has no cards.`,
      action: { label: 'Add material to it', screen: 'update' },
      rank: 2,
    });
  }

  /*
   * A graded item that names a specific piece of material nobody has imported.
   *
   * The first version of this asked whether the material mentioned the item's
   * title, and flagged every exam on every course: "Midterm 1" will never
   * appear in a card, because the material for a midterm is the units it
   * covers, not its name. Every row it produced was noise, which is how a
   * checklist teaches people to close it.
   *
   * So it only fires where the item names something — "Group Assignment 1 —
   * ECOALF case", "Read the Simply Good Jars case" — and that name appears
   * nowhere. Conservative on purpose: it will miss gaps, and everything it
   * does say is real.
   */
  for (const item of module.items) {
    if (!item.weight.trim()) continue;
    const named = subjectOf(item.title);
    if (!named) continue;
    if (haystack.includes(named.toLowerCase())) continue;
    gaps.push({
      kind: 'graded-no-material',
      says: `${item.title} is worth ${item.weight}, and nothing in your material covers ${named}.`,
      action: { label: 'Add material for it', screen: 'update' },
      rank: 1,
    });
  }

  /*
   * A topic on the schedule that appears nowhere in the material.
   *
   * Undated rows and the ones that are not topics at all — "no class", "review
   * session" — are skipped, because listing them as gaps is how a checklist
   * teaches somebody to ignore it.
   */
  const seen = new Set<string>();
  for (const item of module.items) {
    if (item.weight.trim()) continue; // already covered above
    const topic = topicOf(item.title);
    const key = topic.toLowerCase();
    if (!topic || topic.length < 5 || seen.has(key)) continue;
    if (NOT_A_TOPIC.has(key)) continue;
    if ([...NOT_A_TOPIC].some((w) => key === w || key.startsWith(`${w} `))) continue;
    seen.add(key);
    if (haystack.includes(key)) continue;
    gaps.push({
      kind: 'topic-missing',
      says: `“${topic}” is on the schedule and appears nowhere in your material.`,
      action: { label: 'Add the material', screen: 'update' },
      rank: 3,
    });
  }

  /*
   * A reading named on the schedule that was never imported.
   *
   * Distinguished from a missing topic by the shape of the title: a reading is
   * named after its author or its chapter, and what makes it a gap is that no
   * import ever carried that name.
   */
  const sources = new Set(mine.map((u) => u.source.toLowerCase()));
  for (const item of module.items) {
    const reading = /^(reading|chapter|ch\.?)\s|^\s*[A-Z][a-z]+,\s/.test(item.title);
    if (!reading) continue;
    const named = topicOf(item.title).toLowerCase();
    if (!named) continue;
    if ([...sources].some((s) => s.includes(named) || named.includes(s.replace(/\.\w+$/, '')))) continue;
    if (haystack.includes(named)) continue;
    gaps.push({
      kind: 'reading-not-imported',
      says: `${item.title} is listed and has not been imported.`,
      action: { label: 'Import it', screen: 'update' },
      rank: 4,
    });
  }

  return gaps.sort((a, b) => a.rank - b.rank);
}
