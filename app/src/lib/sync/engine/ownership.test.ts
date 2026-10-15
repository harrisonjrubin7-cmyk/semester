import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MODULE_FLAGS } from '../../experience-flags';
import { baseOf } from '../../conflicts';
import { settleDeletions } from '../../deletions';
import { baseForLegacy, forLegacy, OWNS_TASKS_KEY, setTaskEngine, taskEngineOn } from './ownership';

function fakeStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}
const flag = MODULE_FLAGS.offline_engine_tasks;
// A build with the module flag on: the cases below are about the device's switch unless they say otherwise.
beforeEach(() => { MODULE_FLAGS.offline_engine_tasks = 'production'; });
afterEach(() => { vi.unstubAllGlobals(); MODULE_FLAGS.offline_engine_tasks = flag; });

const mine = { v: 1, tasks: [{ id: 'T1', title: 'x' }], notes: [{ id: 'N1', title: 'n' }] };

describe('the switch', () => {
  it('is off unless set, and set only to exactly "on"', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(taskEngineOn()).toBe(false);
    vi.stubGlobal('localStorage', fakeStorage({ [OWNS_TASKS_KEY]: 'yes' }));
    expect(taskEngineOn()).toBe(false);
    setTaskEngine(true);
    expect(taskEngineOn()).toBe(true);
    setTaskEngine(false);
    expect(taskEngineOn()).toBe(false);
  });

  it('is off, quietly, where storage is not available', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } });
    expect(taskEngineOn()).toBe(false);
    expect(() => setTaskEngine(true)).not.toThrow();
  });

  it('needs the build\'s module flag as well as the device: either one off and it is off', () => {
    const cases: [string, boolean][] = [['off', true], ['production', false], ['production', true], ['preview', true], ['sandbox', true]];
    const out = cases.map(([state, opt]) => {
      MODULE_FLAGS.offline_engine_tasks = state as never;
      vi.stubGlobal('localStorage', fakeStorage(opt ? { [OWNS_TASKS_KEY]: 'on' } : {}));
      return taskEngineOn();
    });
    expect(out).toEqual([false, false, true, true, true]);
  });

  it('is off by default in a build: no variable set means the module is off', () => {
    expect(flag).toBe('off');
  });

  it('with the module flag off, hands the old half the very same objects whatever the device says', () => {
    MODULE_FLAGS.offline_engine_tasks = 'off';
    vi.stubGlobal('localStorage', fakeStorage({ [OWNS_TASKS_KEY]: 'on' }));
    expect(forLegacy(mine)).toBe(mine);
    const base = { 'tasks/T1': 'f' };
    expect(baseForLegacy(base)).toBe(base);
  });

  it('lives under the prefix Erase from this device clears', () => {
    expect(OWNS_TASKS_KEY.startsWith('semester.')).toBe(true);
  });
});

describe('what the old half may see', () => {
  it('is the very same object with the switch off — the code is then exactly what it was', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(forLegacy(mine)).toBe(mine);
    const base = { 'tasks/T1': 'f', 'notes/N1': 'g' };
    expect(baseForLegacy(base)).toBe(base);
    expect(baseForLegacy(null)).toBeNull();
  });

  it('is everything but tasks with it on', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [OWNS_TASKS_KEY]: 'on' }));
    expect(forLegacy(mine)).toEqual({ v: 1, notes: [{ id: 'N1', title: 'n' }] });
    expect(mine.tasks).toHaveLength(1); // the original is untouched
    expect(baseForLegacy({ 'tasks/T1': 'f', 'notes/N1': 'g', 'settings/tone': 'h' })).toEqual({ 'notes/N1': 'g', 'settings/tone': 'h' });
    expect(forLegacy({ v: 1 })).toEqual({ v: 1 });
  });
});

describe('why the old half must not see tasks the engine owns', () => {
  /*
   * lib/deletions.ts reads "in the base, still here, missing from the account" as another device's deletion and
   * drops the local copy. The engine's tasks are in the base from before it took over, and are not in a blob a
   * device pushes without them — so without this, turning the engine on would delete every task.
   */
  const base = baseOf(mine);
  const accountWithoutTasks = { v: 1, notes: mine.notes };

  it('would drop the tasks if the base still held them and the account no longer did', () => {
    const open = { ...mine, tasks: [{ id: 'T1', title: 'x' }] };
    const out = settleDeletions(open, { ...accountWithoutTasks, tasks: [] }, base);
    expect(Object.keys(out.dropHere).length + out.conflicts.length).toBeGreaterThan(0);
  });

  it('says nothing about tasks once the engine owns them: a copy without the list says nothing about it', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [OWNS_TASKS_KEY]: 'on' }));
    const out = settleDeletions(forLegacy(mine), forLegacy(accountWithoutTasks), baseForLegacy(base));
    expect(out.dropHere).toEqual({});
    expect(out.conflicts).toEqual([]);
  });
});
