import { describe, expect, it } from 'vitest';
import { entitle, NEVER, SUBJECTS, subjectOf, toolsFor, UNIVERSAL, type Tool } from './catalog';

/**
 * The catalog's core: entitlement and the capabilities nothing can enable.
 * Subject lists are tested in `subjects.test.ts`, which grows as each subject
 * workbench phase lands.
 */

const tool = (patch: Partial<Tool>): Tool => ({ id: 'x', name: 'x', purpose: '', state: 'guided', opens: 'assignment', ...patch });

describe('workbench catalog and entitlement', () => {
  it('finds no subject for an unknown or empty course code', () => {
    expect(subjectOf('ZZZZ 1000')).toBeUndefined();
    expect(subjectOf('')).toBeUndefined();
  });

  it('every native tool names a screen and every guided tool names a toolkit section', () => {
    for (const x of [...UNIVERSAL, ...SUBJECTS.flatMap((s) => s.tools)]) {
      if (x.state === 'native') expect(x.screen, x.id).toBeTruthy();
      if (x.state === 'guided') expect(x.opens, x.id).toBeTruthy();
    }
  });

  it('restricted tools stay unavailable even when approved and the flag is on — nothing has passed review', () => {
    const risky = tool({ id: 'risky', state: 'restricted', boundary: 'science' });
    expect(entitle(risky, new Set(), false).available).toBe(false);
    expect(entitle(risky, new Set(['risky']), true)).toMatchObject({ available: false, label: 'Needs review before use' });
  });

  it('planned tools say they are not built rather than opening', () => {
    expect(entitle(tool({ state: 'planned' }), new Set(), true)).toMatchObject({ available: false, label: 'Not built yet' });
  });

  it('native and guided tools open', () => {
    expect(entitle(tool({ state: 'native', screen: 'study' }), new Set(), false)).toMatchObject({ available: true, label: 'Opens in Semester' });
    expect(entitle(tool({}), new Set(), false)).toMatchObject({ available: true, label: 'In the toolkit' });
  });

  it('a never-permitted capability is refused even if an approval list names it and it claims to be native', () => {
    for (const [id] of NEVER) {
      const rogue: Tool = { id, name: id, purpose: '', state: 'native', screen: 'study' };
      expect(entitle(rogue, new Set([id]), true)).toMatchObject({ available: false, label: 'Not permitted' });
    }
  });

  it('no catalog tool uses a never-permitted id', () => {
    const ids = new Set<string>(NEVER.map(([id]) => id));
    expect([...UNIVERSAL, ...SUBJECTS.flatMap((s) => s.tools)].filter((x) => ids.has(x.id))).toEqual([]);
  });

  it('with no subject, the tools on offer are the universal ones', () => {
    expect(toolsFor([]).map((x) => x.id)).toEqual(UNIVERSAL.map((x) => x.id));
  });
});
