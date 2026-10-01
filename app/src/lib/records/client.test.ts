import { describe, expect, it } from 'vitest';
import { codeWords, recordsCapabilities, transcriptView } from './client';

describe('which records capabilities a person holds', () => {
  const grants = [
    { capability: 'records:issue', scopeKind: 'school', scopeId: 'vu' },
    { capability: 'records:audit', scopeKind: 'school', scopeId: 'other' },
    { capability: 'records:clear', scopeKind: 'course', scopeId: 'vu' },
    { capability: 'degree:read', scopeKind: 'school', scopeId: 'vu' },
  ];
  it('reads only records capabilities over exactly this school', () => {
    expect([...recordsCapabilities(grants, 'vu')]).toEqual(['records:issue']);
    expect(recordsCapabilities(grants, '').size).toBe(0);
  });
});

describe('a verification code is printed in groups of four', () => {
  it('groups 24 characters into six', () => {
    expect(codeWords('0123456789ABCDEF01234567')).toBe('0123-4567-89AB-CDEF-0123-4567');
  });
});

describe('what a signed transcript says', () => {
  const content = {
    entries: [
      { kind: 'credit', key: 'ECON 1010 · Fall 2025', value: '3' },
      { kind: 'grade', key: 'ECON 1010 · Fall 2025', value: 'B' },
      { kind: 'credit', key: 'ECON 1020 · Spring 2026', value: '3' },
      { kind: 'grade', key: 'ECON 1020 · Spring 2026', value: 'A' },
      { kind: 'credit', key: 'MATH 1010 · Spring 2026', value: '4' },
      { kind: 'grade', key: 'MATH 1010 · Spring 2026', value: 'F' },
      { kind: 'grade', key: 'HIST 1100 · Fall 2025', value: 'C' },
      { kind: 'transfer_credit', key: 'PHYS 1001', value: '4' },
      { kind: 'standing', key: 'Spring 2026', value: 'good standing' },
    ],
  };
  const t = transcriptView(content);
  it('orders terms in time, Fall 2025 before Spring 2026', () => {
    expect(t.terms.map((x) => x.term)).toEqual(['Fall 2025', 'Spring 2026']);
  });
  it('weights a term’s GPA by credits and ignores a grade with no credit entry', () => {
    expect(t.terms[0].gpa).toBe(3);
    expect(t.terms[1].gpa).toBe(Math.round(((4 * 3 + 0 * 4) / 7) * 1000) / 1000);
    expect(t.terms[0].courses.find((c) => c.course === 'HIST 1100')?.credits).toBeNull();
  });
  it('counts credits earned (not a failed course) and adds transfer credit', () => {
    expect(t.terms[1].credits).toBe(3);
    expect(t.cumulative.credits).toBe(3 + 3 + 4);
  });
  it('says standing and transfer, and survives an empty or odd document', () => {
    expect(t.standing).toEqual(['Spring 2026: good standing']);
    expect(t.transfer).toEqual([{ course: 'PHYS 1001', credits: 4 }]);
    expect(transcriptView(null).terms).toEqual([]);
    expect(transcriptView({ entries: 'no' }).cumulative.gpa).toBeNull();
  });
});
