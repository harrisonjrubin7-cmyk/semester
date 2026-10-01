import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOT_BUILT, NOTHING_IS_LIVE, PARTS, PRICE, TODAY, WAITS_ON } from './edition';

const root = join(import.meta.dirname, '../../../..');

describe('advancement', () => {
  it('has the brief’s three parts and every one is in preparation, not certified', () => {
    expect(PARTS.map((p) => p.id)).toEqual(['constituents', 'giving', 'staff']);
    for (const p of PARTS) expect(p.status).toBe('in-preparation');
  });

  it('rests only on files that exist, and what it names is there', () => {
    for (const p of PARTS) {
      for (const r of p.restsOn) expect(existsSync(join(root, r.path)), `${p.id} rests on ${r.path}`).toBe(true);
    }
    const mentor = readFileSync(join(root, PARTS[0].restsOn[0].path), 'utf8');
    expect(mentor).toContain('create table if not exists public.alumni_mentor_offers');
  });

  it('is in preparation only because its tables and its check suite are in the tree, and holds no score', () => {
    // The row moves off "planned" only when the tables land with their suite (DO-NOT-BUILD rule 13).
    const sql = readFileSync(join(root, 'supabase/migrations/20261001100000_advancement.sql'), 'utf8');
    for (const t of ['alumni_profiles', 'advancement_donors', 'advancement_gifts', 'advancement_receipts', 'advancement_refunds']) {
      expect(sql, t).toMatch(new RegExp(`create table if not exists public\\.${t}\\b`));
    }
    expect(existsSync(join(root, 'supabase/advancement.check.sql'))).toBe(true);
    // Refused, not deferred: nothing that scores, ranks or screens a donor or an alumnus.
    expect(sql).not.toMatch(/create table (if not exists )?(public\.)?\w*(score|wealth|capacity_rating|propensity|rank)\w*\b/i);
    expect(sql).not.toMatch(/\b(wealth_score|propensity|capacity_rating)\b/i);
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
