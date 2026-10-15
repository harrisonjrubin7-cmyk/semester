import { describe, expect, it } from 'vitest';
import { classify, csv, ownerOf, summarize } from './inventory.ts';
import { treeOf } from './rules.ts';

/** A small tree with one of each thing the classifier has to tell apart. */
const sources: Record<string, string> = {
  'main.tsx': `import './screens/Today';`,
  'screens/Today.tsx': `import '../lib/chores';\nimport '../lib/cloud';\nimport '../components/ui';\nimport '../components/AbsenceNotices';\nexport {};`,
  'components/ui.tsx': `export const ui = 1;`,
  'components/AbsenceNotices.tsx': `import '../lib/calsource';\nexport const a = 1;`,
  'lib/chores.ts': `export const tick = 1;`,
  'lib/chores.test.ts': `import './chores';`,
  'lib/calsource.ts': `export const c = 1;`,
  'lib/cloud.ts': `export const get = () => localStorage.getItem('x');`,
  'lib/dead.ts': `export const dead = 1;`,
  'lib/dead.test.ts': `import './dead';`,
  'lib/governance/risk.ts': `export const risk = 1;`,
  'lib/governance/risk.test.ts': `import './risk';`,
  'lib/mystery.ts': `export const m = 1;`,
};
for (let i = 0; i < 25; i++) sources[`screens/S${i}.tsx`] = `import '../components/ui';`;
sources['main.tsx'] += Array.from({ length: 25 }, (_, i) => `\nimport './screens/S${i}';`).join('');

const rows = classify(treeOf(sources));
const row = (p: string) => rows.find((r) => r.path === p)!;

describe('the legacy inventory', () => {
  it('assigns the first matching owner and leaves the rest unassigned', () => {
    expect(ownerOf('lib/chores.ts')).toBe('tasks');
    expect(ownerOf('lib/calsource.ts')).toBe('calendar');
    expect(ownerOf('lib/governance/risk.ts')).toBe('support-trust');
    expect(ownerOf('lib/zzz-nothing.ts')).toBe('unassigned');
    expect(row('lib/mystery.ts').domain).toBe('unassigned');
  });

  it('gives a component the domain it talks to, not the one its name suggests', () => {
    expect(row('components/AbsenceNotices.tsx').domain).toBe('calendar');
  });

  it('says reuse for pure logic, migrate for what touches the world, replace for a screen, reuse for a shared primitive', () => {
    expect(row('lib/chores.ts').disposition).toBe('reuse');
    expect(row('lib/cloud.ts').disposition).toBe('migrate');
    expect(row('screens/Today.tsx').disposition).toBe('replace');
    expect(row('components/AbsenceNotices.tsx').disposition).toBe('replace');
    expect(row('components/ui.tsx').disposition).toBe('reuse'); // 26 importers
  });

  it('marks as a delete candidate only what no entry point reaches — a test importing it does not save it', () => {
    expect(row('lib/dead.ts').disposition).toBe('delete-candidate');
    expect(row('lib/chores.ts').disposition).not.toBe('delete-candidate');
    // The control: the same file is not a candidate once an entry imports it.
    const saved = classify(treeOf({ ...sources, 'main.tsx': `${sources['main.tsx']}\nimport './lib/dead';` }));
    expect(saved.find((r) => r.path === 'lib/dead.ts')!.disposition).not.toBe('delete-candidate');
  });

  it('archives documentation kept as code only while no product file imports it', () => {
    expect(row('lib/governance/risk.ts').disposition).toBe('archive');
    const used = classify(treeOf({ ...sources, 'screens/Today.tsx': `${sources['screens/Today.tsx']}\nimport '../lib/governance/risk';` }));
    expect(used.find((r) => r.path === 'lib/governance/risk.ts')!.disposition).toBe('migrate');
  });

  it('never lists a test file, and every row says why', () => {
    expect(rows.some((r) => r.path.endsWith('.test.ts'))).toBe(false);
    for (const r of rows) expect(r.because.length).toBeGreaterThan(10);
  });

  it('summarizes to the same totals as the rows, and renders a header and one line per file', () => {
    const s = summarize(rows);
    expect(Object.values(s.byDisposition).reduce((n, d) => n + d.files, 0)).toBe(rows.length);
    expect(Object.values(s.byDomain).reduce((n, d) => n + d.loc, 0)).toBe(rows.reduce((n, r) => n + r.loc, 0));
    expect(csv(rows).trim().split('\n')).toHaveLength(rows.length + 1);
  });
});
