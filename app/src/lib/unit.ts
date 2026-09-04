/**
 * Unit names, without the numbering that only makes sense inside one course.
 *
 * Guides name their units `0 · How to actually pass this class`, `3/4 · Market
 * failure`. The number is real and belongs on the guide, where it says where
 * you are in that course. It stops meaning anything the moment courses are
 * shown side by side — every course has a unit 0 — and reading
 * `ECON 1020 · 0 · How to actually pass this class` costs a beat to parse for
 * a number that is not telling you anything.
 *
 * So anywhere a unit is named next to its course, the number comes off. It is
 * stripped, never renumbered: inventing a global unit order across four
 * unrelated courses would be worse than dropping it.
 */

/** A unit's name with any leading `3 ·` or `3/4 ·` removed. */
export function unitName(name: string): string {
  return name.replace(/^\s*\d+(\/\d+)?\s*·\s*/, '');
}
