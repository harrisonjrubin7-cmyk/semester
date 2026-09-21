import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The roadmap, against the repository it describes.
 *
 * `readme.test.ts` exists because four counts on the app's front page had
 * drifted, and it says why that matters better than this can: "the app telling
 * a new reader something untrue about itself on its first page, which is the
 * kind of error that survives for years because nothing is wrong when you run
 * it."
 *
 * `docs/VIDEO_PODCAST_ROADMAP.md` is five hundred lines of exactly that risk
 * and had no guard at all. It has been wrong about its own subject at least
 * five times, every one found by building the thing it described rather than
 * by reading it: captions called impossible on data that already existed, a
 * `--style` flag that was the hole in its own likeness rule, a B-roll prompt
 * specified as the chapter's name, a preset attached to an audio track that
 * does not exist, and a whole format specified in §3 and scheduled in no step.
 *
 * This checks the two things that rot fastest and that a reader has no way to
 * test: whether a format row still says what state it is in, and whether the
 * files it names are still there.
 */

const ROADMAP = join('..', 'docs', 'VIDEO_PODCAST_ROADMAP.md');
const text = readFileSync(ROADMAP, 'utf8');

describe('every format says what state it is in', () => {
  /*
   * §3's table only, not every table in the file.
   *
   * §4's archetypes are a description of six hosting formats rather than a
   * list of things to build — its columns are what makes each one work and
   * what it is for here — and all six have presets regardless. A guard that
   * demanded a build marker there would be demanding a column that table does
   * not have.
   */
  const formats = text.slice(
    text.indexOf('## 3. Visual formats'),
    text.indexOf('## 4.'),
  );

  /** The rows of that table: `| **Name** marker | … |`. */
  const rows = formats
    .split('\n')
    .filter((line) => /^\| \*\*/.test(line))
    .map((line) => line.match(/^\| \*\*(.+?)\*\*([^|]*)\|/)!)
    .filter(Boolean)
    .map((m) => ({ name: m[1], after: m[2].trim() }));

  it('finds the table at all, so this rule has something to hold', () => {
    // Guards the guard: a table reformatted into a list would make every
    // assertion below vacuously true.
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  it('marks each one built, or built as far as it can be', () => {
    /*
     * The drift this catches, and it had already happened: "Movie-format
     * lesson" and "Animated series" carried no marker for weeks after both
     * were built and merged, because the rollout order in §6 was updated each
     * time and the table in §3 was not. Two places saying the state of one
     * thing is one place too many; this makes the quiet one loud.
     */
    for (const row of rows) {
      expect(row.after, `"${row.name}" has no ✅ or ◐`).toMatch(/[✅◐✗]/);
    }
  });
});

describe('the files it names', () => {
  /*
   * Every `pipeline/x`, `video/x` or `audio/x` in backticks. A document that
   * names a script by the wrong path sends a reader to a missing file, and
   * renaming a script is exactly when nobody thinks to grep the docs — the
   * B-roll work moved pricing out of `render-documentary.mjs` and into a new
   * tool, and three files' worth of prose had to move with it.
   */
  const named = [...text.matchAll(/`((?:pipeline|video|audio|app)\/[A-Za-z0-9_./-]+)`/g)]
    .map((m) => m[1])
    .filter((path) => /\.(mjs|py|ts|tsx|json|md|mts)$/.test(path))
    // Paths with a placeholder segment are patterns, not files.
    .filter((path) => !path.includes('<') && !path.includes('*'));

  it('names some, so this rule has something to hold', () => {
    expect(new Set(named).size).toBeGreaterThan(10);
  });

  it('names only files that are there', () => {
    const missing = [...new Set(named)].filter((path) => !existsSync(join('..', path)));
    expect(missing).toEqual([]);
  });
});

describe('what it says is still waiting', () => {
  /*
   * The table itself, not the whole file.
   *
   * The first version of this searched the document for each phrase and
   * passed when a row was deleted outright — "expressive" appears four times
   * in §6.3's prose, so removing the row that says an expressive voice is
   * what `hype-reaction` waits on changed nothing. A guard satisfied by a
   * word appearing somewhere is a guard about vocabulary.
   */
  const stands = text.slice(text.indexOf('## Where this stands'), text.indexOf('## 1.'));

  it('lists what is blocked, and on what', () => {
    /*
     * The top of the document promises that everything left is a decision or
     * a credential rather than work. If a provider gets wired, this is the
     * line that has to change with it — and the person wiring it is the one
     * least likely to reread the first screen of a five-hundred-line file.
     */
    for (const waiting of ['per-second price', 'per-image price', 'expressive', 'ANTHROPIC_API_KEY']) {
      expect(stands, `the "waiting on" table no longer mentions ${waiting}`).toContain(waiting);
    }
    // Four rows, so a row removed is caught even if its words survive above.
    expect(stands.split('\n').filter((l) => /^\| .* \| .* \|$/.test(l))).toHaveLength(6);
  });

  it('still says the restyle pass has never been run', () => {
    // The one claim in here that only a person can retire.
    expect(text).toMatch(/never been run live|has not been run/);
  });
});
