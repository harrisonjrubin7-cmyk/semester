import { describe, expect, it } from 'vitest';
import { degreeCapabilities, needWords, parseGroups, readAudit } from './client';

describe('which degree capabilities a person holds', () => {
  const grants = [
    { capability: 'degree:author', scopeKind: 'school', scopeId: 'vu' },
    { capability: 'degree:read', scopeKind: 'school', scopeId: 'vu' },
    { capability: 'degree:approve', scopeKind: 'school', scopeId: 'other' },
    { capability: 'degree:declare', scopeKind: 'course', scopeId: 'vu' },
    { capability: 'attendance:take', scopeKind: 'school', scopeId: 'vu' },
  ];
  it('reads only degree capabilities over exactly this school', () => {
    expect([...degreeCapabilities(grants, 'vu')].sort()).toEqual(['degree:author', 'degree:read']);
    expect(degreeCapabilities(grants, '').size).toBe(0);
  });
});

describe('requirements as an author types them', () => {
  it('reads a course, a subject and a subject with a range', () => {
    const r = parseGroups('Core | all | econ 1010, ECON 1020\nElectives | 2 of | ECON 2000-4999\nBreadth | 6 credits | HIST, ECON 2000-4999');
    expect(r).toEqual({
      groups: [
        { name: 'Core', kind: 'all', rules: [{ course: 'ECON 1010' }, { course: 'ECON 1020' }] },
        { name: 'Electives', kind: 'n_of', need: 2, rules: [{ prefix: 'ECON', min: 2000, max: 4999 }] },
        { name: 'Breadth', kind: 'credits', need: 6, rules: [{ prefix: 'HIST' }, { prefix: 'ECON', min: 2000, max: 4999 }] },
      ],
    });
  });
  it('says the first bad line, by number, and the reason', () => {
    expect(parseGroups('')).toEqual({ error: 'Write at least one requirement group.' });
    expect(parseGroups('Core | all | ECON 1010\nBroken')).toEqual({ error: 'Line 2: write “Name | all, 2 of or 6 credits | rules”.' });
    expect(parseGroups('Core | some | ECON 1010')).toEqual({ error: 'Line 1: the second part is “all”, “2 of” or “6 credits”.' });
    expect(parseGroups('Core | all | ECON1010')).toEqual({ error: 'Line 1: “ECON1010” is not a course, a subject or a subject with a range.' });
    expect(parseGroups('Core | all | ECON 4999-2000')).toEqual({ error: 'Line 1: “ECON 4999-2000” has its range backwards.' });
    expect(parseGroups('Core | all |  , ')).toEqual({ error: 'Line 1: a group needs at least one rule.' });
  });
});

describe('reading the engine’s answer', () => {
  it('keeps what it said and defaults what it did not', () => {
    const a = readAudit({
      program: 'ECON', program_name: 'Economics', catalog_year: 2026, status: 'in_progress', what_if: true, saved: null, version: 'v1',
      credits: { have: 12, need: 120, met: false }, gpa: { have: null, need: 2, met: false },
      groups: [{ position: 1, name: 'Core', kind: 'all', need: 2, have: 2, met: true, waived: false, courses: ['ECON 1010'], substituted: [] }],
      unmet: ['Electives'], unused: [], warnings: ['No credit entry for X 1'],
    });
    expect(a.whatIf).toBe(true);
    expect(a.saved).toBeNull();
    expect(a.gpa.have).toBeNull();
    expect(a.groups[0].courses).toEqual(['ECON 1010']);
    expect(readAudit(null).status).toBe('in_progress');
  });
  it('says a requirement in words', () => {
    expect(needWords({ kind: 'all', need: 2 })).toBe('all 2 courses');
    expect(needWords({ kind: 'n_of', need: 1 })).toBe('1 course');
    expect(needWords({ kind: 'credits', need: 6 })).toBe('6 credits');
  });
});
