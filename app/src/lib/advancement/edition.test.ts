import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOT_BUILT, NOTHING_IS_LIVE, PARTS, PRICE, TODAY, WAITS_ON } from './edition';

const root = join(import.meta.dirname, '../../../..');

describe('advancement', () => {
  it('has the brief’s three parts and every one is planned', () => {
    expect(PARTS.map((p) => p.id)).toEqual(['constituents', 'giving', 'staff']);
    for (const p of PARTS) expect(p.status).toBe('planned');
  });

  it('rests only on files that exist, and what it names is there', () => {
    for (const p of PARTS) {
      for (const r of p.restsOn) expect(existsSync(join(root, r.path)), `${p.id} rests on ${r.path}`).toBe(true);
    }
    const mentor = readFileSync(join(root, PARTS[0].restsOn[0].path), 'utf8');
    expect(mentor).toContain('create table if not exists public.alumni_mentor_offers');
  });

  it('is not built: no gift, donor, pledge, giving-campaign or advancement table exists', () => {
    // If a table for this ever lands, a row here must move off "planned" in the same change.
    const dir = join(root, 'supabase/migrations');
    const sql = readdirSql(dir);
    // The table's own name, not a column inside it (dining has a donations pool, and the go-to-market team has marketing campaigns; neither is this).
    // A record of who graduated and the consents they give is not money, and is allowed to land on its own.
    expect(sql).not.toMatch(/create table (if not exists )?(public\.)?(?!gtm_)\w*(gift|donor|pledge|campaign|fundrais|advancement)\w*\b/i);
  });

  it('refuses wealth screening and donor scoring, and says which rule', () => {
    expect(NOT_BUILT.map((n) => n.what)).toEqual(['Wealth screening', 'Predictive donor scoring']);
    for (const n of NOT_BUILT) expect(n.why).toMatch(/rule 3|same rule/);
    const rules = readFileSync(join(root, 'docs/DO-NOT-BUILD.md'), 'utf8');
    expect(rules).toContain('No unexplained score, risk label or recommendation');
  });

  it('does not decide how a gift is paid, or a price', () => {
    const text = JSON.stringify(PARTS) + NOTHING_IS_LIVE + PRICE + WAITS_ON.join(' ');
    expect(text).not.toMatch(/stripe|paypal|braintree|\$\d/i);
    expect(WAITS_ON.join(' ')).toMatch(/no money moves through Semester \(D-146\)/);
    expect(PRICE).toMatch(/No price has been set/);
  });

  it('says nothing of giving is something a graduate can do today', () => {
    for (const t of TODAY) expect(t).not.toMatch(/gift|donat|give|giving|pledge/i);
    expect(NOTHING_IS_LIVE).toMatch(/No gift has been taken/);
  });
});

function readdirSql(dir: string): string {
  const { readdirSync } = require('node:fs') as typeof import('node:fs');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
}
