import { describe, expect, it } from 'vitest';
import { entitle, SUBJECTS, subjectOf, toolsFor, UNIVERSAL } from './catalog';

/** The subject lists, as each subject workbench phase adds its departments. */

const find = (id: string) => SUBJECTS.flatMap((s) => s.tools).find((x) => x.id === id);

describe('subject workbenches', () => {
  it('finds a subject from the course-code prefix, in any case', () => {
    expect(subjectOf('MATH 2300')?.id).toBe('math');
    expect(subjectOf('cs 1101')?.id).toBe('cs');
    expect(subjectOf('PSCI 1104')?.id).toBe('poli-sci');
    expect(subjectOf('econ 1010')?.id).toBe('economics');
  });

  it('no prefix belongs to two subjects', () => {
    const all = SUBJECTS.flatMap((s) => s.prefixes);
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps the DNA lab and the security sandbox behind review, even when approved', () => {
    for (const id of ['dna-lab', 'security-sandbox']) {
      const tool = find(id)!;
      expect(tool.state).toBe('restricted');
      expect(entitle(tool, new Set([id]), true).available).toBe(false);
    }
    expect(find('dna-lab')?.boundary).toBe('science');
    expect(find('security-sandbox')?.boundary).toBe('cyber');
  });

  it('clinical tools are simulation only and the case library stays behind review', () => {
    expect(find('med-math')?.boundary).toBe('clinical');
    expect(entitle(find('clinical-cases')!, new Set(['clinical-cases']), true).available).toBe(false);
    expect(find('gis-basics')?.boundary).toBe('location');
  });

  it('knows 32 subjects', () => {
    expect(SUBJECTS.length).toBe(32);
  });

  it('legal and finance tools carry their boundary', () => {
    expect(find('case-brief')?.boundary).toBe('legal');
    expect(find('finance-models')?.boundary).toBe('finance');
  });

  it('every subject inherits the universal tools, without duplicates', () => {
    const tools = toolsFor([SUBJECTS[0], SUBJECTS[1]]);
    expect(new Set(tools.map((x) => x.id)).size).toBe(tools.length);
    for (const u of UNIVERSAL) expect(tools.some((x) => x.id === u.id)).toBe(true);
  });
});
