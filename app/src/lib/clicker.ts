/**
 * The grade category whose number lives somewhere this app cannot reach.
 *
 * A classroom response system — Top Hat, iClicker, Poll Everywhere — is the
 * instructor's tool, not the student's. It marks attendance and in-class
 * questions, the syllabus gives it a weight, and the score sits behind a login
 * that belongs to the course. None of them has a student-facing export: Top
 * Hat's only integration surface is LTI, which joins it to an institution's
 * LMS, and the others are the same shape. `TOPHAT.md` files the live sync as a
 * thing to earn rather than build, and `MARKET-POSITION.md` records the
 * research agreeing.
 *
 * So the number is the student's to type, and the app's job is to **say so**.
 *
 * ## The category side needs no vocabulary, and must not grow one
 *
 * This file does not parse grading tables and nothing here is used to. That is
 * deliberate and `TOPHAT.md` makes the argument at length: the grading table is
 * asked of the model against a two-string schema, the app's own parsing touches
 * only the weight, and the category *name* is carried verbatim. Which is why
 * "Top Hat participation", "iClicker points" and "Poll Everywhere" all already
 * arrive as categories with no rule written for any of them —
 *
 * > Ship this as a generic "external tool grade category" template, not a Top
 * > Hat-only special case — the same pattern covers iClicker, Poll Everywhere,
 * > or any other clicker system a different course uses, for free.
 *
 * — and teaching the parser these names would be a regression toward the
 * special case that document says not to build.
 *
 * ## The disclosure side needs one, and that is not a contradiction
 *
 * The two halves want opposite things and it is worth being precise about why.
 *
 * The **parser** must recognise nothing, because a name it does not know is a
 * category it would drop. Its correctness is measured by what it lets through.
 *
 * The **disclosure** must name things, because its entire job is to be found.
 * A student staring at a participation mark they cannot square with the app is
 * looking for the word on their screen — `iClicker` — and a row that says
 * "your classroom response tool" answers a question they did not ask in the
 * words they did not use. `screens/settings/About.tsx` shipped a Top Hat row
 * for exactly this reason, and the reason applies identically to the two tools
 * beside it. The list here is therefore short, specific, and deliberately not
 * exhaustive: it names the systems a student is likely to be holding, and the
 * row it feeds says plainly that it covers others too.
 *
 * Getting that backwards in either direction is a real failure. A vocabulary in
 * the parser silently drops a course's categories; no vocabulary in the
 * disclosure silently leaves a student without an answer, which `TOPHAT.md`
 * observes is how the question gets asked again.
 */

/**
 * The classroom response systems this app names when it explains itself.
 *
 * Ordered by how often a Vanderbilt course is likely to use one, which is the
 * order the disclosure row reads them in. Adding to this list is a change to
 * what the app *says*, never to what it *accepts* — see the header.
 */
export const RESPONSE_TOOLS = ['Top Hat', 'iClicker', 'Poll Everywhere'] as const;

export type ResponseTool = (typeof RESPONSE_TOOLS)[number];

/**
 * Which of them a piece of syllabus wording names, if any.
 *
 * Matched case-insensitively and ignoring the space, because a syllabus writes
 * `iClicker`, `i>clicker`, `IClicker` and `i clicker` about equally often and
 * all four are the same tool. Nothing is normalised beyond that: a looser rule
 * — matching `clicker` on its own, say — would claim "clicker questions" is
 * iClicker, which is a guess about a course this app has not read.
 *
 * Used to decide whether a grade category is worth a note on the Grades screen
 * and, in `clicker.test.ts`, to hold the disclosure row to the tools the
 * shipped courses actually mention. **Not** used to decide whether a category
 * is real, which is the distinction the header is about.
 */
export function toolIn(text: string): ResponseTool | null {
  const flat = text.toLowerCase().replace(/[^a-z]/g, '');
  for (const tool of RESPONSE_TOOLS) {
    if (flat.includes(tool.toLowerCase().replace(/[^a-z]/g, ''))) return tool;
  }
  return null;
}

/**
 * What to tell somebody looking at such a category.
 *
 * One sentence, and every clause in it is load-bearing. It names the tool, so
 * the student knows the row is about the thing on their screen. It says the
 * app is not connected, rather than that it is not connected *yet* — there is
 * no route to earn here and implying one is the mistake `TOPHAT.md` opens by
 * quoting. And it says where the weight came from, because the category is
 * real and read from their own syllabus even though the score is not.
 */
export function noteFor(tool: ResponseTool): string {
  return `${tool} keeps this score, and no app can read it — the weight is from your syllabus, the number is yours to enter.`;
}
