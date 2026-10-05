import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SOURCE_LABELS,
  SOURCE_MEANING,
  SOURCE_TEXT,
  freshnessLine,
  freshnessState,
  isSourceLabel,
  sourceLine,
  wantsAttention,
  TRUST_KINDS,
  TRUST_TEXT,
  TRUST_GLYPH,
  TRUST_MEANING,
} from './source';

/**
 * One set of source labels, the same on the device and in the database.
 *
 * The migration is read rather than restated: a list typed out a second time
 * here would agree with this file by construction and prove nothing.
 */
const MIGRATION = new URL(
  '../../../supabase/migrations/20260926150000_expansion_roles_and_features.sql',
  import.meta.url,
);

function enumsIn(sql: string): string[][] {
  const found: string[][] = [];
  for (const m of sql.matchAll(/source_label\s+in\s*\(([^)]*)\)/g)) {
    found.push([...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));
  }
  return found;
}

describe('the labels are the database’s labels', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  const enums = enumsIn(sql);

  it('finds the check constraints it compares against', () => {
    // Control: a regex that matched nothing would make the next test vacuous.
    expect(enums.length).toBeGreaterThanOrEqual(2);
  });

  it('matches every five-value source constraint exactly', () => {
    const full = enums.filter((e) => e.length === 5);
    expect(full.length).toBeGreaterThanOrEqual(2);
    for (const e of full) expect([...e].sort()).toEqual([...SOURCE_LABELS].sort());
  });

  it('never allows a label in the database that the app cannot name', () => {
    for (const e of enums) for (const v of e) expect(isSourceLabel(v), v).toBe(true);
  });
});

describe('what a student reads', () => {
  it('names every label, and explains every label', () => {
    for (const l of SOURCE_LABELS) {
      expect(SOURCE_TEXT[l].length, l).toBeGreaterThan(0);
      expect(SOURCE_MEANING[l].length, l).toBeGreaterThan(0);
    }
  });

  it('only says "verified" for what the institution verified', () => {
    for (const l of SOURCE_LABELS) {
      const says = /verified/i.test(SOURCE_TEXT[l]);
      expect(says, l).toBe(l === 'institution_verified');
    }
  });

  it('draws the eye to estimates and doubtful figures, not to official ones', () => {
    expect(wantsAttention('estimated')).toBe(true);
    expect(wantsAttention('needs_review')).toBe(true);
    expect(wantsAttention('institution_verified')).toBe(false);
  });

  it('refuses anything that is not one of the five', () => {
    for (const v of ['verified', 'Imported', '', null, 3]) expect(isSourceLabel(v)).toBe(false);
  });
});

describe('freshness', () => {
  const now = Date.UTC(2026, 8, 27, 12);

  it('says how long ago', () => {
    expect(freshnessLine(now - 3 * 86_400_000, now)).toBe('Updated 3 days ago');
    expect(freshnessLine(now - 5 * 60_000, now)).toBe('Updated 5 minutes ago');
  });

  it('says nothing when the time is unknown, rather than "just now"', () => {
    for (const at of [null, undefined, 0, Number.NaN]) expect(freshnessLine(at, now)).toBeNull();
  });

  it('joins label and freshness into one line', () => {
    expect(sourceLine('imported', now - 86_400_000, now)).toBe('Imported · Updated yesterday');
    expect(sourceLine('estimated', null, now)).toBe('Estimated');
  });

  it('classifies freshness only against the caller\'s rule', () => {
    expect(freshnessState(now - 60_000, 5 * 60_000, now)).toBe('current');
    expect(freshnessState(now - 6 * 60_000, 5 * 60_000, now)).toBe('stale');
    expect(freshnessState(null, 5 * 60_000, now)).toBe('unknown');
    expect(freshnessState(now, -1, now)).toBe('unknown');
  });
});

describe('the display-only trust kinds', () => {
  it('adds display-only trust states without touching the stored five', () => {
    // The five are the database's check constraint; the others are never stored.
    expect(SOURCE_LABELS).toHaveLength(5);
    expect(SOURCE_LABELS as readonly string[]).not.toContain('ai_assisted');
    expect(TRUST_KINDS.slice(0, 5)).toEqual([...SOURCE_LABELS]);
    expect(TRUST_TEXT.ai_assisted).toBe('AI-assisted');
    expect(TRUST_TEXT.external).toBe('External');
    expect(TRUST_TEXT.unavailable_stale).toBe('Unavailable or stale');
  });

  it('has the ten kinds of the design brief, each with its own glyph and word', () => {
    expect([...TRUST_KINDS].sort()).toEqual(
      ['ai_assisted', 'connected', 'estimated', 'external', 'imported', 'institution_verified', 'needs_review', 'sample', 'student_entered', 'unavailable_stale'],
    );
    expect(TRUST_GLYPH).toEqual({
      institution_verified: '◆',
      connected: '⇄',
      imported: '↓',
      student_entered: '○',
      ai_assisted: '✦',
      estimated: '≈',
      needs_review: '?',
      unavailable_stale: '!',
      external: '↗',
      sample: '◌',
    });
    expect(new Set(Object.values(TRUST_GLYPH)).size).toBe(TRUST_KINDS.length);
    expect(new Set(Object.values(TRUST_TEXT)).size).toBe(TRUST_KINDS.length);
    expect(TRUST_TEXT.connected).toBe('Connected');
    expect(TRUST_TEXT.sample).toBe('Sample');
  });

  it('give every kind words and a meaning', () => {
    for (const k of TRUST_KINDS) {
      expect(TRUST_TEXT[k].length, k).toBeGreaterThan(0);
      expect(TRUST_MEANING[k], k).toMatch(/\.$/);
    }
  });

  it('style an AI answer to be noticed, like an estimate', () => {
    expect(wantsAttention('ai_assisted')).toBe(true);
    expect(wantsAttention('unavailable_stale')).toBe(true);
    expect(wantsAttention('institution_verified')).toBe(false);
  });
});
