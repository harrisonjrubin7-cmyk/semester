import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SALES_EXIT, SALES_STAGES } from './stages';

/**
 * The revenue-engine documents may not point at files that are not there, may
 * not drop a sales stage, and may not carry the two statements the billing
 * acceptance of 2026-10-03 made false.
 *
 * Each rule has a control beside it: a link extractor that finds nothing, or a
 * stage check against a document that lists none, would pass on an empty probe.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const NEW_DOCS = [
  'docs/commercial/README.md',
  'docs/commercial/ACCOUNT-SCORING-AND-FORECAST.md',
  'docs/commercial/SEGMENT-MOTIONS-AND-BUYING-COMMITTEES.md',
  'docs/commercial/ROI-MODEL-AND-BUSINESS-CASE.md',
  'docs/commercial/BUDGET-AND-PURCHASING-PATH.md',
  'docs/commercial/STAGE-COLLATERAL-AND-HANDOFF.md',
];

/** Repository files a document points at: Markdown link targets (relative to the document) and backticked repo paths. */
function referencedFiles(doc: string, text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\]\(([^)#\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(m[1])) continue;
    out.add(resolve(join(root, dirname(doc)), m[1]));
  }
  for (const m of text.matchAll(/`((?:docs|app|supabase)\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+)`/g)) out.add(join(root, m[1]));
  return [...out];
}

describe('the revenue-engine documents', () => {
  it('extracts links and backticked paths, and tells a present file from a missing one (the control)', () => {
    const sample = referencedFiles('docs/commercial/X.md', 'See [a](../legal-drafts/MISSING.md) and `app/src/lib/gtm/stages.ts`.');
    expect(sample).toHaveLength(2);
    expect(sample.map((p) => existsSync(p))).toEqual([false, true]);
    expect(referencedFiles('docs/commercial/README.md', read('docs/commercial/README.md')).length).toBeGreaterThan(10);
  });

  it('exist, and each carries an evidence state, a claim ceiling and prohibited claims', () => {
    for (const d of NEW_DOCS) {
      expect(existsSync(join(root, d)), d).toBe(true);
      const t = read(d);
      for (const h of ['## Evidence state', '## Claim ceiling', '## Prohibited claims']) expect(t, `${d} lacks ${h}`).toContain(h);
    }
  });

  it('point only at files that exist', () => {
    for (const d of NEW_DOCS) {
      for (const f of referencedFiles(d, read(d))) expect(existsSync(f), `${d} points at ${f}`).toBe(true);
    }
  });

  it('name every sales stage in the pipeline definitions and in the scoring and forecast document', () => {
    for (const d of ['docs/commercial/SALES-PIPELINE-DEFINITIONS.md', 'docs/commercial/ACCOUNT-SCORING-AND-FORECAST.md']) {
      const t = read(d);
      for (const s of SALES_STAGES) expect(t, `${d} omits ${s}`).toContain(`\`${s}\``);
    }
    // The control: a stage the document does not list is caught.
    expect(read('docs/commercial/ACCOUNT-SCORING-AND-FORECAST.md')).not.toContain('`no_such_stage`');
  });

  it('covers each coded exit gate in the pipeline definitions', () => {
    const t = read('docs/commercial/SALES-PIPELINE-DEFINITIONS.md');
    expect(Object.keys(SALES_EXIT).length).toBeGreaterThan(0);
    for (const s of Object.keys(SALES_EXIT)) expect(t, s).toContain(`\`${s}\``);
  });

  it('approves no stage probability', () => {
    const t = read('docs/commercial/ACCOUNT-SCORING-AND-FORECAST.md');
    const rows = t.split('\n').filter((l) => /^\| .*\| (not approved|not applicable|0) \|/.test(l));
    expect(rows.length).toBeGreaterThan(0);
    expect(t).toMatch(/probability for every stage is \*\*not approved\*\*/);
  });
});

describe('statements the 2026-10-03 billing acceptance made false', () => {
  it('no longer appear in the commercial core or the market-leadership document', () => {
    expect(read('docs/COMMERCIAL-CORE.md')).not.toMatch(/Stripe is wired but not connected/);
    expect(read('docs/MARKET-LEADERSHIP.md')).not.toMatch(/Billing stays out: no Stripe keys, checkout or webhooks/);
    expect(read('docs/MARKET-LEADERSHIP.md')).not.toMatch(/D-009: billing stays out; no checkout, keys or webhooks without/);
  });

  it('cite the acceptance record, which exists', () => {
    expect(existsSync(join(root, 'docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md'))).toBe(true);
    expect(read('docs/COMMERCIAL-CORE.md')).toContain('BILLING-LIVE-ACCEPTANCE-2026-10-03.md');
  });
});
