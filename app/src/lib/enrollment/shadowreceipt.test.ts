import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { shadowReceipt } from './shadowreceipt';

/**
 * One section, SIS enrols, Semester keeps a shadow receipt.
 *
 * Shown red by setting `wroteSeat` to true and `authority` to `semester`:
 * the receipt then claims a seat, and this file fails.
 */

const NOTICE = {
  externalRef: 'sis-ref-1001',
  sectionCode: 'MATH 101',
  term: '2026FA',
  outcome: 'enrolled' as const,
};

describe('a shadow registration receipt', () => {
  it('records the SIS outcome and does not take a seat', () => {
    const receipt = shadowReceipt(NOTICE);
    expect(receipt).toEqual({
      authority: 'sis',
      source: 'imported',
      externalRef: 'sis-ref-1001',
      sectionCode: 'MATH 101',
      term: '2026FA',
      outcome: 'enrolled',
      wroteSeat: false,
    });
    const packed = JSON.stringify(receipt);
    expect(packed).not.toContain('institution_verified');
    expect(packed).not.toContain('registration_enroll');
  });

  it('refuses a notice that is missing the SIS reference', () => {
    expect(() => shadowReceipt({ ...NOTICE, externalRef: '  ' })).toThrow(/SIS reference/);
  });

  it('is not wired to registration_enroll', () => {
    const src = readFileSync(join(import.meta.dirname, 'shadowreceipt.ts'), 'utf8');
    expect(src).not.toContain('registration_enroll');
    expect(src).not.toContain('supabase');
  });
});
