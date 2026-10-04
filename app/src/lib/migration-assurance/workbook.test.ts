import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOMAINS } from './domains';
import { EVIDENCE_KINDS, ROLES, STAGES } from './lifecycle';
import { approvalsNeeded } from './scope';
import { renderAll, renderWorkbook, templates } from './workbook';

const docs = resolve(__dirname, '../../../../docs/migration');
const WORKBOOKS = resolve(docs, 'WORKBOOKS.md');
const METHOD = readFileSync(resolve(docs, 'METHODOLOGY.md'), 'utf8');

describe('the workbooks', () => {
  /*
   * Generated, so the document an institution signs cannot say something the
   * validator does not check. `MIGRATION_DOCS=write` regenerates it.
   */
  it('are the committed document, byte for byte', () => {
    if (process.env.MIGRATION_DOCS === 'write') writeFileSync(WORKBOOKS, renderAll());
    expect(existsSync(WORKBOOKS)).toBe(true);
    expect(readFileSync(WORKBOOKS, 'utf8')).toBe(renderAll());
  });

  it('give every domain every section, with every check and every acceptance criterion it declares', () => {
    for (const d of DOMAINS) {
      const w = renderWorkbook(d);
      for (const heading of ['Source inventory', 'Field mapping and scope', 'Not migrated', 'Cleansing rules', 'Transformation rules', 'Validation', 'Thresholds', 'Parallel run', 'Exceptions', 'Acceptance criteria']) expect(w).toContain(heading);
      for (const s of d.invariants) expect(w, s.id).toContain(`\`${s.id}\``);
      for (const a of d.acceptance) expect(w).toContain(a);
      for (const x of d.excluded) expect(w).toContain(x.handling);
      for (const k of approvalsNeeded(d)) expect(w).toContain(k);
    }
  });

  it('say that a clean row count is not success', () => {
    expect(renderAll()).toContain('Row-count equality is a precondition and earns nothing');
  });

  it('are filled in from templates that carry what is already known', () => {
    for (const d of DOMAINS) {
      const t = templates(d);
      expect(Object.keys(t).sort()).toEqual(['cleansing.csv', 'excluded.csv', 'inventory.csv', 'mapping.csv']);
      expect(t['inventory.csv'].split('\n').length).toBe(d.entities.length + 2);
      expect(t['mapping.csv'].split('\n').length).toBe(d.entities.reduce((n, e) => n + e.fields.length, 0) + 2);
    }
  });
});

describe('the methodology', () => {
  // Line wrapping is a prose matter; the figures are what must agree.
  const flat = METHOD.replace(/\s+/g, ' ');

  it('names every stage, evidence kind, role and domain the code has', () => {
    const missing = [...STAGES, ...EVIDENCE_KINDS, ...Object.keys(ROLES), ...DOMAINS.map((d) => d.id)].filter((x) => !METHOD.includes(`\`${x}\``));
    expect(missing).toEqual([]);
  });

  it('states the thresholds the code enforces', async () => {
    const { POLICY } = await import('./quality');
    const { SLA_HOURS, MAX_WAIVER_DAYS } = await import('./exceptions');
    const { MIN_CLEAN } = await import('./parallel');
    const { MIN_ROLLBACK_WINDOW_HOURS, REHEARSAL_MARGIN } = await import('./lifecycle');
    expect(POLICY.high.majorMaxRate).toBe(0);
    expect(flat).toContain(`**${SLA_HOURS.critical} hours (critical), ${SLA_HOURS.major} hours (major), ${SLA_HOURS.minor / 24} days (minor)**`);
    expect(flat).toContain(`${MAX_WAIVER_DAYS} days`);
    expect(flat).toContain(`**${MIN_CLEAN.high} clean cycles in a row (high stakes) or ${MIN_CLEAN.standard} (standard)**`);
    expect(flat).toContain(`**at least ${MIN_ROLLBACK_WINDOW_HOURS} hours**`);
    expect(flat).toContain(`**${REHEARSAL_MARGIN}× the duration must fit the cutover window**`);
  });

  it('says where it sits beside the Migration Center, and that it does not replace it', () => {
    expect(flat).toContain('does not replace the Center');
    expect(flat).toContain('center-bridge.ts');
  });

  it('never claims what is not built', () => {
    expect(flat).toContain('The evidence ledger and exception queue are files, not rows');
    expect(flat).toContain('never connects to a source system or writes to production');
  });
});
