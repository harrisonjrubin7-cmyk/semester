import { describe, expect, it } from 'vitest';
import { pieceName } from './Equations';

describe('equation-piece accessible names', () => {
  it('includes the symbol painted on the button before its plain-language meaning', () => {
    expect(pieceName({ label: 'a⁄b', says: 'Fraction' })).toBe('a⁄b: Fraction');
    expect(pieceName({ label: 'x²', says: 'Power' })).toBe('x²: Power');
    expect(pieceName({ label: '√x', says: 'Root' })).toBe('√x: Root');
  });
});
