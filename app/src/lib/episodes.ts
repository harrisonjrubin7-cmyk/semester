/**
 * Which files in `audio/scripts/` are scripts.
 *
 * The directory holds a script and, beside it, everything `audio/synth.py`
 * measured while speaking it: `econ1020.json` is what was said,
 * `econ1020.chapters.json` is where the chapters fell, `econ1020.lines.json`
 * is where each line fell. They are all JSON and they all begin with the same
 * stem, and three separate walks used to tell them apart by naming the one
 * sidecar that existed — `endsWith('.json') && !endsWith('.chapters.json')`.
 *
 * Adding the second sidecar broke one of those walks and put the other two a
 * directory-order coin-flip away from breaking, because `.lines.json` carries
 * the same `id` and `course` fields the walks search on. A list of what to
 * skip has to be edited every time something new is written down; this says
 * what a script looks like instead, so the next sidecar is not a fourth bug.
 */
export function isEpisodeScript(name: string): boolean {
  return /^[^.]+\.json$/.test(name);
}
