import { describe, expect, it } from 'vitest';
import { aidCapabilities, dollars, parseComponents, toCents } from './client';

describe('which aid capabilities a person holds', () => {
  const grants = [
    { capability: 'aid:propose', scopeKind: 'school', scopeId: 'vu' },
    { capability: 'aid:approve', scopeKind: 'school', scopeId: 'other' },
    { capability: 'aid:read', scopeKind: 'course', scopeId: 'vu' },
    { capability: 'admissions:read', scopeKind: 'school', scopeId: 'vu' },
  ];
  it('reads only aid capabilities over exactly this school', () => {
    expect([...aidCapabilities(grants, 'vu')]).toEqual(['aid:propose']);
    expect(aidCapabilities(grants, '').size).toBe(0);
  });
});

describe('amounts', () => {
  it('turns dollars as typed into whole cents', () => {
    expect(toCents('3,000.00')).toBe(300000);
    expect(toCents('$550')).toBe(55000);
    expect(toCents('12.5')).toBe(1250);
  });
  it('refuses what is not an amount', () => {
    for (const bad of ['', '0', '-5', '12.345', 'ten', '1e3', '99999999999']) expect(toCents(bad), bad).toBeNull();
  });
  it('writes cents as dollars', () => {
    expect(dollars(300000)).toBe('$3,000.00');
    expect(dollars(5)).toBe('$0.05');
  });
});

describe('components as an officer types them', () => {
  it('reads kinds and amounts', () => {
    expect(parseComponents('pell | grant | Pell Grant | 3,000.00\nloan1 | loan | Direct Subsidized Loan | 5500')).toEqual({
      components: [
        { key: 'pell', kind: 'grant', name: 'Pell Grant', amount_cents: 300000 },
        { key: 'loan1', kind: 'loan', name: 'Direct Subsidized Loan', amount_cents: 550000 },
      ],
    });
  });
  it('says the first bad line by number', () => {
    expect(parseComponents('')).toEqual({ error: 'Add at least one component.' });
    expect(parseComponents('pell | grant | Pell')).toHaveProperty('error', expect.stringContaining('Line 1'));
    expect(parseComponents('pell | gift | Pell | 100')).toEqual({ error: 'Line 1: the kind is grant, scholarship, loan or work_study.' });
    expect(parseComponents('pell | grant | Pell | lots')).toEqual({ error: 'Line 1: “lots” is not an amount in dollars.' });
    expect(parseComponents('a | grant | A | 1\na | loan | B | 2')).toEqual({ error: 'Each component needs its own key.' });
  });
});
