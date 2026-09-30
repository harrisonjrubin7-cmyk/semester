import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_SIGNALS } from '../../community/feed';
import { EXEMPT, FORBIDDEN_INPUTS, INDEPENDENT, RANKING_NAMES, REVIEWS, REVIEW_BY, type Review } from './reviews';

/**
 * The equity gate, held to the source.
 *
 * The scan finds every exported function in `src` with a ranking name; each
 * must be reviewed or exempt with a reason, and nothing reviewed may read a
 * forbidden input. A scan that found nothing would pass the gate for any code
 * at all, so it is checked against surfaces known to be there.
 */

const src = join(import.meta.dirname, '../..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

const pattern = new RegExp(`^export (?:async )?function (${RANKING_NAMES.join('|')})\\b`, 'gm');
const found = files(src).flatMap((f) => {
  const text = readFileSync(f, 'utf8');
  return [...text.matchAll(pattern)].map((m) => `${relative(src, f)}#${m[1]}`);
}).sort();

const reviewed = new Map(REVIEWS.map((r) => [r.id, r]));
const exempt = new Map(EXEMPT.map((e) => [e.id, e]));

/** A word, compared without case or punctuation, so `financial aid` meets `financialAid`. */
const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const FORBIDDEN = FORBIDDEN_INPUTS.map(flat);
/** A short term must match a whole word; a long one may sit inside a phrase. */
const readsForbidden = (input: string): string | null => {
  const words = input.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const whole = flat(input);
  for (const f of FORBIDDEN) {
    if (f.length <= 4 ? words.includes(f) : whole.includes(f)) return f;
  }
  return null;
};

describe('the scan', () => {
  it('finds surfaces known to be there, so an empty result cannot pass', () => {
    expect(found).toEqual(expect.arrayContaining(['lib/actions.ts#rank', 'community/feed.ts#rankItem', 'lib/launchpad.ts#matchMentors']));
    expect(found.length).toBeGreaterThanOrEqual(15);
  });

  it('accounts for every ranking function: reviewed or exempt, never both, never neither', () => {
    const missing = found.filter((id) => !reviewed.has(id) && !exempt.has(id));
    expect(missing, `no equity review or exemption for: ${missing.join(', ')}`).toEqual([]);
    expect(found.filter((id) => reviewed.has(id) && exempt.has(id))).toEqual([]);
  });

  it('holds no review or exemption for a function that is gone', () => {
    const gone = [...reviewed.keys(), ...exempt.keys()].filter((id) => !found.includes(id));
    expect(gone, `reviewed but not found in the source: ${gone.join(', ')}`).toEqual([]);
  });

  it('points at files that exist', () => {
    for (const id of [...reviewed.keys(), ...exempt.keys()]) expect(existsSync(join(src, id.split('#')[0]!)), id).toBe(true);
  });
});

describe('each review', () => {
  const all = [...reviewed.values()];

  it('answers every question, in enough words to be an answer', () => {
    for (const r of all) {
      expect(r.surface.trim().length, `${r.id} surface`).toBeGreaterThan(8);
      for (const k of ['affects', 'benefit', 'risks', 'access', 'control', 'explains', 'monitoring'] as const) {
        expect(r[k].trim().length, `${r.id} ${k}`).toBeGreaterThan(20);
      }
      expect(r.inputs.length, `${r.id} inputs`).toBeGreaterThan(0);
    }
  });

  it('reads nothing on the forbidden list', () => {
    for (const r of all) for (const i of r.inputs) expect(readsForbidden(i), `${r.id} reads "${i}"`).toBeNull();
  });

  it('declares only inputs it actually lists as self-declared', () => {
    for (const r of all) for (const i of r.selfDeclared) expect(r.inputs, `${r.id}: ${i}`).toContain(i);
  });

  it('gives every finding an owner and a place it would be fixed', () => {
    const ids = all.flatMap((r) => r.findings.map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of all.flatMap((r) => r.findings)) {
      expect(f.text.length, f.id).toBeGreaterThan(40);
      expect(f.owner.length, f.id).toBeGreaterThan(3);
    }
  });

  it('is not past its review date', () => {
    expect(new Date().toISOString().slice(0, 10) <= REVIEW_BY, `equity reviews were due ${REVIEW_BY}`).toBe(true);
  });

  it('does not claim to be independent, because it is not', () => {
    expect(INDEPENDENT).toBe(false);
  });
});

describe('the document', () => {
  const doc = readFileSync(join(src, '../../docs/EQUITY-REVIEW.md'), 'utf8');

  it('names every review and every finding, so it cannot describe a different set', () => {
    for (const r of REVIEWS) expect(doc, r.id).toContain(`\`${r.id}\``);
    for (const f of REVIEWS.flatMap((r) => r.findings)) expect(doc, f.id).toContain(`| ${f.id} |`);
  });

  it('says it is not independent, and that it measures no outcome', () => {
    expect(doc).toMatch(/Not an independent review/);
    expect(doc).toMatch(/does not measure\s+outcomes/);
  });
});

describe('the forbidden-input check', () => {
  it('is the feed list plus the brief\'s, so the two cannot drift', () => {
    for (const s of FORBIDDEN_SIGNALS) expect(FORBIDDEN_INPUTS).toContain(s);
    expect(FORBIDDEN_INPUTS.length).toBeGreaterThan(FORBIDDEN_SIGNALS.length);
  });

  // Controls: the check must refuse what it says it refuses, and let ordinary
  // inputs through, or "reads nothing forbidden" is true of everything.
  it.each([
    ['the student’s GPA'], ['financial aid status'], ['an inferred wellbeing score'], ['ethnicity'], ['their zip code'], ['risk'], ['how many likes it has'],
  ])('refuses %s', (input) => {
    expect(readsForbidden(input), input).not.toBeNull();
  });

  it.each([['due date'], ['the goal the student picked'], ['cards due'], ['whether a camera is on']])('lets %s through', (input) => {
    expect(readsForbidden(input), input).toBeNull();
  });

  it('catches a review that reads a forbidden input', () => {
    const bad: Review = { ...REVIEWS[0]!, inputs: ['due date', 'the student’s inferred wellbeing'] };
    expect(bad.inputs.map(readsForbidden).some((x) => x !== null)).toBe(true);
  });
});
