import { describe, expect, it } from 'vitest';
import { admissionsCapabilities, missingAnswers, missingDocuments, parseChecklist, parseQuestions } from './client';

describe('which admissions capabilities a person holds', () => {
  const grants = [
    { capability: 'admissions:review', scopeKind: 'school', scopeId: 'vu' },
    { capability: 'admissions:decide', scopeKind: 'school', scopeId: 'other' },
    { capability: 'admissions:read', scopeKind: 'course', scopeId: 'vu' },
    { capability: 'records:issue', scopeKind: 'school', scopeId: 'vu' },
  ];
  it('reads only admissions capabilities over exactly this school', () => {
    expect([...admissionsCapabilities(grants, 'vu')]).toEqual(['admissions:review']);
    expect(admissionsCapabilities(grants, '').size).toBe(0);
  });
});

describe('questions as an author types them', () => {
  it('reads a text and a choice question', () => {
    expect(parseQuestions('essay | Why this school | text | required\nmajor | Intended major | choice | optional | Econ, History')).toEqual({
      questions: [
        { key: 'essay', label: 'Why this school', kind: 'text', required: true },
        { key: 'major', label: 'Intended major', kind: 'choice', required: false, options: ['Econ', 'History'] },
      ],
    });
  });
  it('says the first bad line by number', () => {
    expect(parseQuestions('essay | Why | text')).toHaveProperty('error', expect.stringContaining('Line 1'));
    expect(parseQuestions('Essay | Why | text | required')).toHaveProperty('error', expect.stringContaining('Line 1'));
    expect(parseQuestions('essay | Why | longtext | required')).toEqual({ error: 'Line 1: the kind is “text” or “choice”.' });
    expect(parseQuestions('major | Major | choice | optional | Econ')).toEqual({ error: 'Line 1: a choice needs at least two options after the fourth part.' });
    expect(parseQuestions('a | A | text | required\na | B | text | optional')).toEqual({ error: 'Each question needs its own key.' });
  });
});

describe('the document checklist as an author types it', () => {
  it('reads required and optional items and refuses a repeat', () => {
    expect(parseChecklist('transcript | Secondary transcript | required\nrecs | Recommendation | optional')).toEqual({
      items: [{ key: 'transcript', label: 'Secondary transcript', required: true }, { key: 'recs', label: 'Recommendation', required: false }],
    });
    expect(parseChecklist('transcript | A | required\ntranscript | B | optional')).toEqual({ error: 'Each checklist item needs its own key.' });
    expect(parseChecklist('transcript | A | maybe')).toEqual({ error: 'Line 1: write “key | Document | required or optional”.' });
  });
});

describe('what an application still lacks', () => {
  const cycle = {
    questions: [{ key: 'essay', label: 'Why this school', kind: 'text' as const, required: true }, { key: 'major', label: 'Major', kind: 'text' as const, required: false }],
    checklist: [{ key: 'transcript', label: 'Transcript', required: true }, { key: 'recs', label: 'Recommendation', required: false }],
  };
  it('names the unanswered required questions only', () => {
    expect(missingAnswers(cycle, { essay: '  ' })).toEqual(['Why this school']);
    expect(missingAnswers(cycle, { essay: 'Because' })).toEqual([]);
  });
  it('counts a document received or waived, not one only sent', () => {
    expect(missingDocuments(cycle, { transcript: 'sent' })).toEqual(['Transcript']);
    expect(missingDocuments(cycle, { transcript: 'received' })).toEqual([]);
    expect(missingDocuments(cycle, { transcript: 'waived' })).toEqual([]);
  });
});
