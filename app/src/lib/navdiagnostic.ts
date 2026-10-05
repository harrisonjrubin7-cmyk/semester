/**
 * The Academic Navigation Diagnostic: a guided self-assessment an
 * institution can take in five minutes, on the public site, with nothing
 * stored or sent.
 *
 * Seven questions from the brief — where students get lost, whether they can
 * find official deadlines, tell an estimate from a decision, discover the
 * right office, navigate accessibly, understand a course's AI policy, recover
 * from a failed workflow — each answered on the same four-step scale. The
 * output is what the brief lists: a navigation score, the top friction
 * patterns, a personalised action brief and a maturity level, with an
 * optional route to a workshop or a pilot.
 *
 * Two rules the brief sets, kept in the code rather than the copy:
 *
 * - **It is a guided self-assessment, not an accredited evaluation.** The
 *   `LABEL` is printed with every result, and nothing here is called a
 *   certification, a benchmark against other institutions, or a ranking.
 * - **No invented comparison.** The score is the institution's own answers,
 *   summed. There is no percentile and no "institutions like yours", because
 *   there is no data behind either.
 */

export const LABEL = 'A guided self-assessment from your own answers, not an accredited evaluation or a ranking.';

export interface Question {
  id: string;
  /** The question, asked of the institution. */
  ask: string;
  /** The friction pattern a low answer points at. */
  pattern: string;
  /** What to do about it, in one sentence. */
  action: string;
}

export const QUESTIONS: readonly Question[] = [
  { id: 'lost', ask: 'Can a student say, from one place, what they should do next this week?', pattern: 'Scattered next actions', action: 'Put the week’s official dates, deadlines and the one next step on a single screen a student opens first.' },
  { id: 'deadlines', ask: 'Can a student find the official deadline — add/drop, withdrawal, aid — without asking someone?', pattern: 'Undiscoverable official dates', action: 'Publish each date once, with its owner and its source, where the student already looks.' },
  { id: 'estimates', ask: 'Can a student tell an estimate (a planning tool, a degree-progress guess) from an official decision?', pattern: 'Estimates mistaken for decisions', action: 'Label every estimate as one, say what it rests on, and name the office whose record decides.' },
  { id: 'office', ask: 'Can a student describe a problem in their own words and be sent to the office that owns it?', pattern: 'The wrong door', action: 'Give every office one front door with a plain-language route, and never make the student guess the org chart.' },
  { id: 'access', ask: 'Can a keyboard-only or screen-reader user complete registration, advising prep and a support request?', pattern: 'Inaccessible critical paths', action: 'Test the three critical journeys with assistive technology, fix what stops completion before anything else ships.' },
  { id: 'ai', ask: 'Can a student find, for each course, what AI use is allowed, limited and prohibited?', pattern: 'AI policy ambiguity', action: 'Publish the course’s AI rules beside the course, in the same words everywhere, before any assistant answers.' },
  { id: 'recover', ask: 'When a registration, upload or form fails, can a student undo, retry or get help without opening a ticket?', pattern: 'No recovery path', action: 'Every failure names what happened, what to try, and who to ask; nothing is lost silently.' },
];

/** The four-step scale, the same for every question. */
export const SCALE: readonly { value: 0 | 1 | 2 | 3; label: string }[] = [
  { value: 0, label: 'No, or we do not know' },
  { value: 1, label: 'Sometimes, if they know where to look' },
  { value: 2, label: 'Usually, with help' },
  { value: 3, label: 'Yes, without help, and we have checked' },
];

export type Answers = Partial<Record<string, 0 | 1 | 2 | 3>>;

export interface Maturity {
  level: 'Fragmented' | 'Findable' | 'Navigable' | 'Clear';
  means: string;
}

export const MAX = QUESTIONS.length * 3;

export function maturity(score: number): Maturity {
  const share = score / MAX;
  if (share >= 0.85) return { level: 'Clear', means: 'Students can act without help on every question asked; keep measuring it.' };
  if (share >= 0.6) return { level: 'Navigable', means: 'Most questions are answered without help; the friction patterns below are where the rest is.' };
  if (share >= 0.3) return { level: 'Findable', means: 'The information exists; finding it needs help. The action brief starts with discoverability.' };
  return { level: 'Fragmented', means: 'Students reconstruct their situation from several systems. Start with one place for the week.' };
}

export interface Result {
  score: number;
  max: number;
  answered: number;
  maturity: Maturity;
  /** The friction patterns, lowest answer first; ties in question order. At most three. */
  patterns: Question[];
  /** The action brief: one action per friction pattern, in the same order. */
  brief: string[];
  label: string;
}

export function diagnose(answers: Answers): Result {
  const answered = QUESTIONS.filter((q) => answers[q.id] !== undefined);
  const score = answered.reduce((n, q) => n + (answers[q.id] ?? 0), 0);
  const low = [...answered].sort((a, b) => (answers[a.id] ?? 0) - (answers[b.id] ?? 0) || QUESTIONS.indexOf(a) - QUESTIONS.indexOf(b)).filter((q) => (answers[q.id] ?? 0) < 3).slice(0, 3);
  return {
    score,
    max: MAX,
    answered: answered.length,
    maturity: maturity(answered.length === QUESTIONS.length ? score : (score * QUESTIONS.length) / Math.max(1, answered.length)),
    patterns: low,
    brief: low.map((q) => q.action),
    label: LABEL,
  };
}

/** The result as text the reader copies into their own notes. */
export function briefText(answers: Answers): string {
  const r = diagnose(answers);
  const lines = ['Academic Navigation Diagnostic', `Score: ${r.score} of ${r.max} (${r.answered} of ${QUESTIONS.length} answered)`, `Level: ${r.maturity.level} — ${r.maturity.means}`, '', 'Top friction patterns'];
  lines.push(...(r.patterns.length ? r.patterns.map((q) => `- ${q.pattern}`) : ['- None: every answered question scored the top step.']));
  lines.push('', 'Action brief');
  lines.push(...(r.brief.length ? r.brief.map((a, i) => `${i + 1}. ${a}`) : ['Keep measuring, and publish how.']));
  lines.push('', LABEL);
  return lines.join('\n');
}
