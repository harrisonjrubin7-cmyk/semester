import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Nothing is keyed off a field that is only drawn.
 *
 * React's warning for two children with the same key ends "may cause children
 * to be duplicated and/or omitted", and omitted is the half that matters: a
 * unit missing from a guide, a grading row missing from a course, a class
 * missing from a day, with nothing on screen to say so.
 *
 * `lib/brief.ts` already learnt this — its own tests carry the case of two
 * courses whose syllabi both call a class "Lecture" at nine — and the screens
 * had not. Found by driving the app against a state where every list holds two
 * entries alike in everything but their id: a course taken twice under one
 * code, a syllabus that grades two things called "Essay", a guide with two
 * units under one name. None of those is malformed, and `lib/generate.ts`
 * manufactures the last of them itself — every unnamed unit a model returns is
 * written out as "Unit".
 *
 * The projections listed here are the ones a person or a model chooses the
 * text of, so two of them can be the same. It is a list of what driving the
 * app has actually turned up, not a proof: a key made of drawn text can be
 * written in more shapes than a grep knows, and the second batch here came
 * from using the screens rather than from reading them. Anything new belongs
 * on the list. The fix in every case was to carry
 * the position alongside, which the surrounding code was already using for
 * everything else — `figMap[i]`, `state.openUnit === i`, `lessons[i]` — and
 * the key alone had dropped.
 */
const NAKED = [
  'u.name',
  'unit.name',
  'r.what',
  'g.what',
  'm.what',
  'b.code',
  't.t',
  'c.q',
  'f.t',
  // A bare parameter over an array of drawn fields, which the shapes above do
  // not cover: `[s.author, s.year, s.title, s.project].filter(Boolean).map((bit)
  // => <span key={bit}>)` in Sources, and a quiz option in Exam. Found by using
  // the app rather than by reading it — adding two sources whose parse left the
  // same words in two fields.
  'bit',
  'option',
];

function tsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? tsx(join(dir, e.name))
      : e.name.endsWith('.tsx')
        ? [join(dir, e.name)]
        : [],
  );
}

describe('what a list is keyed by', () => {
  it('is never a label two rows could share', () => {
    const bad: string[] = [];
    for (const file of [...tsx('src/screens'), ...tsx('src/components')]) {
      const src = readFileSync(file, 'utf8').split('\n');
      src.forEach((line, i) => {
        for (const field of NAKED) {
          if (line.includes(`key={${field}}`)) bad.push(`${file}:${i + 1} key={${field}}`);
        }
      });
    }
    expect(
      bad,
      'a key made only of drawn text collides the moment two rows say the same ' +
        'thing — carry the index or the record’s own id alongside it',
    ).toEqual([]);
  });
});
