/**
 * A question list for office hours, from what the student already kept.
 *
 * The Learning panels hold three things worth walking across campus with: the
 * questions the student marked "I don't understand this", the comments they
 * filed from returned work, and the concepts they marked to review later. What
 * was missing was the step from those to a visit — a short list, in the
 * student's order, that they can read from or hand over.
 *
 * ## What it will not do
 *
 * Nothing is chosen for the student. Every candidate starts unticked, and the
 * agenda contains exactly what was ticked — a private question the student did
 * not choose is not in the text, however many there are. Nothing is sent: the
 * output is text the student copies or saves themselves, so the decision to
 * share is made after seeing what is being shared. It gives no advice about
 * what to say and predicts nothing, which is also why `lib/officehours.ts`
 * (a nudge about *when* to go) and this (a list of *what* to bring) stay apart.
 */

import type { FeedbackItem } from './feedbackloop';
import type { OwnConcept } from './learningmap';

export type Kind = 'question' | 'feedback' | 'review';

export interface Item {
  id: string;
  kind: Kind;
  title: string;
  detail: string;
}

/** What could go on the agenda for one course. All of it optional; none of it pre-selected. */
export function candidates(input: { courseId: string; own: OwnConcept[]; feedback: FeedbackItem[]; review: string[] }): Item[] {
  const out: Item[] = [];
  for (const o of input.own) {
    if (o.courseId !== input.courseId) continue;
    if (o.question) out.push({ id: `q:${o.id}`, kind: 'question', title: o.name, detail: o.note });
    else if (o.label === 'Review later') out.push({ id: `q:${o.id}`, kind: 'question', title: o.name, detail: o.note });
  }
  for (const f of input.feedback) {
    if (f.courseId !== input.courseId) continue;
    out.push({ id: `f:${f.id}`, kind: 'feedback', title: `${f.work} — ${f.category}`, detail: f.comment });
  }
  for (const name of input.review) out.push({ id: `r:${name}`, kind: 'review', title: name, detail: '' });
  return out;
}

const HEADINGS: Record<Kind, string> = {
  question: 'Questions I would like to ask',
  feedback: 'Feedback I would like to talk through',
  review: 'Concepts I am still working on',
};
const ORDER: Kind[] = ['question', 'feedback', 'review'];

/** The agenda as plain text: only the chosen items, the goal and what was already tried, as the student wrote them. */
export function buildAgenda(input: { course: string; goal: string; tried: string; chosen: Item[] }): string {
  const lines = [`Office hours — ${input.course}`, ''];
  if (input.goal.trim()) lines.push(`What I would like from this visit: ${input.goal.trim()}`, '');
  for (const kind of ORDER) {
    const rows = input.chosen.filter((c) => c.kind === kind);
    if (rows.length === 0) continue;
    lines.push(`${HEADINGS[kind]}:`);
    rows.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.title}`);
      if (r.detail.trim()) lines.push(`   ${r.detail.trim().replace(/\n+/g, '\n   ')}`);
    });
    lines.push('');
  }
  if (input.tried.trim()) lines.push('What I have already tried:', input.tried.trim(), '');
  if (input.chosen.length === 0 && !input.goal.trim() && !input.tried.trim()) lines.push('Nothing chosen yet.', '');
  return lines.join('\n').trimEnd() + '\n';
}
