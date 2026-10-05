import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGISTER } from '../masterregister';
import { EDUCATION_DATA_MAP } from './education-data-map';
import { AUDIT_REQUIREMENTS, auditEvidencePack, auditRows, auditSummary, filterAudit, rfpCsv, RFP_QUESTIONS } from './standards-audit';

describe('standards readiness is evidence-based', () => {
  it('maps only real controls and repository evidence, with no legacy privacy IDs', () => {
    expect(AUDIT_REQUIREMENTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(AUDIT_REQUIREMENTS.map((r) => r.id)).size).toBe(AUDIT_REQUIREMENTS.length);
    for (const r of AUDIT_REQUIREMENTS) {
      for (const id of r.rows) expect(REGISTER.some((entry) => entry.id === id), id).toBe(true);
      for (const c of r.controls) expect(c).toMatch(/^(AC|AU|CA|CM|CP|IA|IR|MP|PL|PT|RA|SA|SC|SI|SR)-\d+$/);
    }
    for (const row of auditRows()) for (const e of row.evidence) expect(existsSync(resolve('..', e.path)), e.path).toBe(true);
  });

  it('unknown references fail closed and a strong average cannot hide a mandatory blocker', () => {
    const unknown = auditRows([{ ...AUDIT_REQUIREMENTS[0], rows: ['NONEXISTENT-001'] }])[0];
    expect(unknown.maturity).toBe(0);
    const ready = { ...unknown, maturity: 4 as const, mode: 'Observe' as const };
    const blocked = { ...unknown, id: 'weak-write', mode: 'Operate' as const, maturity: 2 as const };
    const s = auditSummary([...Array.from({ length: 30 }, () => ready), blocked], 'Operate');
    expect(s.percent).toBeGreaterThan(90);
    expect(s.blockers.map((r) => r.id)).toEqual(['weak-write']);
    expect(s.capabilityReady).toBe(false);
    expect(auditSummary([ready], 'Observe').tenantAuthorized).toBe(false);
    expect(auditSummary([], 'Operate').capabilityReady).toBe(false);
  });

  it('shows lowest required maturity, scopes modes and never scores filtered rows as the full assessment', () => {
    const rows = auditRows();
    const example = auditRows([{ ...AUDIT_REQUIREMENTS[0], rows: ['INT-002', 'INT-003'] }])[0];
    expect(example.maturity).toBe(0);
    expect(auditSummary(rows, 'Observe').blockers.every((r) => r.mode === 'Observe')).toBe(true);
    expect(auditSummary(rows, 'Operate').blockers.some((r) => r.id === 'lti-ags')).toBe(true);
    expect(filterAudit(rows, { search: 'Deep Linking' }).some((r) => r.id === 'lti-deep-link')).toBe(true);
    expect(filterAudit(rows, { family: 'PT', standard: 'LTI AGS' }).map((r) => r.id)).toEqual(['lti-ags']);
    expect(filterAudit(rows, { search: 'does-not-exist-unique' })).toEqual([]);
    expect(filterAudit(rows, { owner: 'Identity' }).map((r) => r.id)).toEqual(['identity']);
  });

  it('exports all requirements, signoffs and 65 unanswered questionnaire items', () => {
    const pack = JSON.parse(auditEvidencePack(new Date('2026-10-01T15:00:00Z')));
    expect(pack.requirements).toHaveLength(AUDIT_REQUIREMENTS.length);
    expect(pack.signoffs.length).toBeGreaterThan(0);
    expect(pack.summaries.Operate.tenantAuthorized).toBe(false);
    expect(pack.questionnaire).toHaveLength(65);
    expect(pack.questionnaire.every((q: { response: string; appliesToProduction: null }) => q.response === '' && q.appliesToProduction === null)).toBe(true);
    expect(pack.generatedAt).toBe('2026-10-01T15:00:00.000Z');
    expect(RFP_QUESTIONS.map((q) => q.id)).toEqual(Array.from({ length: 65 }, (_, i) => `RFP-${String(i + 1).padStart(2, '0')}`));
    expect(rfpCsv().split('\r\n')).toHaveLength(66);
    expect(rfpCsv()).toContain('Evidence date');
  });

  it('covers sensitive education domains and labels the audit as product capability', () => {
    expect(EDUCATION_DATA_MAP).toHaveLength(16);
    expect(EDUCATION_DATA_MAP.find((r) => r.entity === 'Performance')?.classification).toBe('T4');
    expect(EDUCATION_DATA_MAP.find((r) => r.entity === 'Sensitive attachments')?.classification).toBe('T6');
    const view = readFileSync('src/components/institutional/StandardsAudit.tsx', 'utf8');
    expect(view).toContain('auditSummary(rows, mode)');
    expect(view).not.toContain('auditSummary(shown');
    expect(view).toContain('not authorized');
  });
});
