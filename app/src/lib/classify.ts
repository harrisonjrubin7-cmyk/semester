import { ask } from './claude';
import type { Intake } from './intake';

/**
 * What did the student just hand us?
 *
 * Everything downstream turns on this. A revised syllabus has to become a
 * change list rather than a second copy of the course; a slide deck has to
 * become a unit and cards; an email about a moved deadline has to go to the
 * announcement flow that already knows how to show a date change one at a
 * time. Getting the answer wrong does not produce nothing — it produces the
 * wrong shape of thing, filed where it will be studied.
 *
 * So this is a step of its own, it runs before anything is extracted, and what
 * it decides is shown for confirmation. That is not politeness: the class
 * decides which schema the material is forced into, and a wrong guess is
 * cheapest to correct here, before any of it has been written.
 *
 * ## Cheap first, model second
 *
 * `guess()` reads the shape of the text and is free. It is right about the
 * easy cases — a deck arrives with slide numbers in it, an announcement is
 * four hundred words of email — and it says how sure it is. `classify()` asks
 * the model, and is what runs when the cheap answer is not confident. A screen
 * can use either; nothing here writes anything or costs anything unless
 * `classify` is called.
 */

export type Kind =
  | 'syllabus'
  | 'slides'
  | 'reading'
  | 'problem-set'
  | 'assignment'
  | 'exam'
  | 'returned'
  | 'announcement'
  | 'notes'
  | 'reference'
  | 'unclear';

/** What each class is called on screen, in the app's voice. */
export const KIND_LABEL: Record<Kind, string> = {
  syllabus: 'a revised syllabus',
  slides: 'lecture slides',
  reading: 'a reading',
  'problem-set': 'a problem set',
  assignment: 'an assignment brief',
  exam: 'an exam or a quiz',
  returned: 'work that came back with feedback',
  announcement: 'an announcement or an email',
  notes: 'lecture notes',
  reference: 'reference material',
  unclear: 'something it could not place',
};

export interface Verdict {
  kind: Kind;
  /** 0 to 1. Below `SURE` the screen asks rather than proceeding. */
  confidence: number;
  /**
   * What it is, said the way somebody would say it: "lecture slides for
   * Session 7". This is the sentence the confirmation is built around, so it
   * has to name the specific thing and not the category.
   */
  says: string;
  /** The unit, session or item it names, where it names one. */
  about: string;
  /** Which sentences in the text led here, so a wrong guess can be argued with. */
  because: string[];
}

/**
 * Below this, ask.
 *
 * Set where it is because the cost of the two mistakes is not symmetric. A
 * needless question costs one tap. A confident wrong answer files a problem
 * set as a reading, and the student finds out when they are revising from it.
 */
export const SURE = 0.75;

/** A word that has to stand alone — "exam" must not fire inside "examine". */
const word = (w: string) => new RegExp(`\\b${w}\\b`, 'i');

/**
 * The signals, and what each is worth.
 *
 * Weighted rather than first-match: real material carries several at once, and
 * a problem set that mentions its own syllabus should not become a syllabus on
 * the strength of one word.
 */
const SIGNALS: { kind: Kind; weight: number; test: RegExp }[] = [
  // A deck names its own slides — `extract.ts` puts the numbers in.
  { kind: 'slides', weight: 3, test: /^Slide \d+$/m },
  { kind: 'slides', weight: 1, test: word('lecture \\d+') },
  { kind: 'slides', weight: 1, test: /\bsession \d+\b/i },

  { kind: 'syllabus', weight: 3, test: /\b(course syllabus|syllabus)\b/i },
  { kind: 'syllabus', weight: 2, test: /\b(office hours|grading (policy|breakdown)|course description)\b/i },
  { kind: 'syllabus', weight: 2, test: /\b\d{1,3}\s?%\s*(of (your|the) (grade|final)|midterm|final|participation)/i },
  { kind: 'syllabus', weight: 1, test: /\bacademic (integrity|honesty)\b/i },

  { kind: 'problem-set', weight: 3, test: /\bproblem set\b/i },
  { kind: 'problem-set', weight: 2, test: /^\s*\d+[.)]\s+.{0,40}(calculate|compute|solve|derive|show that)/im },
  { kind: 'problem-set', weight: 1, test: /\b(show your work|round to)\b/i },

  { kind: 'assignment', weight: 3, test: /\b(assignment (brief|sheet)|paper prompt|essay prompt)\b/i },
  { kind: 'assignment', weight: 2, test: /\b(rubric|word count|\d{3,5}\s*words|due (by|on)\b)/i },
  { kind: 'assignment', weight: 1, test: /\b(submit (via|to|through)|turnitin|brightspace dropbox)\b/i },

  /*
   * Naming an exam is not being one. "The midterm has been moved" is an
   * email about an exam, and scoring it as an exam paper pulled a plainly
   * headed email down below the asking threshold — the same error as a
   * problem set that mentions the syllabus. So the name is worth a little and
   * the phrasing of an actual paper is worth a lot.
   */
  { kind: 'exam', weight: 1, test: /\b(midterm|final exam|practice exam|quiz \d+)\b/i },
  { kind: 'exam', weight: 3, test: /\b(closed book|you have \d+ minutes|answer all (that|questions)|do not turn (this|the) page)\b/i },
  { kind: 'exam', weight: 2, test: /\b(multiple choice|circle the (best|correct)|\[\d+ marks?\])/i },

  { kind: 'returned', weight: 3, test: /\b(your (grade|score|mark) (is|was)|marked out of|feedback on your)\b/i },
  { kind: 'returned', weight: 2, test: /\b\d{1,3}\s*\/\s*\d{1,3}\b.*\b(grade|score|marks?)\b/i },
  { kind: 'returned', weight: 2, test: /\b(regrade|remark) (request|window)\b/i },

  // Near-conclusive: a document carrying mail headers is an email, whatever
  // it happens to be about.
  { kind: 'announcement', weight: 5, test: /^(from|to|subject|sent):/im },
  { kind: 'announcement', weight: 2, test: /\b(has been (moved|postponed|pushed)|no class|class is cancell?ed)\b/i },
  { kind: 'announcement', weight: 1, test: /\b(dear (class|students|all)|best regards|kind regards)\b/i },

  { kind: 'reading', weight: 2, test: /\b(abstract|introduction)\b[\s\S]{0,400}\b(conclusion|references|bibliography)\b/i },
  { kind: 'reading', weight: 2, test: /\bchapter \d+\b/i },
  { kind: 'reading', weight: 1, test: /\(\d{4}\)|\bet al\.|\bpp?\.\s*\d+/ },

  { kind: 'notes', weight: 2, test: /^\s*[-*•]\s+/m },
  { kind: 'reference', weight: 2, test: /\b(formula sheet|reference sheet|glossary|cheat sheet)\b/i },
];

/**
 * A first answer from the shape of the text, at no cost.
 *
 * Confidence comes from the margin between the best and the second best, not
 * from the best on its own: material that scores four for slides and four for
 * a reading is genuinely ambiguous however high those numbers are, and that is
 * exactly the case that must be asked about rather than guessed.
 */
export function guess(item: Intake): Verdict {
  const text = item.text;
  const scores = new Map<Kind, number>();
  const because: string[] = [];

  for (const s of SIGNALS) {
    const hit = s.test.exec(text);
    if (!hit) continue;
    scores.set(s.kind, (scores.get(s.kind) ?? 0) + s.weight);
    if (s.weight >= 2) because.push(hit[0].trim().slice(0, 60));
  }

  // The filename says a great deal and costs nothing to read.
  const named = item.name.toLowerCase();
  for (const [re, kind] of [
    [/syllabus/, 'syllabus'],
    [/slide|deck|lecture|session/, 'slides'],
    [/(^|\W)(ps|pset|problem)/, 'problem-set'],
    [/exam|midterm|final|quiz/, 'exam'],
    [/reading|article|chapter/, 'reading'],
    [/notes/, 'notes'],
  ] as [RegExp, Kind][]) {
    if (re.test(named)) scores.set(kind, (scores.get(kind) ?? 0) + 2);
  }

  // Slide numbers in the extracted pages are the strongest signal there is —
  // only a real deck has them, because only a real deck is asked for them.
  if (item.pages && item.pages.length > 2) {
    scores.set('slides', (scores.get('slides') ?? 0) + 4);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) {
    return { kind: 'unclear', confidence: 0, says: '', about: '', because: [] };
  }
  const [kind, top] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  // Two terms: how strong the winner is, and how far clear of the runner-up.
  const strength = Math.min(top / 8, 1);
  const margin = top === 0 ? 0 : (top - second) / top;
  const confidence = Math.round(strength * 0.5 * 100 + margin * 0.5 * 100) / 100;

  return {
    kind,
    confidence,
    says: KIND_LABEL[kind],
    about: sessionIn(text) ?? '',
    because: because.slice(0, 4),
  };
}

/** "Session 7", "Week 3", "Chapter 4" — what a deck calls itself. */
function sessionIn(text: string): string | null {
  const head = text.slice(0, 600);
  const hit = /\b(session|lecture|week|chapter|unit)\s+(\d{1,2})\b/i.exec(head);
  return hit ? `${hit[1][0].toUpperCase()}${hit[1].slice(1).toLowerCase()} ${hit[2]}` : null;
}

/**
 * Ask the model, for the cases the shape does not settle.
 *
 * It is given the course's own unit names, because "is this Session 7 of this
 * course" is a question about this course and not about documents in general —
 * a deck that matches a unit already there is far more likely to be slides
 * than to be a reading that happens to have headings.
 *
 * `unclear` is a real answer and the prompt says so. A classifier with no way
 * to decline picks its best guess out of ten, which is exactly the confident
 * wrong answer this whole step exists to avoid.
 */
export async function classify(
  item: Intake,
  context: string,
  signal?: AbortSignal,
): Promise<Verdict> {
  const reply = await ask({
    signal,
    maxTokens: 700,
    system:
      'You are told what a university student just added to a course, and you say what kind of ' +
      'thing it is. You do not summarise it and you do not extract anything from it.\n\n' +
      'Reply with JSON only: {"kind":"…","confidence":0.0,"says":"…","about":"…","because":["…"]}\n\n' +
      'kind is exactly one of: syllabus, slides, reading, problem-set, assignment, exam, ' +
      'returned, announcement, notes, reference, unclear.\n' +
      '- syllabus: a course outline or a revised one — dates, weights, policies.\n' +
      '- slides: a lecture deck.\n' +
      '- reading: an article, a chapter, a paper.\n' +
      '- problem-set: exercises to work through.\n' +
      '- assignment: a brief for something to hand in.\n' +
      '- exam: an exam, a quiz, or a practice paper.\n' +
      '- returned: work handed back with a mark or feedback on it.\n' +
      '- announcement: an email or a notice, typically changing a date.\n' +
      '- notes: somebody’s notes on a class.\n' +
      '- reference: a formula sheet, a glossary, a table.\n' +
      '- unclear: you genuinely cannot tell. Use it. It is better than a wrong guess, ' +
      'because the answer decides how the material is filed and studied.\n\n' +
      '- confidence: 0 to 1, how sure you are. Be honest and be low when the text is thin.\n' +
      '- says: one short phrase naming the specific thing — "lecture slides for Session 7", ' +
      'not "lecture slides". Plain, direct, no exclamation marks.\n' +
      '- about: the unit, session, week or item it belongs to, if it names one. Empty if not.\n' +
      '- because: up to four short quotes from the text that decided it. Quote, do not ' +
      'paraphrase — somebody is going to check these against the file.',
    messages: [
      {
        role: 'user',
        content:
          `The course:\n${context}\n\n` +
          `The file is called "${item.name}"` +
          (item.pages ? ` and has ${item.pages.length} slides or pages.` : '.') +
          `\n\nWhat it says (the opening, and some of the middle):\n\n${sample(item.text)}`,
      },
    ],
  });

  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end === -1) return guess(item);
  try {
    const p = JSON.parse(reply.slice(start, end + 1)) as Partial<Verdict>;
    const kind = (p.kind && kindOf(p.kind)) || 'unclear';
    return {
      kind,
      confidence: typeof p.confidence === 'number' ? Math.max(0, Math.min(1, p.confidence)) : 0,
      says: typeof p.says === 'string' && p.says.trim() ? p.says.trim() : KIND_LABEL[kind],
      about: typeof p.about === 'string' ? p.about.trim() : '',
      because: Array.isArray(p.because)
        ? p.because.filter((b): b is string => typeof b === 'string').slice(0, 4)
        : [],
    };
  } catch {
    // A reply that did not survive the wire. The free answer is still an
    // answer, and it is better than none.
    return guess(item);
  }
}

/** Only the eleven names. Anything else the model invents becomes `unclear`. */
function kindOf(raw: string): Kind | null {
  const k = raw.trim().toLowerCase().replace(/\s+/g, '-');
  return (k in KIND_LABEL ? (k as Kind) : null);
}

/**
 * Enough of the document to place it, and not the whole thing.
 *
 * Classification does not need the body — it needs the beginning, which is
 * where a document says what it is, and enough of the middle to tell a deck
 * whose first slide is a title from a reading whose first page is one. Sending
 * the whole file to answer a one-word question is what makes a per-file cost
 * that nobody would accept for eleven files at once.
 */
function sample(text: string): string {
  if (text.length <= 6000) return text;
  const mid = Math.floor(text.length / 2);
  return `${text.slice(0, 4000)}\n\n[…]\n\n${text.slice(mid, mid + 2000)}`;
}
