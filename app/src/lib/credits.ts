/**
 * How many credit hours a course is, out of the line the syllabus wrote.
 *
 * The app keeps `credits` as the string it read — "3", "3.0 hrs", "Three (3)",
 * "2026 Spring · 3 credits" — which is right for showing and useless for
 * adding up, and adding up is what a term GPA, a degree audit and a transcript
 * row all do.
 *
 * ## One implementation, because five disagreed
 *
 * This reading lived in `lib/termgpa.ts`, where it was written carefully and
 * commented at length. Four other places read the same field with
 * `parseFloat`, which takes the leading number and stops:
 *
 * | the line | `parseFloat` | this |
 * |---|---|---|
 * | `3 credits` | 3 | 3 |
 * | `Three (3)` | 0 | 3 |
 * | `9:30 TR, 3 credits` | 9 | 3 |
 * | `2026 Spring · 3 credits` | 2026 | 3 |
 *
 * Those readers were the term header ("4 courses · 2026 credits"), the
 * standing headline, the transcript row a closed term writes — which is
 * persisted, and which `lib/degree.ts` then divides a cumulative GPA by — and
 * the sync contract, whose own comment offers "Three (3)" as an example of a
 * line it handles and reads it as none.
 *
 * So it is one function in one file now, and everything that needs a number
 * out of that string asks here.
 *
 * ## Reading rather than parsing
 *
 * A syllabus writes this line freely, so this takes the first number in the
 * string and refuses it if it is not a plausible credit count.
 *
 * Two shapes are struck out before the reading rather than filtered after it,
 * because both survive the plausibility test and mean something else. A year —
 * "Fall 2026" — is four digits and fails the range. A **time** does not: "TR
 * 9:30" reads as nine credit hours, which is a number in range, in the right
 * position, and wrong. Better to leave a course out and say the hours could
 * not be read than to weight a term by a lecture slot.
 */
export function creditHours(credits: string | undefined): number | null {
  const said = (credits ?? '')
    .replace(/\b\d{1,2}:\d{2}\s*[ap]?\.?m?\.?/gi, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ');
  const m = /(\d+(?:\.\d+)?)/.exec(said);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 && n <= 12 ? n : null;
}

/**
 * The same reading, for the callers that want a number and not a silence.
 *
 * Zero is the honest answer for a line that states no credit count, and it is
 * what every one of these callers already did with a `parseFloat` that came
 * back `NaN`. The distinction between "no hours stated" and "zero hours" only
 * matters to `lib/termgpa.ts`, which names the course and asks for the fix.
 */
export function creditHoursOr0(credits: string | undefined): number {
  return creditHours(credits) ?? 0;
}
