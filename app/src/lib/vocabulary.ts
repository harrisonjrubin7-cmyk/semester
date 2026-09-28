/**
 * The words Semester owns: nine terms, what each means, and the page each
 * lives on.
 *
 * The brief's rule is to use and repeat the terms the company can own —
 * Student Action Layer, Academic Navigation, No Wrong Door — on product
 * pages, in decks, in demo scripts and in research, so that the vocabulary is
 * recognisable before the product is. A term used once, on one page, is not
 * owned. So each has a home page, and `vocabulary.test.ts` holds that the home
 * page prints the term and that `/platform/vocabulary/` explains every one of
 * them the same way. A term that drifts out of its page fails the build.
 *
 * Definitions are one sentence and say what the thing is, never what it is
 * better than. Nothing here is a claim of a capability — those are the claims
 * register's — and a page may print a term beside a claim, never instead of
 * one.
 */

export interface Term {
  term: string;
  /** One sentence: what it is. */
  means: string;
  /** The page it lives on, which must print it. */
  where: string;
}

export const TERMS: readonly Term[] = [
  { term: 'Student Action Layer', means: 'The layer over a student’s official systems that turns what they say into the next thing to do, with the source of each fact beside it.', where: '/product/' },
  { term: 'Academic Navigation', means: 'Finding the official deadline, the right office and the next step, without claiming any authority the institution holds.', where: '/product/' },
  { term: 'Source-Aware Student Experience', means: 'Every fact, estimate and answer carries its source, its scope and its status, on every screen.', where: '/semester-standard/' },
  { term: 'Governed Campus AI', means: 'An assistant that answers under the school’s policy and the course’s rules, shows what it read, and says what it cannot determine.', where: '/trust/data-and-ai-transparency/' },
  { term: 'No Wrong Door', means: 'Describe the problem in your own words and be sent to the person who owns it, with a summary to take along.', where: '/help/' },
  { term: 'Student Data Agency', means: 'The student decides what is held, who sees it, for how long, and can export or delete it on any plan.', where: '/trust/data-and-ai-transparency/' },
  { term: 'Accessible University OS', means: 'One operating layer for academic life in which every accessibility need is ordinary product quality, not a setting.', where: '/accessibility/' },
  { term: 'Decision Packets', means: 'For a high-value moment — registration, an advising meeting — the options, their requirement and cost impact, the assumptions, and what needs official approval, in one place.', where: '/product/' },
  { term: 'Trust by Design', means: 'Every promise the company makes is a line a test or a register holds, and every gap is disclosed where the promise is.', where: '/semester-standard/' },
];
