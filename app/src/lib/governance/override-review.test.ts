import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_OVERRIDE_PATTERNS,
  OVERRIDE_PATTERN_COLUMNS,
  loadOverridePatterns,
  readOverridePatterns,
  selectOverridePatternRows,
  type OverridePatternDatabaseRow,
} from './override-review';

const row = (overrides: Partial<OverridePatternDatabaseRow> = {}): OverridePatternDatabaseRow => ({
  tenant_id: 'northstar',
  domain: 'academic_record',
  rule_ref: 'grade',
  overrides: 4,
  people: 2,
  first_at: '2026-09-01T12:00:00.000000+00:00',
  last_at: '2026-10-14T09:30:00+00:00',
  last_90_days: 4,
  recurring: true,
  ...overrides,
});

describe('override-pattern review rows', () => {
  it('keeps only same-tenant rows that satisfy the aggregate view schema', () => {
    expect(readOverridePatterns([
      row(),
      row({ tenant_id: 'another-school', rule_ref: 'cross_tenant' }),
      row({ domain: 'not-a-domain', rule_ref: 'unknown_domain' }),
      row({ rule_ref: '<img src=x onerror=alert(1)>' }),
      row({ rule_ref: 'x'.repeat(81) }),
    ], 'northstar')).toEqual([{
      domain: 'academic_record',
      ruleRef: 'grade',
      overrides: 4,
      people: 2,
      firstAt: Date.parse('2026-09-01T12:00:00.000000+00:00'),
      lastAt: Date.parse('2026-10-14T09:30:00+00:00'),
      last90Days: 4,
      recurring: true,
    }]);
  });

  it('rejects unavailable or inconsistent counts instead of turning them into zero', () => {
    const bad = [
      row({ overrides: 0 }),
      row({ overrides: -1 }),
      row({ overrides: 1.5 }),
      row({ overrides: Number.MAX_SAFE_INTEGER + 1 }),
      row({ people: -1 }),
      row({ people: 5 }),
      row({ last_90_days: -1 }),
      row({ last_90_days: 5 }),
      row({ last_90_days: 2, recurring: true }),
      row({ last_90_days: 3, recurring: false }),
      { ...row(), people: null },
      { ...row(), last_90_days: '4' },
    ];
    expect(readOverridePatterns(bad, 'northstar')).toEqual([]);
  });

  it('uses an unavailable date for invalid or normalized timestamps', () => {
    expect(readOverridePatterns([
      row({ first_at: '2026-02-30T12:00:00Z', last_at: 'Oct 14, 2026' }),
      row({ rule_ref: 'backwards', first_at: '2026-10-14T12:00:00Z', last_at: '2026-10-01T12:00:00Z' }),
    ], 'northstar')).toEqual([
      expect.objectContaining({ ruleRef: 'grade', firstAt: null, lastAt: null }),
      expect.objectContaining({ ruleRef: 'backwards', firstAt: null, lastAt: null }),
    ]);
  });

  it('never returns more than the bounded display limit', () => {
    const rows = Array.from({ length: MAX_OVERRIDE_PATTERNS + 7 }, (_, index) =>
      row({ rule_ref: `rule_${index}` }));
    expect(readOverridePatterns(rows, 'northstar')).toHaveLength(MAX_OVERRIDE_PATTERNS);
  });
});

describe('override-pattern query', () => {
  it('selects aggregate metadata only, scopes the tenant, orders newest first and caps the result', async () => {
    const calls: unknown[][] = [];
    const query = {
      select(columns: string) {
        calls.push(['select', columns]);
        return this;
      },
      eq(column: string, value: string) {
        calls.push(['eq', column, value]);
        return this;
      },
      order(column: string, options: { ascending: boolean }) {
        calls.push(['order', column, options]);
        return this;
      },
      async limit(limit: number) {
        calls.push(['limit', limit]);
        return { data: [row()], error: null };
      },
    };
    const client = { from: vi.fn((table: string) => {
      calls.push(['from', table]);
      return query;
    }) } as unknown as SupabaseClient;

    const result = await selectOverridePatternRows('northstar', async () => client);

    expect(result.data).toEqual([row()]);
    expect(calls).toEqual([
      ['from', 'override_patterns'],
      ['select', OVERRIDE_PATTERN_COLUMNS],
      ['eq', 'tenant_id', 'northstar'],
      ['order', 'last_at', { ascending: false }],
      ['limit', MAX_OVERRIDE_PATTERNS],
    ]);
    expect(OVERRIDE_PATTERN_COLUMNS).not.toMatch(/subject_ref|overridden_by|reason|outcome|source_ref/);
  });

  it('returns parsed rows and replaces provider errors with a stable message', async () => {
    await expect(loadOverridePatterns('northstar', async () => ({ data: [row()], error: null })))
      .resolves.toEqual([expect.objectContaining({ ruleRef: 'grade' })]);

    await expect(loadOverridePatterns('northstar', async () => ({
      data: null,
      error: { message: 'raw provider detail with tenant-123 and a cursor' },
    }))).rejects.toThrow('Override patterns could not be loaded.');
  });
});
