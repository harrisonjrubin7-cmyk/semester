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
 * Whether the citations bear out a quote.
 *
 * Containment either way counts. The model may quote one sentence out of a
 * paragraph the API cited, or cite a fragment of a sentence the model quoted
 * in full; both mean the document says it. What does not count is overlap —
 * two strings sharing some words is how a paraphrase passes, which is the
 * exact failure this exists to catch.
 */
export function check(quote: string, citations: Citation[]): Checked {
  const needle = flatten(quote);
  if (needle.length < MIN_LENGTH) return { confirmed: false };

  for (const c of citations) {
    const hay = flatten(c.text);
    if (hay.length < MIN_LENGTH) continue;
    if (hay.includes(needle) || needle.includes(hay)) {
      return { confirmed: true, ...(c.page ? { page: c.page } : {}), source: c.text.trim() };
    }
  }
  return { confirmed: false };
}

/** "Page 4" — or nothing, for a document with no pages. */
export function pageLabel(c: Checked): string {
  return c.confirmed && c.page ? `Page ${c.page}` : '';
}

/**
 * What to say under a quote.
 *
 * A confirmed quote says where it is, because a page number is the thing that
 * makes it checkable. An unconfirmed one says what that means without
 * implying the date is wrong: the model may have summarised a sentence
 * accurately, and the app cannot tell.
 */
export function quoteNote(c: Checked): string {
  if (c.confirmed) {
    return c.page
      ? `Checked against the file — page ${c.page}.`
      : 'Checked against the file.';
  }
  return 'Not found word-for-word in the file. Worth opening the syllabus before you rely on it.';
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
