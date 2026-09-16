import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMPTY,
  after,
  joined,
  keyOf,
  lessonAssets,
  measured,
  orphans,
  perCourse,
  plan,
  recipeOf,
  saidMs,
  saved,
  type Asset,
  type Made,
  type Manifest,
} from '../../scripts/audiocache';
import { courseOf, wanted } from '../../scripts/audio';

/**
 * The cache in front of twenty-six minutes of rendering.
 *
 * Two kinds of test here and they answer different questions. The first half
 * is the deciding, on made-up material, where a wrong answer can be shown
 * rather than argued about. The second half is the same rules pointed at the
 * repository itself — forty-eight assets, four guides, the manifest that is
 * committed beside them — because the failure this job can actually have is
 * not a wrong hash. It is `unit-3.mp3` meaning a different unit three than the
 * one `pipeline/lessons.py` writes, and nothing but the real files can catch
 * that.
 */

const RECIPE = 'r1';
const OTHER = 'r2';

function asset(id: string, material: string[], kind: Asset['kind'] = 'lesson'): Asset {
  return { id, course: courseOf(id), kind, material, file: `app/public/audio/${id}.mp3` };
}

function row(key: string, ms = 0): Made {
  return { key, at: 1, ms, seconds: 60, bytes: 1000 };
}

function held(rows: Record<string, Made>, recipes: Record<string, string> = { lesson: RECIPE, episode: RECIPE }): Manifest {
  return { recipes, made: rows };
}

describe('joining material', () => {
  it('cannot be forged by material holding the separator', () => {
    // The whole reason for length prefixes. A unit whose card contained the
    // separator character would otherwise hash as two pieces, and two
    // different units would answer to the same key.
    expect(joined(['a\u0000b'])).not.toBe(joined(['a', 'b']));
    expect(joined(['ab', 'c'])).not.toBe(joined(['a', 'bc']));
  });

  it('is the same for the same pieces in the same order', () => {
    expect(joined(['one', 'two'])).toBe(joined(['one', 'two']));
  });

  it('is not the same for the same pieces in a different order', () => {
    // A unit whose cards were reordered is spoken in a different order, so it
    // is different audio.
    expect(joined(['one', 'two'])).not.toBe(joined(['two', 'one']));
  });
});

describe('the key', () => {
  const material = ['ECON 1020', '4 · Supply', 'What do the heights mean?', 'Willingness to pay.'];

  it('is stable for the same material under the same recipe', () => {
    expect(keyOf(RECIPE, material)).toBe(keyOf(RECIPE, [...material]));
  });

  it('moves when a single word of the material moves', () => {
    const edited = [...material];
    edited[3] = 'Willingness to pay, at that quantity.';
    expect(keyOf(RECIPE, edited)).not.toBe(keyOf(RECIPE, material));
  });

  it('moves when the renderer changes and the material does not', () => {
    // The failure that looks fine from outside: every file on disk is now
    // something the renderer would no longer produce, and every hash still
    // matches.
    expect(keyOf(OTHER, material)).not.toBe(keyOf(RECIPE, material));
  });
});

describe('the recipe', () => {
  it('changes when the source of any renderer changes', () => {
    expect(recipeOf(['synth', 'lessons'])).not.toBe(recipeOf(['synth', 'lessons v2']));
  });

  it('is not the same as its sources concatenated another way', () => {
    expect(recipeOf(['ab', 'c'])).not.toBe(recipeOf(['a', 'bc']));
  });
});

describe('numbering a course’s lessons', () => {
  const card = { q: 'q', a: 'a' };

  it('numbers from zero, in the order the guide holds them', () => {
    const made = lessonAssets('econ', 'ECON 1020', [
      { name: 'one', cards: [card] },
      { name: 'two', cards: [card] },
    ]);
    expect(made.map((a) => a.id)).toEqual(['econ/unit-0', 'econ/unit-1']);
  });

  it('skips a unit with no cards, and moves the ones after it up', () => {
    // Which is what `pipeline/lessons.py` does. No shipped course has an empty
    // unit, so nothing on disk can tell us whether the two agree — only this.
    const made = lessonAssets('econ', 'ECON 1020', [
      { name: 'one', cards: [card] },
      { name: 'empty', cards: [] },
      { name: 'three', cards: [card] },
    ]);
    expect(made.map((a) => a.id)).toEqual(['econ/unit-0', 'econ/unit-1']);
    expect(made[1].material).toContain('three');
  });

  it('puts the course code in the material, because the opening line says it', () => {
    const made = lessonAssets('econ', 'ECON 1020', [{ name: 'one', cards: [card] }]);
    expect(made[0].material[0]).toBe('ECON 1020');
  });
});

describe('planning a run', () => {
  const one = asset('econ/unit-0', ['a']);
  const two = asset('econ/unit-1', ['b']);
  const three = asset('econ/unit-2', ['c']);

  it('renders what has no row at all', () => {
    const cut = plan([one], EMPTY, { lesson: RECIPE });
    expect(cut.render.map((a) => a.id)).toEqual(['econ/unit-0']);
  });

  it('reuses a row whose key still matches', () => {
    const cut = plan([one], held({ 'econ/unit-0': row(keyOf(RECIPE, ['a'])) }), { lesson: RECIPE });
    expect(cut.reuse.map((a) => a.id)).toEqual(['econ/unit-0']);
    expect(cut.render).toEqual([]);
  });

  it('renders only the asset whose material moved', () => {
    // The control is the other two. A probe that reported one stale unit and
    // also quietly staled its neighbours would pass a test that only looked at
    // the edited one.
    const manifest = held({
      'econ/unit-0': row(keyOf(RECIPE, ['a'])),
      'econ/unit-1': row(keyOf(RECIPE, ['b'])),
      'econ/unit-2': row(keyOf(RECIPE, ['c'])),
    });
    const cut = plan([one, { ...two, material: ['b, edited'] }, three], manifest, { lesson: RECIPE });
    expect(cut.render.map((a) => a.id)).toEqual(['econ/unit-1']);
    expect(cut.reuse.map((a) => a.id)).toEqual(['econ/unit-0', 'econ/unit-2']);
  });

  it('stales everything of a kind whose renderer changed', () => {
    const manifest = held(
      { 'econ/unit-0': row(keyOf(RECIPE, ['a'])), 'bus-podcast': row(keyOf(RECIPE, ['p'])) },
      { lesson: RECIPE, episode: RECIPE },
    );
    const cut = plan([one, asset('bus-podcast', ['p'], 'episode')], manifest, { lesson: OTHER, episode: RECIPE });
    expect(cut.recipeChanged).toEqual(['lesson']);
    expect(cut.render.map((a) => a.id)).toEqual(['econ/unit-0']);
    // The episode is the control: a lesson rule cannot reach it, and an hour
    // of re-rendering is what saying otherwise would cost.
    expect(cut.reuse.map((a) => a.id)).toEqual(['bus-podcast']);
  });

  it('does not call a kind changed that the manifest has never seen', () => {
    const cut = plan([one], held({}, {}), { lesson: RECIPE });
    expect(cut.recipeChanged).toEqual([]);
  });

  it('sweeps rows nobody asks for any more', () => {
    const cut = plan([one], held({ 'econ/unit-0': row(keyOf(RECIPE, ['a'])), 'econ/unit-9': row('x') }), {
      lesson: RECIPE,
    });
    expect(cut.sweep).toEqual(['econ/unit-9']);
  });
});

describe('audio nothing accounts for', () => {
  const made = [asset('bus-podcast', ['p'], 'episode')];

  it('names an episode with no script behind it', () => {
    expect(orphans(['bus-podcast.mp3', 'psci-full.mp3'], made)).toEqual(['psci-full.mp3']);
  });

  it('does not name the ones it can rebuild', () => {
    // The control. A check that returned everything would also "find" the four
    // real orphans, and would be telling us nothing.
    expect(orphans(['bus-podcast.mp3'], made)).toEqual([]);
  });

  it('ignores what is not audio', () => {
    expect(orphans(['lessons.json', 'notes.txt'], made)).toEqual([]);
  });
});

describe('the manifest after a run', () => {
  it('keeps rows it did not touch and replaces the ones it did', () => {
    const before = held({ 'econ/unit-0': row('old'), 'econ/unit-1': row('kept') });
    const next = after(before, { lesson: OTHER }, { 'econ/unit-0': row('new', 500) });
    expect(next.made['econ/unit-0'].key).toBe('new');
    expect(next.made['econ/unit-1'].key).toBe('kept');
  });

  it('drops what was swept', () => {
    const before = held({ 'econ/unit-0': row('a'), 'econ/unit-9': row('b') });
    expect(Object.keys(after(before, {}, {}, ['econ/unit-9']).made)).toEqual(['econ/unit-0']);
  });

  it('keeps the recipe of a kind this run did not render', () => {
    // A run over one course must not tell the manifest that the episodes were
    // rendered under a recipe nobody checked.
    const before = held({}, { lesson: RECIPE, episode: RECIPE });
    expect(after(before, { lesson: OTHER }, {}).recipes).toEqual({ lesson: OTHER, episode: RECIPE });
  });

  it('writes its rows in a fixed order, because it is committed', () => {
    const next = after(EMPTY, {}, { 'z/unit-0': row('z'), 'a/unit-0': row('a') });
    expect(Object.keys(next.made)).toEqual(['a/unit-0', 'z/unit-0']);
  });
});

describe('what a run cost', () => {
  it('refuses to count an adopted row as measured', () => {
    // An adopted row is a file somebody else rendered. Counting its zero as a
    // measurement would say the repository builds its audio instantly.
    expect(measured([row('a', 0), row('b', 900)])).toHaveLength(1);
  });

  it('reports assets and timed assets separately', () => {
    const manifest = held({ 'econ/unit-0': row('a', 0), 'econ/unit-1': row('b', 1200), 'bus/unit-0': row('c', 0) });
    const rows = perCourse(manifest, courseOf);
    expect(rows.map((r) => [r.course, r.assets, r.timed, r.ms])).toEqual([
      ['bus', 1, 0, 0],
      ['econ', 2, 1, 1200],
    ]);
  });

  it('counts a saving only from rows that were timed', () => {
    const manifest = held({ 'econ/unit-0': row(keyOf(RECIPE, ['a']), 0), 'econ/unit-1': row(keyOf(RECIPE, ['b']), 4000) });
    const cut = plan([asset('econ/unit-0', ['a']), asset('econ/unit-1', ['b'])], manifest, { lesson: RECIPE });
    expect(saved(cut, manifest)).toEqual({ ms: 4000, known: 1, of: 2 });
  });

  it('says a duration at the size it is', () => {
    expect(saidMs(340)).toBe('340ms');
    expect(saidMs(12_600)).toBe('12.6s');
    expect(saidMs(134_000)).toBe('2.2 min');
  });
});

/**
 * The repository itself, which is the half that can catch a numbering bug.
 *
 * `pipeline/lessons.py` reads `guide.ts` with a regular expression and numbers
 * the units it finds; this job reads the same guide as a module and numbers the
 * units the app holds. They agree today. Nothing but these assertions would
 * notice the day they stopped.
 */
describe('the four shipped courses', () => {
  const ROOT = join('..');

  it('want forty-eight assets — forty-four lessons and four episodes', async () => {
    // Guards everything below: were `wanted` to return nothing, each loop
    // beneath would pass without asserting anything at all.
    const all = await wanted();
    expect(all.filter((a) => a.kind === 'lesson')).toHaveLength(44);
    expect(all.filter((a) => a.kind === 'episode')).toHaveLength(4);
  });

  it('name a file that is on disk for every one of them', async () => {
    const missing = (await wanted()).filter((a) => !existsSync(join(ROOT, a.file)));
    expect(missing.map((a) => a.file)).toEqual([]);
  });

  it('number their units the way the rendered metadata does', async () => {
    for (const course of ['bus', 'core', 'econ', 'psci']) {
      const meta = join(ROOT, 'app', 'public', 'audio', 'lessons', course, 'lessons.json');
      const rendered = Object.keys(JSON.parse(readFileSync(meta, 'utf8'))).sort();
      const asked = (await wanted(course))
        .filter((a) => a.kind === 'lesson')
        .map((a) => a.id.slice(a.id.lastIndexOf('-') + 1))
        .sort();
      expect(asked).toEqual(rendered);
    }
  });

  it('give every asset material with the course code and some words in it', async () => {
    for (const a of await wanted()) {
      expect(a.material.length).toBeGreaterThan(2);
      expect(a.material.join('').length).toBeGreaterThan(80);
    }
  });
});

describe('the committed manifest', () => {
  const manifest = JSON.parse(readFileSync(join('..', 'audio', 'manifest.json'), 'utf8')) as Manifest;

  it('holds a row for every asset the repository wants, and no others', async () => {
    const ids = (await wanted()).map((a) => a.id).sort();
    expect(Object.keys(manifest.made).sort()).toEqual(ids);
  });

  it('records a recipe for each kind of renderer', () => {
    expect(Object.keys(manifest.recipes).sort()).toEqual(['episode', 'lesson']);
  });

  it('claims a measured cost for nothing it adopted', () => {
    // Every row here was adopted from audio a person rendered before this job
    // existed. The moment one of them claims a figure, somebody has either
    // rendered it through the job or invented the number.
    const claiming = Object.entries(manifest.made).filter(([, r]) => r.ms > 0);
    expect(claiming.map(([id]) => id)).toEqual([]);
  });

  it('knows how long each asset is', () => {
    const silent = Object.entries(manifest.made).filter(([, r]) => r.seconds <= 0 || r.bytes <= 0);
    expect(silent.map(([id]) => id)).toEqual([]);
  });
});
