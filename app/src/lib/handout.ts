/**
 * Which courses have files built for them offline, and which do not.
 *
 * `pipeline/handout.py` and `pipeline/slides.py` write a .pdf, a .docx and a
 * .pptx per course into `app/public/`. They run on a laptop, against the four
 * sample courses, and they have never run against anything else — a course you
 * upload from a syllabus has no files on that server and never will.
 *
 * The guide's Doc and Slides screens linked to those paths unconditionally, so
 * every imported course got three buttons that opened a 404 with no warning.
 * Nothing in the code said which courses were covered, because nothing had to
 * until the app could import a course at all.
 *
 * This is that list, and `handout.test.ts` reads `app/public/` and fails if it
 * disagrees — so adding a fifth course's files without listing them here, or
 * deleting one and leaving it listed, is caught rather than shipped.
 */

/** Guide ids with a .pdf and .docx under `public/handouts/`. */
export const PREBUILT_DOCS = ['bus', 'core', 'econ', 'psci'];

/** Guide ids with a .pptx under `public/decks/`. */
export const PREBUILT_DECKS = ['bus', 'core', 'econ', 'psci'];

export function hasPrebuiltDocs(id: string): boolean {
  return PREBUILT_DOCS.includes(id);
}

export function hasPrebuiltDeck(id: string): boolean {
  return PREBUILT_DECKS.includes(id);
}
