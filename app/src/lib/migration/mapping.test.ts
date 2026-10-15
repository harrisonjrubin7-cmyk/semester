import { describe, expect, it } from 'vitest';
import { applyMapping } from './mapping.ts';
import type { MappingSpec } from './mapping.ts';

const spec = (over: Partial<MappingSpec> = {}): MappingSpec => ({
  version: 'v3',
  rules: [
    { source: 'STUDENT_ID', target: 'person_key', required: true, cleanse: ['trim'] },
    { source: 'GRADE', target: 'grade', cleanse: ['trim', 'upper'], codeTable: { A: 'A', W: 'withdrawn', I: 'incomplete' } },
    { source: 'POSTED', target: 'posted_on', cleanse: ['trim', 'null_tokens', 'date_iso'] },
    { source: 'CHARGE', target: 'amount_minor', cleanse: ['trim', 'minor_units'] },
  ],
  drops: [{ field: 'LEGACY_FLAG', reason: 'internal batch marker, no meaning outside the source' }],
  ...over,
});
const row = { STUDENT_ID: ' 123456 ', GRADE: ' w ', POSTED: '2025-05-10', CHARGE: '1,234.50', LEGACY_FLAG: 'x' };

describe('mapping and cleansing', () => {
  it('maps, cleanses and records a lineage line per field', () => {
    const t = applyMapping(row, spec());
    expect(t.issues).toEqual([]);
    expect(t.target).toEqual({ person_key: '123456', grade: 'withdrawn', posted_on: '2025-05-10', amount_minor: 123450 });
    expect(t.lineage.find((l) => l.target === 'grade')).toEqual({ target: 'grade', source: 'GRADE', steps: ['trim', 'upper', 'code_table'], mappingVersion: 'v3' });
  });

  it('is deterministic: the same row and spec give the same result', () => {
    expect(applyMapping(row, spec())).toEqual(applyMapping({ ...row }, spec()));
  });

  it('flags a source field that is neither mapped nor declared dropped, on every row', () => {
    const t = applyMapping({ ...row, MIDDLE_NAME: 'Q' }, spec());
    expect(t.issues).toEqual([{ code: 'unmapped_source_field', field: 'MIDDLE_NAME' }]);
    expect(applyMapping(row, spec({ drops: [] })).issues).toEqual([{ code: 'unmapped_source_field', field: 'LEGACY_FLAG' }]);
  });

  it('never defaults an unknown code', () => {
    const t = applyMapping({ ...row, GRADE: 'X' }, spec());
    expect(t.issues).toEqual([{ code: 'unknown_code', field: 'GRADE' }]);
    expect('grade' in t.target).toBe(false);
  });

  it('reads a slash date only when the spec says in which order, and rejects impossible dates', () => {
    expect(applyMapping({ ...row, POSTED: '03/04/2025' }, spec()).issues).toEqual([{ code: 'bad_date', field: 'POSTED' }]);
    expect(applyMapping({ ...row, POSTED: '03/04/2025' }, spec({ slashDates: 'month_first' })).target.posted_on).toBe('2025-03-04');
    expect(applyMapping({ ...row, POSTED: '03/04/2025' }, spec({ slashDates: 'day_first' })).target.posted_on).toBe('2025-04-03');
    expect(applyMapping({ ...row, POSTED: '2025-02-30' }, spec()).issues).toEqual([{ code: 'bad_date', field: 'POSTED' }]);
  });

  it('turns money into integer minor units and refuses anything it would have to round', () => {
    for (const [raw, minor] of [['0.5', 50], ['$12', 1200], ['-3.07', -307], ['1,000', 100000]] as const) {
      expect(applyMapping({ ...row, CHARGE: raw }, spec()).target.amount_minor).toBe(minor);
    }
    for (const raw of ['1.005', '12,34', 'abc', '1.2.3']) {
      expect(applyMapping({ ...row, CHARGE: raw }, spec()).issues).toEqual([{ code: 'bad_amount', field: 'CHARGE' }]);
    }
  });

  it('treats declared null tokens as no value and enforces required', () => {
    expect(applyMapping({ ...row, POSTED: 'N/A' }, spec()).target.posted_on).toBeNull();
    expect(applyMapping({ ...row, STUDENT_ID: '  ' }, spec()).issues).toEqual([{ code: 'missing_required', field: 'STUDENT_ID' }]);
  });
});
