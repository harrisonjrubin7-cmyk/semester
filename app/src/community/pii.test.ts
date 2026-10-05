import { describe, expect, it } from 'vitest';
import { detectPii, prePostCheck, redact } from './pii';

const kinds = (text: string, opts = {}) => detectPii(text, opts).map((f) => f.kind);

describe('detectPii', () => {
  it.each([
    ['call me at (615) 555-0142', 'phone'],
    ['text 615.555.0142', 'phone'],
    ['email jordan.r@gmail.com', 'email'],
    ['she lives at 2301 West End Ave', 'street_address'],
    ['meet at 36.1447, -86.8027', 'coordinates'],
    ['he is in room 214', 'room_or_residence'],
    ['she lives in Branscomb Hall', 'room_or_residence'],
    ['every Tuesday at 3pm by the fountain', 'exact_schedule'],
  ])('finds %s', (text, kind) => {
    expect(kinds(text)).toContain(kind);
  });

  it('uses the tenant student-id shape when given', () => {
    expect(kinds('my id is V00123456', { studentId: /\bV\d{8}\b/ })).toEqual(['student_id']);
    expect(kinds('my id is V00123456')).toEqual([]);
  });

  it('leaves ordinary study talk alone (control)', () => {
    for (const text of [
      'Problem 3 on page 214 is hard',
      'Chapter 12 covers the 1848 revolutions',
      'Exam is Tuesday, bring a calculator',
      'Anyone want to review ECON 1010 notes?',
    ]) {
      expect(kinds(text)).toEqual([]);
    }
  });
});

describe('prePostCheck', () => {
  it('allows clean text', () => {
    expect(prePostCheck('Study group for chem tonight?').action).toBe('allow');
  });

  it('requires an edit for high-confidence findings', () => {
    const d = prePostCheck('DM me 615-555-0142');
    expect(d.action).toBe('edit_required');
  });

  it('warns on medium-confidence findings', () => {
    expect(prePostCheck('I am in room 12').action).toBe('warn');
  });

  it('redacts what it found', () => {
    const text = 'call 615-555-0142 or mail a@b.co';
    expect(redact(text, detectPii(text))).toBe('call [removed] or mail [removed]');
  });
});
