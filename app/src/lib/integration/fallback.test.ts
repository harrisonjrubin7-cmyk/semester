import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROVIDER_DOMAINS } from './catalog';
import {
  CONNECTOR_FAMILIES, NATIVE_FALLBACK, familyOf, fallbackProblems, type ConnectorFamily,
} from './fallback';

/** The keys of the `SCREENS` table in screens.tsx, read the way pageframe.test.ts reads it. */
function screenIds(): Set<string> {
  const source = readFileSync(resolve(__dirname, '../../screens.tsx'), 'utf8');
  const table = /export const SCREENS[^=]*= \{([\s\S]*?)\n\};/.exec(source)?.[1] ?? '';
  return new Set([...table.matchAll(/^\s*(\w+): \w+,$/gm)].map((m) => m[1]));
}

describe('what keeps working when a connector is off', () => {
  const screens = screenIds();
  const routeExists = (r: string) => screens.has(r);

  it('reads the screen table (a control on the reader)', () => {
    // A reader that matched nothing would make every route below "exist".
    expect(screens.size).toBeGreaterThan(50);
    expect(screens.has('courses')).toBe(true);
    expect(screens.has('not-a-screen')).toBe(false);
  });

  it('gives every provider domain a native capability, a real screen, and exactly one family', () => {
    expect(fallbackProblems(NATIVE_FALLBACK, CONNECTOR_FAMILIES, routeExists)).toEqual([]);
    for (const d of PROVIDER_DOMAINS) expect(familyOf(d), d).toBeDefined();
  });

  it('notices a route that is not a screen', () => {
    const broken = { ...NATIVE_FALLBACK, sis: { ...NATIVE_FALLBACK.sis, nativeRoute: 'registar' } };
    expect(fallbackProblems(broken, CONNECTOR_FAMILIES, routeExists)).toEqual(['sis: registar is not a screen']);
  });

  it('notices a domain with no fallback, and an empty one', () => {
    const { lms: _gone, ...rest } = NATIVE_FALLBACK;
    expect(fallbackProblems(rest, CONNECTOR_FAMILIES, routeExists)).toContain('lms: no native fallback');
    const empty = { ...NATIVE_FALLBACK, lms: { ...NATIVE_FALLBACK.lms, adds: ' ' } };
    expect(fallbackProblems(empty, CONNECTOR_FAMILIES, routeExists)).toContain('lms: fallback is incomplete');
  });

  it('notices a domain claimed by two families, or by none', () => {
    const twice: ConnectorFamily[] = [...CONNECTOR_FAMILIES, { id: 'extra', label: 'Extra', domains: ['lms'], reach: 'tenant_pipeline' }];
    expect(fallbackProblems(NATIVE_FALLBACK, twice, routeExists)).toContain('lms: belongs to 2 families, not one');
    const without = CONNECTOR_FAMILIES.filter((f) => f.id !== 'lms');
    expect(fallbackProblems(NATIVE_FALLBACK, without, routeExists)).toContain('lms: belongs to 0 families, not one');
  });

  it('makes a family outside the pipeline say why, and what it augments', () => {
    const silent: ConnectorFamily[] = [
      ...CONNECTOR_FAMILIES.filter((f) => f.id !== 'email'),
      { id: 'email', label: 'Email', domains: [], reach: 'student_credential' },
    ];
    const problems = fallbackProblems(NATIVE_FALLBACK, silent, routeExists);
    expect(problems).toContain('email: a family with no domain must name the native capability it augments');
    expect(problems).toContain('email: outside the pipeline, so it must say why');
  });

  it('is honest about email and reporting: neither is a tenant connector today', () => {
    const email = CONNECTOR_FAMILIES.find((f) => f.id === 'email');
    const reporting = CONNECTOR_FAMILIES.find((f) => f.id === 'reporting');
    expect(email?.reach).toBe('student_credential');
    expect(reporting?.reach).toBe('not_yet_modelled');
    expect(email?.native?.nativeRoute).toBe('mail');
    expect(reporting?.blockedBy).toMatch(/writeback/);
  });

  it('keeps payment to links and dates: no amount is ever mapped', () => {
    const payment = CONNECTOR_FAMILIES.find((f) => f.id === 'payment');
    expect(payment?.domains).toEqual(['erp', 'bursar', 'financial_aid']);
    expect(payment?.blockedBy).toMatch(/amount is never mapped/);
  });
});
