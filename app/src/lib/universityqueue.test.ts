import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The university queue, against the repository it describes.
 *
 * `roadmap.test.ts` exists because `VIDEO_PODCAST_ROADMAP.md` "has been wrong
 * about its own subject at least five times, every one found by building the
 * thing it described rather than by reading it". This document is the same
 * shape of risk and was already wrong three times before it was committed —
 * the first draft said terms were single rather than a list, said the
 * assistant had no campus provider, and said the pack format carried no import
 * date. All three were caught by opening the file rather than by reading the
 * document.
 *
 * So the two things that rot fastest, and that a reader has no way to test:
 * whether a row still says what state it is in, and whether the files it names
 * are still there. A row that drifts to `BUILT` while its evidence has been
 * deleted is the failure this exists for.
 *
 * ## What it does not check
 *
 * Whether a `PARTIAL` is really partial, or whether the ordering is right.
 * The document says in as many words that its `PARTIAL` rows were sampled
 * rather than audited; a test asserting otherwise would be dressing a sample
 * up as a survey, which is the thing the document warns the reader about.
 */

const QUEUE = join('..', 'docs', 'UNIVERSITY_PLATFORM_QUEUE.md');
const text = () => readFileSync(QUEUE, 'utf8');

/** The item rows: `| **118 Title** MARKER | …`. */
function rows(): { item: string; state: string }[] {
  return text()
    .split('\n')
    .filter((line) => /^\| \*\*\d+ /.test(line))
    .map((line) => {
      const m = /^\| \*\*(\d+) ([^*]+)\*\* `?([A-Z]+)`? \|/.exec(line);
      return m ? { item: `${m[1]} ${m[2].trim()}`, state: m[3] } : { item: line, state: '' };
    });
}

const STATES = new Set(['BUILT', 'PARTIAL', 'TODO', 'BLOCKED', 'CUT']);

describe('every item says what state it is in', () => {
  it('finds the rows at all', () => {
    // The control. A regex that matched nothing would pass every assertion
    // below by running none of them, which is the probe failure `CLAUDE.md`
    // names and this repository has shipped before.
    expect(rows().length, 'no item rows found — has the table shape changed?').toBeGreaterThan(30);
  });

  it('and every one carries a state from the documented set', () => {
    const bad = rows().filter((r) => !STATES.has(r.state));
    expect(bad.map((r) => r.item), 'rows with a missing or unknown state').toEqual([]);
  });

  it('and the legend documents every state actually used', () => {
    /*
     * The other direction. A row marked `SHIPPED` would fail the assertion
     * above; a legend that still explains `CUT` when nothing is cut is
     * harmless, but a state in use and absent from the legend is a reader
     * meeting a word the document never defines.
     */
    const legend = text().slice(text().indexOf('## How to read the state column'));
    for (const state of new Set(rows().map((r) => r.state))) {
      expect(legend, `${state} is used in the table and absent from the legend`).toContain(
        `\`${state}\``,
      );
    }
  });

  it('and nothing claims to be built without naming where', () => {
    // `BUILT` is the only state that is a claim about the present tense. The
    // document's own rule for it is "exists and the named file is the
    // evidence", so a `BUILT` row with no path in it is an assertion with
    // nothing behind it.
    const built = text()
      .split('\n')
      .filter((line) => /^\| \*\*\d+ [^*]+\*\* `?BUILT`? \|/.test(line));
    for (const line of built) {
      expect(line, 'a BUILT row names no file').toMatch(/`[\w./-]+\.\w+`/);
    }
  });
});

describe('what it points at exists', () => {
  it('every repository file it links to is a file that is there', () => {
    const root = join(process.cwd(), '..');
    const linked = [...text().matchAll(/\]\((?!https?:)([^)#]+)\)/g)].map((m) => m[1]);
    // Three today, all in the prose rather than the tables — the tables cite
    // paths in backticks, which the assertion below covers. The number is a
    // control against the regex matching nothing, not a quota on links.
    expect(linked.length, 'the document links to no files').toBeGreaterThan(2);
    for (const path of new Set(linked)) {
      // Links are written relative to `docs/`, which is where the file lives.
      expect(existsSync(join(root, 'docs', path)), `${path} is linked but not there`).toBe(true);
    }
  });

  it('and every backticked path in a table cell is a path that exists', () => {
    /*
     * The evidence column, which is the half a reader actually trusts. A row
     * saying `app/src/lib/school.ts` after that file has been renamed is worse
     * than a row saying nothing: it reads as checked.
     *
     * Only paths with a directory separator, so that `BUILT`, `SchoolData` and
     * `TermCalendar[]` — all legitimately backticked — are not mistaken for
     * files.
     */
    const root = join(process.cwd(), '..');
    const cited = new Set(
      [...text().matchAll(/`([\w.-]+(?:\/[\w.-]+)+)`/g)]
        .map((m) => m[1])
        .filter((p) => !p.endsWith('/')),
    );
    expect(cited.size, 'the document cites no paths').toBeGreaterThan(5);
    const missing = [...cited].filter((p) => !existsSync(join(root, p)));
    expect(missing, 'cited in the queue, absent from the repository').toEqual([]);
  });
});
