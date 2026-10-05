import { describe, expect, it } from 'vitest';
import { DOMAIN_SPECS } from './domain-specs';
import { templates } from './templates';

describe('the files an institution fills in', () => {
  it('has the four sheets, with one row per entity and one per field, plus its header', () => {
    for (const d of DOMAIN_SPECS) {
      const t = templates(d);
      expect(Object.keys(t).sort()).toEqual(['cleansing.csv', 'excluded.csv', 'inventory.csv', 'mapping.csv']);
      expect(t['inventory.csv'].trimEnd().split('\n')).toHaveLength(d.entities.length + 1);
      expect(t['mapping.csv'].trimEnd().split('\n')).toHaveLength(d.entities.reduce((n, e) => n + e.fields.length, 0) + 1);
    }
  });

  it('shows on the mapping sheet which fields need an approval, so nobody finds out at approval time', () => {
    const sheet = templates(DOMAIN_SPECS.find((d) => d.id === 'academic_records')!)['mapping.csv'];
    expect(sheet).toContain('course_result,grade,T3,needs:scope.migration.academic_records.course_result');
    expect(sheet).toContain('course_result,course_code,T0,in_scope');
  });

  it('quotes anything a comma could break', () => {
    expect(templates(DOMAIN_SPECS.find((d) => d.id === 'identity')!)['excluded.csv']).toContain('"');
  });
});
