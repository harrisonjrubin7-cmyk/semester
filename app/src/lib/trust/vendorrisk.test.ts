import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PARTIES } from './subprocessors';

/**
 * The vendor risk register and the penetration test plan, held to the tree and
 * to the truth.
 *
 * Two ways these documents go wrong, and both are silent:
 *
 *   - **Drift from the subprocessor register.** A party added to
 *     `subprocessors.ts` (which is itself held to the CSP and the Edge
 *     Functions) with no risk row is a vendor nobody will ever assess. So the
 *     rows here must be exactly the parties there.
 *   - **Claiming work that was not done.** A review date typed into a row, or a
 *     plan quietly rewritten to say a test happened, is the kind of sentence a
 *     procurement reviewer quotes back. Nothing under `docs/evidence/` exists
 *     yet, so no row may carry a review date or an owner's sign-off, and the
 *     plan must keep saying that no test has been performed.
 */

const ROOT = join(process.cwd(), '..');
const TRUST = join(ROOT, 'docs', 'trust');
const EVIDENCE = join(ROOT, 'docs', 'evidence');
const register = () => readFileSync(join(TRUST, 'VENDOR-RISK-REGISTER.md'), 'utf8');
const plan = () => readFileSync(join(TRUST, 'PENETRATION-TEST-PLAN.md'), 'utf8');

/** The rows of the register's main table, as cells. */
function rows(): string[][] {
  const text = register();
  const table = text.slice(text.indexOf('## The register'), text.indexOf('## How a review is done'));
  return table
    .split('\n')
    .filter((l) => l.startsWith('| ') && !l.startsWith('| Party') && !l.startsWith('| ---'))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

/** Whether any vendor assessment has been filed. */
const filed = () => existsSync(join(EVIDENCE, 'vendors')) && readdirSync(join(EVIDENCE, 'vendors')).length > 0;

describe('the vendor risk register', () => {
  it('parses a row per party — an empty parse would pass everything below', () => {
    expect(rows().length).toBeGreaterThanOrEqual(10);
    for (const r of rows()) expect(r).toHaveLength(9);
  });

  it('has exactly one row for every party in the subprocessor register, and no other', () => {
    const named = rows().map((r) => r[0]).sort();
    expect(named).toEqual(PARTIES.map((p) => p.name).sort());
  });

  it('classifies each party the way the subprocessor register does', () => {
    const kind = { subprocessor: 'Subprocessor', 'institution-directed': 'Institution-directed', 'student-directed': 'Student-directed' };
    for (const r of rows()) {
      const party = PARTIES.find((p) => p.name === r[0])!;
      expect(r[1], r[0]).toBe(kind[party.kind]);
    }
  });

  it('tiers every Semester subprocessor, and none as student-directed', () => {
    for (const r of rows()) {
      const party = PARTIES.find((p) => p.name === r[0])!;
      if (party.kind === 'subprocessor') expect(['High', 'Medium'], r[0]).toContain(r[6]);
      if (party.kind === 'student-directed') expect(r[6], r[0]).toBe('Student-directed');
    }
  });

  it('claims no review, owner sign-off or verified attestation while nothing is filed', () => {
    if (filed()) return;
    for (const r of rows()) {
      expect(r[8], `${r[0]} has a review date with no assessment filed`).toBe('');
      expect(r[7], `${r[0]} has an owner with no assessment filed`).toBe('');
      expect(r[4], `${r[0]} states an attestation as fact`).not.toMatch(/\bverified\b|\bconfirmed\b/i);
    }
    expect(register()).toContain('**No vendor on this list has been risk-assessed yet.**');
  });

  it('marks every subprocessor attestation as unconfirmed', () => {
    if (filed()) return;
    for (const r of rows()) {
      const party = PARTIES.find((p) => p.name === r[0])!;
      if (party.kind === 'subprocessor') expect(r[4], r[0]).toContain('to confirm');
    }
  });
});

describe('the penetration test plan', () => {
  it('says plainly that no external test has been performed', () => {
    expect(plan()).toContain('**No external penetration test has been performed.**');
    expect(plan()).toMatch(/\| Test performed \| \*\*no\*\* \|/);
  });

  it('covers the surfaces the audit named: the app, Edge Functions, the gateway and RLS', () => {
    const scope = plan().slice(plan().indexOf('## Scope'), plan().indexOf('## Environment'));
    for (const s of ['The web app', 'Row-level security', 'Edge Functions', 'The institutional gateway']) {
      expect(scope).toContain(s);
    }
  });

  it('names every deployable Edge Function in its scope', () => {
    const fns = readdirSync(join(ROOT, 'supabase', 'functions')).filter(
      (d) => !d.startsWith('_') && existsSync(join(ROOT, 'supabase', 'functions', d, 'index.ts')),
    );
    expect(fns.length).toBeGreaterThan(5);
    const scope = plan().slice(plan().indexOf('## Scope'), plan().indexOf('## Environment'));
    const missing = fns.filter((f) => !scope.includes(`\`${f}\``));
    expect(missing).toEqual([]);
  });

  it('has rules of engagement, test accounts, success criteria and remediation deadlines', () => {
    for (const h of ['## Rules of engagement', '## Test accounts', '## Success criteria', '## Remediation commitments']) {
      expect(plan()).toContain(h);
    }
    expect(plan()).toMatch(/\| Critical \| 7 days/);
  });
});
