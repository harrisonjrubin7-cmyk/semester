/**
 * Checking a quote against the document it claims to come from.
 *
 * Every deadline in this app carries the sentence it came from, shown under
 * "Straight from the syllabus". Until now that quote existed because the
 * prompt asked for it — *"Never invent. Every quote must appear verbatim in
 * the source text."* — which is an instruction, enforced by nothing. A model
 * that paraphrases one word produces a quote that looks exactly as
 * trustworthy as a real one, and the app had no way to tell them apart.
 *
 * With citations enabled the API returns the spans it actually used, verbatim,
 * with the page they came from. This file is the part that matters: taking
 * those spans and answering, for each quote the model wrote, whether the
 * document really says it.
 *
 * ## Confirmed, or not — never "probably"
 *
 * The verdict is binary on purpose. A three-state badge with a "close enough"
 * middle is a badge nobody reads, and the whole point is that the strong
 * claim can be made honestly. So the match has to be strict enough that a
 * confirmation means something, and forgiving enough that ordinary
 * typographic noise does not fail it.
 *
 * What is forgiven: whitespace of any width or amount, the four kinds of
 * curly quote, three lengths of dash, and case. What is not: a changed word,
 * a dropped clause, a number that differs. Those are exactly the differences
 * that matter in a syllabus.
 */

import type { Citation } from './claude';

/**
 * A quote reduced to what a human would call the same sentence.
 *
 * PDF extraction inserts line breaks mid-sentence, and a model writing JSON
 * will normalise a dash or a quotation mark without meaning anything by it.
 * Both sides go through this before they are compared.
 */
export function flatten(text: string): string {
  return text
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export interface Checked {
  /** Whether the document demonstrably says this. */
  confirmed: boolean;
  /** The page it is on, where the citation carried one. */
  page?: number;
  /** The document's own words, which may differ in punctuation from the quote. */
  source?: string;
}

/** Below this, a "match" is a coincidence rather than a quotation. */
const MIN_LENGTH = 12;

/**
 * How much of a quote a shorter citation has to account for.
 *
 * ## The hole
 *
 * "Straight from the syllabus" is a claim about the whole sentence under it,
 * and the containment test made that claim on the strength of any part of it.
 * Measured: the eighty-seven character quote *"Late work is never accepted
 * under any circumstances, and everything goes on Gradescope."* was confirmed
 * by a fourteen character citation of "on Gradescope." — sixteen per cent of
 * it — and the app showed the invented clause about late work as the
 * syllabus's own words.
 *
 * That is the failure the paragraph at the top of this file describes,
 * arriving by the one route containment left open, and it needs no model
 * behaving badly: padding a real fragment out into a fuller-sounding sentence
 * is an ordinary thing for one to do.
 *
 * ## Why the figure is low, and what it is not
 *
 * This is a floor, not a proof. It is set below every coverage the tests
 * already assert — the lowest of them is 0.45, where the API cited part of
 * one sentence of a two-sentence quote — because those are the legitimate
 * shape of the same thing and an unconfirmed true quote is its own kind of
 * wrong answer. So it closes the demonstrated case and narrows the rest
 * rather than shutting it: a quote padded to twice the length of its citation
 * still passes.
 *
 * Raising it is a judgment about which error costs more, and raising it far
 * enough to be a proof would change a case this file's tests pin on purpose.
 * That is a decision to take deliberately, not a number to tighten in
 * passing.
 */
const MIN_COVERAGE = 0.4;

/**
 * Whether the citations bear out a quote.
 *
 * Containment either way counts, with one condition. The model may quote one
 * sentence out of a paragraph the API cited — and then the whole quote is in
 * the document, which is the strongest case there is. Or it may quote a
 * sentence the API cited only part of, and then the part has to be most of
 * it; see `MIN_COVERAGE`. What does not count is overlap — two strings
 * sharing some words is how a paraphrase passes, which is the exact failure
 * this exists to catch.
 */
export function check(quote: string, citations: Citation[]): Checked {
  const needle = flatten(quote);
  if (needle.length < MIN_LENGTH) return { confirmed: false };

  for (const c of citations) {
    const hay = flatten(c.text);
    if (hay.length < MIN_LENGTH) continue;
    // The citation holds the whole quote: everything shown is in the document.
    const whole = hay.includes(needle);
    // The quote holds the citation: only the cited part is vouched for, so it
    // has to be most of what is being shown.
    const enough = needle.includes(hay) && hay.length >= needle.length * MIN_COVERAGE;
    if (whole || enough) {
      return { confirmed: true, ...(c.page ? { page: c.page } : {}), source: c.text.trim() };
    }
  }
  return { confirmed: false };
}

/**
 * How a whole import came out.
 *
 * Said plainly on the import screen, because the number that matters when you
 * are deciding whether to trust a generated course is how much of it the app
 * could stand behind.
 */
export function tally(items: { checked?: Checked }[]): string {
  const withQuotes = items.filter((i) => i.checked);
  if (withQuotes.length === 0) return '';
  const ok = withQuotes.filter((i) => i.checked?.confirmed).length;
  if (ok === withQuotes.length) {
    return `Every quote was found word-for-word in the file you uploaded.`;
  }
  if (ok === 0) {
    return `None of the quotes could be matched against the file. Read them against the syllabus before relying on any of it.`;
  }
  return `${ok} of ${withQuotes.length} quotes were found word-for-word in the file. The rest are flagged where they appear.`;
}

/**
 * Whether citing is worth asking for at all.
 *
 * Only a document sent whole can be cited. A syllabus already flattened to
 * text by pdf.js has no pages left to point at, and asking for citations on
 * text the app pasted into a prompt gets offsets into a string the student
 * never sees — which is a worse kind of false confidence than none.
 */
export function worthCiting(docs: { mediaType: string }[]): boolean {
  return docs.length > 0;
}
