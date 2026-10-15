import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { closedJourneys, journeyRoleFaults, ROLE_JOURNEYS } from './rolejourney';

describe('role journeys', () => {
  it('has one row for every role, and no row for a role that does not exist', () => {
    expect(journeyRoleFaults()).toEqual([]);
  });

  it('only opens a screen that role is allowed to open', () => {
    expect(closedJourneys().map((row) => row.role)).toEqual([]);
  });

  it('names screens that exist', () => {
    const src = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');
    const start = src.indexOf('export type Screen =');
    const end = src.indexOf('export type ReportGrain');
    if (start < 0 || end < 0) throw new Error('missing Screen union');
    const known = new Set([...src.slice(start, end).matchAll(/\| '([A-Za-z0-9]+)'/g)].map((match) => match[1]));
    for (const row of ROLE_JOURNEYS) {
      if (row.screen) expect(known.has(row.screen), row.role).toBe(true);
    }
  });

  it('does not describe a payer workspace that is not there', () => {
    const payer = ROLE_JOURNEYS.find((row) => row.role === 'payer');
    expect(payer?.screen).toBeNull();
    expect(payer?.firstAction).toMatch(/no payer workspace/i);
  });
});
