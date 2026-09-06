import { ask } from './claude';
import { flatten } from './cite';
import type { Kind } from './classify';
import { hashOf, type Intake } from './intake';
import type { GradeRow, StudyCard, Term } from './types';

/**
 * Turning what arrived into the shapes the app already has.
 *
 * The rule this file exists to keep is that nothing new is invented — not a
 * new content type, not a new field, not a fact. Every class of material maps
 * onto something the app already stores and already studies from, and where a
 * piece of material genuinely does not fit one of those, it becomes a note
 * against the course and says so. A sixth content type nobody studies from is
 * worse than a note, because it looks like it is doing something.
 *
 * Nothing here writes. It returns a list of proposed pieces, each carrying
 * where it came from, and `merge.ts` decides what to do with them.
 *
 * ## The word-for-word rule, extended
 *
 * The syllabus importer already refuses a quote it cannot find in the source.
 * That guarantee now covers everything: a card, a definition, a unit summary.
 * Any passage presented as the material's own words is checked against the
 * material with `flatten` — the same comparison `cite.ts` makes — and dropped
 * if it is not there. A card can still be the app's own prose; it just cannot
 * be dressed as a quotation it is not.
 */

/** Where a piece came from, kept on the piece for as long as the piece lives. */
export interface Where {
  /** The file, as the student would recognise it: "Session 7 slides.pptx". */
  source: string;
  /** The intake hash, which is what makes re-importing produce nothing. */
  sourceHash: string;
  /** Slide or page, where the format carried one. Never guessed. */
  page?: number;
  /** What the classifier decided, which is why this shape was chosen. */
  as: Kind;
  /** When it was read. */
  at: number;
}

export type Piece =
  | { what: 'card'; unit: string; card: StudyCard; quote?: string; where: Where; hash: string }
  | { what: 'term'; term: Term; quote?: string; where: Where; hash: string }
  | { what: 'unit'; name: string; body: string; where: Where; hash: string }
  | {
      what: 'item';
      title: string;
      kind: string;
      /** 0-based, as `Item.month` is everywhere else in the app. */
      month: number;
      day: number;
      dueTime: string;
      weight: string;
      detail: string;
      quote: string;
      where: Where;
      hash: string;
    }
  | { what: 'grade'; row: GradeRow; quote?: string; where: Where; hash: string }
  | { what: 'note'; title: string; body: string; why: string; where: Where; hash: string };

export interface Harvest {
  pieces: Piece[];
  /** What it made of the material, in a sentence. Shown above the change set. */
  says: string;
  /** Passages it claimed and could not find in the source. Named, not hidden. */
  dropped: string[];
}

/**
 * What each class becomes.
 *
 * The table is the point of the file — it is the contract that a class of
 * material maps to existing state and to nothing else. `notes` and `reference`
 * deliberately produce only a note: neither is material to be drilled, and
 * turning a formula sheet into flashcards produces twenty cards whose answer
 * is a symbol.
 */
const SHAPE: Record<Kind, string> = {
  syllabus: 'dates and weights (items), and the grading table',
  slides: 'a unit, its cards, and its definitions',
  reading: 'a unit, its cards, and its definitions',
  'problem-set': 'an item, and worked examples as cards',
  assignment: 'an item, with its rubric as the detail',
  exam: 'an item, and its questions as cards to practise from',
  returned: 'a note against the course — the mark itself is yours to enter',
  announcement: 'date changes, handled by the announcement screen',
  notes: 'a note against the course',
  reference: 'a note against the course',
  unclear: 'a note against the course, until you say what it is',
};

export function shapeFor(kind: Kind): string {
  return SHAPE[kind];
}

/** What the model is asked to produce, per class. */
function wants(kind: Kind): string {
  switch (kind) {
    case 'syllabus':
      return (
        'Return "items" — every dated obligation — and "grading" — the weight table. Nothing else.\n' +
        '- items: {"title","kind","month","day","dueTime","weight","detail","quote"}. month is ' +
        '0-based (January is 0). quote is the sentence that states it, verbatim.\n' +
        '- grading: [{"what","pct"}] exactly as the table gives it.'
      );
    case 'slides':
    case 'reading':
      return (
        'Return "unit" — one unit this material is — plus "cards" and "terms" from it.\n' +
        '- unit: {"name","body"}. The name is what a student would call this topic. The body is ' +
        'what the material actually covers, in a short paragraph.\n' +
        '- cards: [{"q","a","page","quote"}] — questions an exam could ask, answered in full ' +
        'prose with the specific numbers, names and steps the material gives. Not topic labels. ' +
        'page is the slide or page number it came from, omitted if you cannot tell. quote is a ' +
        'sentence from the material supporting the answer, omitted if there is not one.\n' +
        '- terms: [{"t","d"}] — vocabulary this material defines, with its own definition.'
      );
    case 'problem-set':
    case 'exam':
      return (
        'Return "item" — the thing to hand in or sit — and "cards" made from the questions.\n' +
        '- item: {"title","kind","month","day","dueTime","weight","detail","quote"}, month ' +
        '0-based. Omit item entirely if the material states no date.\n' +
        '- cards: [{"q","a","page","quote"}] — one per question, with the working where the ' +
        'material shows it. Where it gives no answer, say so in the answer rather than solving it.'
      );
    case 'assignment':
      return (
        'Return "item" only: {"title","kind","month","day","dueTime","weight","detail","quote"}. ' +
        'month is 0-based. detail carries the rubric and the word count in the brief\'s own terms. ' +
        'Omit item entirely if no date is stated.'
      );
    case 'announcement':
      return (
        'Return "items" — only the dates this announcement changes or adds, each with the ' +
        'sentence that states it. Nothing that is merely mentioned.'
      );
    default:
      return (
        'Return "note": {"title","body"} — what this is and what it holds, in the material\'s ' +
        'own terms. Do not turn it into cards.'
      );
  }
}

interface RawCard { q?: string; a?: string; page?: number; quote?: string }
interface RawItem {
  title?: string; kind?: string; month?: number | string; day?: number | string;
  dueTime?: string; weight?: string; detail?: string; quote?: string;
}
interface Reply {
  says?: string;
  unit?: { name?: string; body?: string };
  cards?: RawCard[];
  terms?: { t?: string; d?: string }[];
  items?: RawItem[];
  item?: RawItem;
  grading?: { what?: string; pct?: string }[];
  note?: { title?: string; body?: string };
}

/**
 * Read one piece of material into the app's own shapes.
 *
 * `context` is what the course already looks like — its code, its unit names.
 * It is here so a deck lands against the unit it belongs to rather than
 * inventing a parallel one, which is the commonest way an import produces a
 * course with two of everything.
 */
export async function harvest(
  item: Intake,
  kind: Kind,
  context: string,
  signal?: AbortSignal,
): Promise<Harvest> {
  const at = Date.now();
  const base: Omit<Where, 'page'> = { source: item.name, sourceHash: item.hash, as: kind, at };

  const reply = await ask({
    signal,
    think: true,
    maxTokens: 6000,
    system:
      'You read course material a university student has added, and you turn it into the shapes ' +
      'their study app already holds. You do not invent content types and you do not invent ' +
      'facts.\n\n' +
      `This material has been identified as ${kind}. ${wants(kind)}\n\n` +
      'Reply with JSON only, with a "says" field of one sentence saying what you made of it, ' +
      'plus the fields named above and no others.\n\n' +
      'Rules that matter more than completeness:\n' +
      '- Everything comes from the text in front of you. Do not complete a half-stated idea from ' +
      'general knowledge, and leave out anything the material only alludes to.\n' +
      '- Any "quote" must appear word for word in the material. If you cannot quote it exactly, ' +
      'leave the field out. A quote that is not there is worse than no quote, because the app ' +
      'shows it as the source\'s own words.\n' +
      '- Where the material gives a page or slide number, carry it. Never guess one.\n' +
      '- Plain, direct, second person where you address the student. No exclamation marks.',
    messages: [
      {
        role: 'user',
        content: `The course as it stands:\n${context}\n\nThe material — "${item.name}":\n\n${item.text.slice(0, 140_000)}`,
      },
    ],
  });

  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end === -1) return { pieces: [], says: '', dropped: [] };

  let parsed: Reply;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1)) as Reply;
  } catch {
    return { pieces: [], says: '', dropped: [] };
  }

  return assemble(parsed, item, base);
}

/**
 * Turn a parsed reply into pieces, checking every quote on the way.
 *
 * Separate from `harvest` so it can be tested without a model: what is worth
 * pinning down here is the checking and the shaping, not that a stub was
 * called.
 */
export function assemble(parsed: Reply, item: Intake, base: Omit<Where, 'page'>): Harvest {
  const haystack = flatten(item.text);
  const dropped: string[] = [];
  const pieces: Piece[] = [];

  /** A quote survives only if it is really in the material. */
  const checkQuote = (q: string | undefined, why: string): string | undefined => {
    if (!q || !q.trim()) return undefined;
    if (haystack.includes(flatten(q))) return q.trim();
    dropped.push(`${why}: “${q.trim().slice(0, 70)}”`);
    return undefined;
  };

  /** A page number survives only if the material really has that page. */
  const pageOf = (n: unknown): number | undefined => {
    if (typeof n !== 'number' || !Number.isInteger(n)) return undefined;
    return item.pages?.some((p) => p.page === n) ? n : undefined;
  };

  const where = (page?: number): Where => ({ ...base, ...(page ? { page } : {}) });

  const unitName = typeof parsed.unit?.name === 'string' ? parsed.unit.name.trim() : '';
  if (unitName) {
    const body = typeof parsed.unit?.body === 'string' ? parsed.unit.body.trim() : '';
    pieces.push({
      what: 'unit',
      name: unitName,
      body,
      where: where(),
      hash: hashOf(`unit:${unitName}`),
    });
  }

  for (const c of parsed.cards ?? []) {
    if (typeof c?.q !== 'string' || typeof c?.a !== 'string' || !c.q.trim() || !c.a.trim()) continue;
    const card = { q: c.q.trim(), a: c.a.trim() };
    pieces.push({
      what: 'card',
      unit: unitName,
      card,
      ...(checkQuote(c.quote, `a card about "${card.q.slice(0, 40)}"`)
        ? { quote: checkQuote(c.quote, '') }
        : {}),
      where: where(pageOf(c.page)),
      // Hashed on the substance, not on the wording of the question, so the
      // same card arriving twice from two files is one card. See `merge.ts`.
      hash: hashOf(flatten(card.a)),
    });
  }

  for (const t of parsed.terms ?? []) {
    if (typeof t?.t !== 'string' || typeof t?.d !== 'string' || !t.t.trim() || !t.d.trim()) continue;
    pieces.push({
      what: 'term',
      term: { t: t.t.trim(), d: t.d.trim() },
      where: where(),
      hash: hashOf(`term:${flatten(t.t)}`),
    });
  }

  for (const raw of [...(parsed.items ?? []), ...(parsed.item ? [parsed.item] : [])]) {
    const month = Number(raw.month);
    const day = Number(raw.day);
    // The same validation the syllabus importer makes, and for the same
    // reason: a date that is not a date becomes a row that cannot be shown
    // and cannot be corrected.
    if (!Number.isInteger(month) || month < 0 || month > 11) continue;
    if (!Number.isInteger(day) || day < 1 || day > 31) continue;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) continue;
    pieces.push({
      what: 'item',
      title,
      kind: (raw.kind ?? 'Assignment').trim() || 'Assignment',
      month,
      day,
      dueTime: (raw.dueTime ?? '').trim(),
      weight: (raw.weight ?? '').trim(),
      detail: (raw.detail ?? '').trim(),
      quote: checkQuote(raw.quote, `the date for "${title}"`) ?? '',
      where: where(),
      // On what it is and when, not on the wording — a revised syllabus that
      // renames "Midterm" to "Midterm 1" must not read as a new deadline.
      hash: hashOf(`item:${month}-${day}:${flatten(title).slice(0, 24)}`),
    });
  }

  for (const g of parsed.grading ?? []) {
    if (typeof g?.what !== 'string' || typeof g?.pct !== 'string') continue;
    if (!g.what.trim() || !g.pct.trim()) continue;
    const row: GradeRow = { what: g.what.trim(), pct: g.pct.trim() };
    pieces.push({ what: 'grade', row, where: where(), hash: hashOf(`grade:${flatten(row.what)}`) });
  }

  if (parsed.note?.title || parsed.note?.body) {
    const title = (parsed.note.title ?? item.name).trim();
    const body = (parsed.note.body ?? '').trim();
    pieces.push({
      what: 'note',
      title,
      body,
      why: SHAPE[base.as],
      where: where(),
      hash: hashOf(`note:${flatten(title)}`),
    });
  }

  return {
    pieces,
    says: typeof parsed.says === 'string' ? parsed.says.trim() : '',
    dropped,
  };
}
