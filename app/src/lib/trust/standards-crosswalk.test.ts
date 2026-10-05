import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STANDARD_CONTROLS, crosswalkExport, filterControls } from './standards-crosswalk';

describe('1EdTech / NIST engineering crosswalk', () => {
  it('links existing implementations and verification files for every mapping', () => {
    expect(new Set(STANDARD_CONTROLS.map(r => r.id)).size).toBe(STANDARD_CONTROLS.length);
    for (const row of STANDARD_CONTROLS) {
      for (const path of [...row.code, ...row.tests]) expect(existsSync(resolve(import.meta.dirname, '../../../..', path)), path).toBe(true);
      expect(row.controls.every(c => /^(AC|AU|IA|SC|SI|CM|CA|PT)-\d+$/.test(c))).toBe(true);
      expect(row.activation.length).toBeGreaterThan(40);
      expect(row.status).toBe('Implementation present; operating evidence required');
    }
  });
  it('searches controls and lifecycle evidence and combines filters', () => {
    expect(filterControls('PT-4').map(r => r.id)).toEqual(['optional-consent']);
    expect(filterControls('rollback', 'ags').map(r => r.id)).toEqual(['ags']);
    expect(filterControls('PT-4', 'ags')).toHaveLength(0);
    expect(filterControls('never-match-this')).toHaveLength(0);
  });
  it('exports only the visible mappings and preserves the assessment limitation', () => {
    const file = JSON.parse(crosswalkExport(filterControls('', 'ags')));
    expect(file.controls).toHaveLength(1);
    expect(file.controls[0].id).toBe('ags');
    expect(file.interpretation).toContain('no compliance certification');
  });
});
