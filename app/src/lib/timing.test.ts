import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MOST, forget, mark, now, over, readings, saidMs, timed } from './timing';

/**
 * The instrument, and the two ways an instrument lies.
 *
 * §7.1 of the completion plan asks for "a measured render and build time on
 * the existing diagnostics screen, so the first person with seven courses can
 * say what is slow rather than that it feels slow". A student reads these
 * figures out to somebody, which puts two properties above the arithmetic.
 *
 * It must not become telemetry. Nothing here is stored, synced or timed to
 * anything finer than a duration, and the tests below are about the shape that
 * keeps that true: a summary rather than a trail, and a bound on how much of
 * one it will hold.
 *
 * And a duration must arrive beside the volume that produced it. Eleven
 * milliseconds is fast for a hundred courses and slow for none, so a worst
 * time carrying some other run's volume is two facts about two moments, read
 * as one.
 */

beforeEach(() => forget());

describe('what a reading keeps', () => {
  it('counts, and holds the last and the worst apart', () => {
    mark('build', 10);
    mark('build', 40);
    mark('build', 25);
    const [r] = readings();
    expect([r.count, r.last, r.worst, r.total]).toEqual([3, 25, 40, 75]);
  });

  it('keeps a summary and not a trail', () => {
    // The whole privacy argument in one assertion: no timestamps, no order, no
    // list of runs. `lib/usage.ts` makes the same refusal about screen opens.
    mark('build', 10, '4 courses');
    expect(Object.keys(readings()[0]).sort()).toEqual(
      ['count', 'last', 'name', 'over', 'total', 'worst'].sort(),
    );
  });

  it('puts the slowest first, because that is the question being asked', () => {
    mark('quick', 2);
    mark('slow', 90);
    mark('middling', 20);
    expect(readings().map((r) => r.name)).toEqual(['slow', 'middling', 'quick']);
  });

  it('hands back a copy, so a snapshot stays one', () => {
    /*
     * Found by driving it: the Data screen holds this in a `useState`
     * initialiser and calls it a snapshot, and the live objects went on
     * changing under a list that had already decided not to re-render. The
     * screen ended up reporting a measurement of the render that was drawing
     * the report.
     */
    mark('build', 10);
    const held = readings();
    mark('build', 90);
    expect(held[0].worst).toBe(10);
    expect(readings()[0].worst).toBe(90);
  });

  it('is empty after being forgotten', () => {
    mark('build', 10);
    forget();
    expect(readings()).toEqual([]);
  });
});

describe('the volume beside the figure', () => {
  it('is the one that produced the worst time, not the most recent', () => {
    // A worst of 90 ms beside "1 course" would send somebody looking at the
    // wrong thing — it was seven courses that took 90.
    mark('build', 90, '7 courses');
    mark('build', 3, '1 course');
    expect([readings()[0].worst, readings()[0].over]).toEqual([90, '7 courses']);
  });

  it('follows the figure when a new worst arrives', () => {
    mark('build', 3, '1 course');
    mark('build', 90, '7 courses');
    expect(readings()[0].over).toBe('7 courses');
  });

  it('keeps the first volume when later runs say nothing', () => {
    mark('drawing', 5, 'guide');
    mark('drawing', 50);
    expect(readings()[0].over).toBe('guide');
  });

  it('says what it ran over in words, with the noun', () => {
    // `4` is a number with no noun, which is the shape of figure §7.1 exists
    // to get away from.
    expect(over(1, 'course')).toBe('1 course');
    expect(over(4, 'course')).toBe('4 courses');
    expect(over(0, 'course')).toBe('0 courses');
  });
});

describe('the bound on how many names it holds', () => {
  it('stops at the cap rather than growing for as long as the tab is open', () => {
    for (let i = 0; i < MOST + 10; i += 1) mark(`name ${i}`, i);
    expect(readings()).toHaveLength(MOST);
  });

  it('drops the new name rather than an old one', () => {
    // A reading somebody is already watching must not vanish mid-sentence.
    for (let i = 0; i < MOST; i += 1) mark(`name ${i}`, 1);
    mark('one too many', 999);
    expect(readings().map((r) => r.name)).not.toContain('one too many');
    expect(readings().map((r) => r.name)).toContain('name 0');
  });

  it('goes on measuring a name it already holds', () => {
    // The control on the cap: full is not frozen. A cap that stopped counting
    // the names it had would quietly freeze every figure on the screen.
    for (let i = 0; i < MOST; i += 1) mark(`name ${i}`, 1);
    mark('name 0', 500);
    expect(readings()[0]).toMatchObject({ name: 'name 0', worst: 500, count: 2 });
  });
});

describe('timing something', () => {
  it('gives back what the work gave back', () => {
    expect(timed('build', '4 courses', () => 6 * 7)).toBe(42);
  });

  it('records that it ran', () => {
    timed('build', '4 courses', () => 1);
    expect(readings()[0]).toMatchObject({ name: 'build', count: 1, over: '4 courses' });
  });

  it('runs the work on every path through it', () => {
    /*
     * Not by stubbing the clock away — there is no longer a path that skips
     * the work, which is what this asserts and why the branch was removed.
     *
     * The test this replaces deleted `globalThis.performance` to reach an
     * early return, restored it with `defineProperty`, and left it read-only.
     * The next file to install fake timers could not, and
     * `state/clock.test.ts` failed three tests in a run where nothing about
     * clocks had changed — an ordering fault whose report names the innocent
     * file, which is the class CLAUDE.md says to fix in the earlier one.
     */
    let ran = 0;
    timed('build', '4 courses', () => (ran += 1));
    expect(ran).toBe(1);
  });

  it('has a clock here, so the readings above are measuring something', () => {
    // The control on the pair: if `now()` answered nothing in this
    // environment, every timing test would pass while measuring nothing.
    expect(typeof now()).toBe('number');
  });
});

describe('saying a duration', () => {
  it('keeps the digit that tells two runs apart', () => {
    // `12 ms` where it was 12.4 has thrown away what a second reading is for.
    expect(saidMs(1.234)).toBe('1.23 ms');
    expect(saidMs(12.44)).toBe('12.4 ms');
  });

  it('stops pretending to precision it does not have', () => {
    expect(saidMs(412.7)).toBe('413 ms');
    expect(saidMs(2410)).toBe('2.41 s');
  });

  it('says nothing rather than zero for a figure it does not have', () => {
    expect(saidMs(Number.NaN)).toBe('—');
    expect(saidMs(-1)).toBe('—');
  });
});

/**
 * The property this is only safe to ship with, checked rather than asserted.
 *
 * §7 says Phase 3's inputs come from the pilot the way research data comes
 * from participants, and that if the trade against the privacy promise is ever
 * revisited it should be revisited in the open, as a decision, "and not as a
 * side effect of wanting a dashboard". A timing store is exactly the side
 * effect that argument names. So the file is read, and the day somebody adds a
 * line that writes one of these figures anywhere, this fails.
 */
describe('nowhere but memory', () => {
  const source = readFileSync(new URL('./timing.ts', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('*/') + 2);

  it('never reaches for storage of any kind', () => {
    const stores = ['localStorage', 'sessionStorage', 'indexedDB', 'IDBDatabase', 'cookie'];
    expect(stores.filter((name) => body.includes(name))).toEqual([]);
  });

  it('never sends anything anywhere', () => {
    const wires = ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'navigator.'];
    expect(wires.filter((name) => body.includes(name))).toEqual([]);
  });

  it('is read out of the real file, not an empty string', () => {
    // The control. A path that resolved to nothing would pass both of the
    // above while checking nothing at all.
    expect(body).toContain('export function mark');
    expect(body.length).toBeGreaterThan(1000);
  });

  it('is not reachable from what the app persists or syncs', () => {
    /*
     * An import rather than a word. The first version of this asked whether
     * `state/shape.ts` mentioned "readings" anywhere, and it does — in a
     * comment about a course's readings, which is a different noun entirely.
     * The probe was convicting on prose, which is the same fault
     * `lib/spendnames.test.ts` records catching in itself.
     *
     * What actually matters is whether the file that decides what is written
     * can see this one. It cannot, and the day it can, this fails.
     */
    const shape = readFileSync(new URL('../state/shape.ts', import.meta.url), 'utf8');
    expect(/from '[^']*timing'/.test(shape)).toBe(false);
  });

  it('is reachable from the screen that shows it, which is the control', () => {
    // A check that answered "not imported" for everything would pass the
    // assertion above while the feature was wired to nothing.
    const data = readFileSync(new URL('../screens/Data.tsx', import.meta.url), 'utf8');
    expect(/from '[^']*timing'/.test(data)).toBe(true);
  });
});

/**
 * And that the two places §7.1 names are actually measured.
 *
 * Read out of the source for the reason `lib/spendnames.test.ts` reads its
 * own: a module that exports a timer and is wired to nothing is a screen full
 * of "Nothing measured yet", and the failure looks like the feature working.
 */
describe('the two things it is pointed at', () => {
  it('times the catalogue build, which §7.1 names first', () => {
    const store = readFileSync(new URL('../state/store.tsx', import.meta.url), 'utf8');
    expect(/timed\(\s*'Catalogue build'/.test(store)).toBe(true);
  });

  it('times a screen being drawn, in the one wrapper every screen goes through', () => {
    const shell = readFileSync(new URL('../components/shell/ShellBody.tsx', import.meta.url), 'utf8');
    expect(/mark\(\s*'Drawing a screen'/.test(shell)).toBe(true);
  });
});
