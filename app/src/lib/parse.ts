/**
 * Turn pasted course material into study cards.
 *
 * The rule this follows: recognise the shapes people actually paste, and do not
 * invent the rest. Anything that does not clearly split into a question and an
 * answer is kept as prose and shown as prose — a fabricated card is worse than
 * no card, because it gets drilled and believed.
 *
 * Four shapes are recognised, in order:
 *
 *     Q: What is elasticity?        →  card
 *     A: The percentage change …
 *
 *     What is elasticity?           →  card (a line ending in ? with a body
 *     The percentage change …          under it)
 *
 *     Elasticity — the percentage change …   →  card (term and definition,
 *     Elasticity: the percentage change …      em dash, hyphen or colon)
 *
 *     Anything else                 →  prose, kept whole
 */

import type { StudyCard, Term } from './types';

export interface Parsed {
  cards: StudyCard[];
  terms: Term[];
  /** What did not parse, kept verbatim. */
  body: string;
}

/** A line that is a heading rather than content — "Week 7", "Chapter 3". */
function isHeading(line: string): boolean {
  return (
    line.length < 60 &&
    !line.endsWith('.') &&
    /^(week|unit|chapter|ch\.|reading|lecture|part|section|module|topic)\b/i.test(line)
  );
}

function clean(s: string): string {
  return s
    .replace(/^[-•*\u2013\u2014\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseMaterial(text: string): Parsed {
  const cards: StudyCard[] = [];
  const terms: Term[] = [];
  const leftovers: string[] = [];

  // Blank lines separate one thing from the next, which is how notes are
  // written and how a pasted table of terms comes out of a PDF.
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Q:/A: pairs, possibly several in one block.
    const qa = block.match(/(?:^|\n)\s*Q[:.)]\s*([\s\S]*?)\n\s*A[:.)]\s*([\s\S]*?)(?=\n\s*Q[:.)]|$)/gi);
    if (qa && qa.length > 0) {
      for (const chunk of qa) {
        const m = chunk.match(/Q[:.)]\s*([\s\S]*?)\n\s*A[:.)]\s*([\s\S]*)/i);
        if (m) cards.push({ q: clean(m[1]), a: clean(m[2]) });
      }
      continue;
    }

    // A question on its own line with the answer underneath.
    if (lines[0].endsWith('?') && lines.length > 1) {
      cards.push({ q: clean(lines[0]), a: clean(lines.slice(1).join(' ')) });
      continue;
    }

    // A run of "term — definition" lines. One line of prose is not a term, so
    // the definition has to be long enough to be one.
    let matched = 0;
    for (const line of lines) {
      if (isHeading(line)) continue;
      const m = clean(line).match(/^(.{2,60}?)\s*(?:\u2014|\u2013|:|\s-\s)\s*(.{15,})$/);
      if (m && !m[1].endsWith('?')) {
        terms.push({ t: m[1].trim(), d: m[2].trim() });
        matched += 1;
      }
    }
    if (matched > 0 && matched >= lines.filter((l) => !isHeading(l)).length - 1) continue;
    if (matched > 0) terms.splice(terms.length - matched, matched);

    leftovers.push(block);
  }

  return { cards, terms, body: leftovers.join('\n\n').trim() };
}

/** What the Add-material screen shows before you save. */
export function describeParse(p: Parsed): string {
  const bits: string[] = [];
  if (p.cards.length) bits.push(`${p.cards.length} ${p.cards.length === 1 ? 'card' : 'cards'}`);
  if (p.terms.length) bits.push(`${p.terms.length} ${p.terms.length === 1 ? 'term' : 'terms'}`);
  if (p.body) bits.push(`${p.body.split(/\s+/).length} words of notes`);
  if (bits.length === 0) return 'Nothing yet.';
  return bits.join(' · ');
}
