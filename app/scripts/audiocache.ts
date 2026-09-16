/**
 * Which audio is stale, which is not, and what the difference cost.
 *
 * Two hundred and twelve megabytes of MP3 ship in `app/public/audio`: four
 * podcast editions and forty-four narrated lessons, rendered by
 * `audio/synth.py` and `pipeline/lessons.py` on somebody's machine, by hand,
 * one command at a time. Nothing records what was rendered from what. So the
 * only safe way to pick up a changed card has always been to re-render the
 * course it is in — every unit of it, including the ten nobody touched.
 *
 * Measured on this machine with the shipped voices (`en-us-ryan-high`,
 * `en-us-lessac-medium`): **53.1 ms of wall clock per spoken word**, which is
 * 0.174× realtime. That puts the four courses at **26.4 minutes** to render
 * from nothing — bus 6.8, core 5.6, econ 5.8, psci 8.1 — and it puts a
 * one-card correction in econ at **1.9 minutes**, because `lessons.py econ`
 * speaks all eleven units to fix one of them. The cache below is what makes
 * that second figure ten seconds instead.
 *
 * ## The key is the material and the renderer, together
 *
 * An asset — one unit's MP3, one episode's MP3 — is a function of two things:
 * the words it was made from, and the program that spoke them. Hashing only
 * the words is the version of this that looks right and is wrong: change a
 * gap constant, swap a voice, teach `speakable` to say `³` as "cubed", and
 * every hash in the manifest still matches while every file on disk is now
 * something the renderer would no longer produce.
 *
 * So {@link recipeOf} hashes the renderers' own source, and every asset key is
 * taken over the recipe and the material at once. This is deliberately
 * conservative: a comment added to `pipeline/lessons.py` invalidates all
 * forty-eight assets, because nothing here parses Python well enough to know a
 * comment from a rule, and a cache that guesses wrong in the other direction
 * serves a file that no longer matches its source. The manifest makes the
 * consequence visible — "recipe changed · 48 stale" — rather than quiet.
 *
 * ## Lengths, not separators
 *
 * The material arrives as a list of strings and has to become one. Joining on
 * a separator means picking a character the material cannot contain, and
 * "cannot" is doing more work there than it can carry: a card holding the
 * separator would make two different units hash the same. Each piece is
 * written with its length in front of it instead, which no content can forge.
 *
 * ## An adopted row is not a measured one
 *
 * The forty-eight assets already on disk are correct, and a cache whose first
 * act is to re-render work that was already right is worse than no cache. So
 * the job can **adopt** them: record the key and what is on disk without
 * having rendered it. An adopted row carries `ms: 0`, {@link measured} refuses
 * to count it, and the cost report says how many rows it could not speak for.
 * The alternative — filling `ms` in with the rate above — would put an
 * estimate in the column the whole point of which is that it is measured.
 */

import { hashOf } from '../src/lib/fnv.ts';

/** One rendered file the job is responsible for. */
export interface Asset {
  /** The manifest key, and what a person reads in the plan: `econ/unit-3`. */
  id: string;
  /** Which course it belongs to, for the per-course cost report. */
  course: string;
  kind: 'lesson' | 'episode';
  /**
   * Everything the audio is a function of, in the order it is spoken.
   *
   * A unit's name and its cards; an episode's lines and the voices that say
   * them. Not the file path, not the title shown on the card — those change
   * what the app draws and not what the speaker says.
   */
  material: string[];
  /** Where the bytes land, from the repository root. */
  file: string;
}

/** What one asset cost, as the manifest keeps it. */
export interface Made {
  key: string;
  /** When it was rendered, ms since the epoch. */
  at: number;
  /**
   * Wall clock spent rendering it, measured. Zero means adopted — the file was
   * already on disk and this job did not make it.
   */
  ms: number;
  /** The audio's own length. */
  seconds: number;
  bytes: number;
}

export interface Manifest {
  /**
   * The recipe each kind of asset was rendered under, by kind.
   *
   * Per kind rather than one for the repository: `pipeline/lessons.py` cannot
   * change what `audio/synth.py` does to a podcast script, and a lesson rule
   * that invalidated the four episodes would cost eighty minutes of rendering
   * to no purpose.
   */
  recipes: Record<string, string>;
  made: Record<string, Made>;
}

export const EMPTY: Manifest = { recipes: {}, made: {} };

/**
 * One string from many, where no piece can be mistaken for two.
 *
 * Length-prefixed rather than joined: see the header. `['ab', 'c']` and
 * `['a', 'bc']` are different material and hash differently, and so do
 * `['a\u0000b']` and `['a', 'b']`, which is the pair a separator loses.
 */
export function joined(parts: string[]): string {
  return parts.map((p) => `${p.length}:${p}`).join('');
}

/**
 * The hash of the program that speaks, not of what it says.
 *
 * Takes the renderers' own source, which is where every rule about how a
 * sentence comes out already lives — the gaps, the normalisation, the bitrate,
 * and for a lesson the voice, which `pipeline/lessons.py` names in a literal.
 * An episode's two voices are named in its script instead, so they arrive as
 * material. That is why this takes source and nothing else: a voice list
 * beside it would be a second place for the same fact, and the one that was
 * not updated would be the one believed.
 */
export function recipeOf(sources: string[]): string {
  return hashOf(joined(sources));
}

/** What this asset would be, rendered under this recipe. */
export function keyOf(recipe: string, material: string[]): string {
  return hashOf(`${recipe}|${joined(material)}`);
}

/**
 * The lesson assets one course's guide implies, numbered as they are rendered.
 *
 * A unit with no cards is not a lesson — `pipeline/lessons.py` drops it before
 * it numbers anything, so the units after it move up. That rule has never
 * fired: all forty-four units of the four shipped courses have cards. It is
 * here, and tested on material that does, because the day a guide gains an
 * empty unit is the day `unit-7.mp3` quietly becomes unit eight, and the two
 * sides have to be wrong in the same way or not at all.
 */
export function lessonAssets(
  course: string,
  code: string,
  units: { name: string; cards: { q: string; a: string }[] }[],
): Asset[] {
  return units
    .filter((u) => u.cards.length > 0)
    .map((unit, i) => ({
      id: `${course}/unit-${i}`,
      course,
      kind: 'lesson' as const,
      material: [code, unit.name, ...unit.cards.flatMap((c) => [c.q, c.a])],
      file: `app/public/audio/lessons/${course}/unit-${i}.mp3`,
    }));
}

/**
 * The audio in a directory that no asset accounts for.
 *
 * The four older single-narrator editions have no script in this repository,
 * so nothing can rebuild them and nothing can say what they were made from.
 * They are named rather than adopted: a manifest row is a claim to know, and
 * one written for a file nobody can rebuild is the wrong kind of complete.
 */
export function orphans(files: string[], assets: Asset[]): string[] {
  return files.filter((f) => f.endsWith('.mp3') && !assets.some((a) => a.file.endsWith(`/${f}`)));
}

export interface Plan {
  /** No row, or a row under a different key. */
  render: Asset[];
  /** On disk and still what its material says. */
  reuse: Asset[];
  /** Rows for assets nobody asks for any more. */
  sweep: string[];
  /** The kinds whose recipe moved under the manifest, which stales each one. */
  recipeChanged: string[];
}

/**
 * What to render and what to leave alone.
 *
 * The comparison is the key and only the key. Not the file's timestamp — a
 * checkout writes all of them at once and a rebuild would then re-render the
 * repository. Not its presence either, on its own: a file that is there and
 * was made from material that has since changed is exactly the case this
 * exists to catch, and it looks identical to a fresh one from outside.
 */
export function plan(wanted: Asset[], manifest: Manifest, recipes: Record<string, string>): Plan {
  const render: Asset[] = [];
  const reuse: Asset[] = [];

  for (const asset of wanted) {
    const row = manifest.made[asset.id];
    const recipe = recipes[asset.kind] ?? '';
    if (row && row.key === keyOf(recipe, asset.material)) reuse.push(asset);
    else render.push(asset);
  }

  const asked = new Set(wanted.map((a) => a.id));
  return {
    render,
    reuse,
    sweep: Object.keys(manifest.made).filter((id) => !asked.has(id)),
    recipeChanged: Object.keys(recipes).filter(
      (kind) => manifest.recipes[kind] !== undefined && manifest.recipes[kind] !== recipes[kind],
    ),
  };
}

/** The rows a run produced, folded into the manifest it started from. */
export function after(
  manifest: Manifest,
  recipes: Record<string, string>,
  made: Record<string, Made>,
  sweep: string[] = [],
): Manifest {
  const rows: Record<string, Made> = { ...manifest.made };
  for (const id of sweep) delete rows[id];
  for (const [id, row] of Object.entries(made)) rows[id] = row;
  // Sorted, because this file is committed and a manifest whose rows move
  // around produces a diff nobody can read.
  const ordered: Record<string, Made> = {};
  for (const id of Object.keys(rows).sort()) ordered[id] = rows[id];
  return { recipes: { ...manifest.recipes, ...recipes }, made: ordered };
}

/** The rows this job actually timed, which are the only ones it can cost. */
export function measured(rows: Made[]): Made[] {
  return rows.filter((r) => r.ms > 0);
}

export interface Cost {
  course: string;
  assets: number;
  /** Rows with a measured render behind them. The rest were adopted. */
  timed: number;
  ms: number;
  seconds: number;
  bytes: number;
}

/**
 * What each course's audio cost, from the rows that were timed.
 *
 * `assets` counts everything the course has; `timed` counts what this
 * repository has ever measured. They differ, and the report says both, so a
 * course whose figure rests on one unit out of fourteen cannot be read as one
 * that was measured end to end.
 */
export function perCourse(manifest: Manifest, courseOf: (id: string) => string): Cost[] {
  const out = new Map<string, Cost>();
  for (const [id, row] of Object.entries(manifest.made)) {
    const course = courseOf(id);
    const c = out.get(course) ?? { course, assets: 0, timed: 0, ms: 0, seconds: 0, bytes: 0 };
    c.assets += 1;
    c.seconds += row.seconds;
    c.bytes += row.bytes;
    if (row.ms > 0) {
      c.timed += 1;
      c.ms += row.ms;
    }
    out.set(course, c);
  }
  return [...out.values()].sort((a, b) => a.course.localeCompare(b.course));
}

/**
 * What not re-rendering the reused assets saved, where that is known.
 *
 * Only from measured rows, and `known` says how many of the reused assets had
 * one. A saving of forty minutes drawn from two timed rows out of forty-six is
 * an extrapolation, and this returns the parts rather than the extrapolation
 * so the caller has to say which it is printing.
 */
export function saved(p: Plan, manifest: Manifest): { ms: number; known: number; of: number } {
  let ms = 0;
  let known = 0;
  for (const asset of p.reuse) {
    const row = manifest.made[asset.id];
    if (row && row.ms > 0) {
      ms += row.ms;
      known += 1;
    }
  }
  return { ms, known, of: p.reuse.length };
}

/** `1.9 min`, `12.4s`, `340ms` — a duration said at the size it is. */
export function saidMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 90_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}
