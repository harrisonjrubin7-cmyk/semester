import { describe, expect, it } from 'vitest';
import {
  GENERIC_AUTHORITY,
  MAX_CUES,
  OFFICIAL_WORD,
  ORIGIN_FILL,
  ORIGIN_GLYPH,
  ORIGIN_WORD,
  allCues,
  cues,
  fromSourceLabel,
  fromWhere,
  originChip,
  phrase,
  type FactProvenance,
  type Origin,
} from './factprovenance';
import { SOURCE_LABELS, TRUST_KINDS, wantsAttention } from './source';
import { SOURCE_TEXT } from './source';
import type { Where } from './where';

const NOW = Date.UTC(2026, 9, 4, 12);
const DAY = 86_400_000;
const WHERE: Where[] = ['official', 'connected', 'made', 'yours', 'sample', 'stale'];
const ORIGINS = Object.keys(ORIGIN_WORD) as Origin[];

/** A fact with everything switched on, for the priority tests. */
const everything: FactProvenance = {
  origin: 'connected',
  assurance: 'verified',
  freshness: 'stale',
  observedAt: NOW - 5 * DAY,
  lifecycle: 'pending',
  owner: 'Dean’s office',
  access: 'restricted',
  controller: 'the Registrar',
  verifiedBy: 'your advisor',
};

describe('the adapters keep what the database stores', () => {
  it('maps all eight display kinds, and no two of the stored five to the same fact', () => {
    const facts = TRUST_KINDS.map((k) => JSON.stringify(fromSourceLabel(k)));
    expect(new Set(facts).size).toBe(TRUST_KINDS.length);
    const stored = SOURCE_LABELS.map((k) => JSON.stringify(fromSourceLabel(k)));
    expect(new Set(stored).size).toBe(SOURCE_LABELS.length);
  });

  it('says the same thing as the label it replaces, for every stored label that is an origin', () => {
    expect(originChip(fromSourceLabel('imported')).word).toBe(SOURCE_TEXT.imported);
    expect(originChip(fromSourceLabel('student_entered')).word).toBe(SOURCE_TEXT.student_entered);
    expect(originChip(fromSourceLabel('estimated')).word).toBe(SOURCE_TEXT.estimated);
    // Official carries its authority, so the word leads and the office follows.
    expect(originChip(fromSourceLabel('institution_verified')).word).toBe(`${SOURCE_TEXT.institution_verified} · ${GENERIC_AUTHORITY}`);
    expect(OFFICIAL_WORD).toBe(SOURCE_TEXT.institution_verified);
  });

  it('keeps wantsAttention: every kind the old badge drew loud still draws the eye', () => {
    for (const k of TRUST_KINDS) {
      const p = fromSourceLabel(k);
      const loud = originChip(p).tone === 'attention' || allCues(p).some((c) => c.tone === 'attention');
      expect(loud, k).toBe(wantsAttention(k));
    }
  });

  it('does not invent an origin for a label that only says "check this"', () => {
    const p = fromSourceLabel('needs_review');
    expect(p.origin).toBe('unknown');
    expect(p.assurance).toBe('needs_review');
    expect(originChip(p).word).toBe('Source not recorded');
  });

  it('names the office on an official fact, and the generic one only when told nothing', () => {
    const named = fromSourceLabel('institution_verified', { authority: 'Registrar' });
    expect(originChip(named).word).toBe(`${OFFICIAL_WORD} · Registrar`);
    expect(named.origin === 'official' && named.authority).toBe('Registrar');
  });

  it('refuses an official fact with no authority at the type level', () => {
    // @ts-expect-error — an official fact must name who stands behind it
    const bad: FactProvenance = { origin: 'official', assurance: 'verified', freshness: 'unknown' };
    expect(bad.origin).toBe('official'); // the runtime value exists; the compiler is the guard
  });

  it('makes `official` out of exactly the inputs that already were official', () => {
    const official = WHERE.filter((w) => fromWhere(w).origin === 'official');
    expect(official).toEqual(['official']);
    const stored = TRUST_KINDS.filter((k) => fromSourceLabel(k).origin === 'official');
    expect(stored).toEqual(['institution_verified']);
  });
});

describe('freshness is never assumed', () => {
  it('is unknown without the source’s own rule, even with a time', () => {
    expect(fromSourceLabel('imported', { at: NOW - 1000, now: NOW }).freshness).toBe('unknown');
  });

  it('is current or stale only against a stated maximum age', () => {
    expect(fromSourceLabel('imported', { at: NOW - 1 * DAY, maxAgeMs: 3 * DAY, now: NOW }).freshness).toBe('current');
    expect(fromSourceLabel('imported', { at: NOW - 5 * DAY, maxAgeMs: 3 * DAY, now: NOW }).freshness).toBe('stale');
    expect(fromSourceLabel('imported', { at: null, maxAgeMs: 3 * DAY, now: NOW }).freshness).toBe('unknown');
  });

  it('takes `connected` as current only because Where already applied its three-day rule', () => {
    expect(fromWhere('connected').freshness).toBe('current');
    expect(fromWhere('stale').freshness).toBe('stale');
    expect(fromWhere('stale').origin).toBe('connected');
    expect(fromWhere('yours').freshness).toBe('unknown');
  });

  it('keeps made distinct from AI, as status.ts insists', () => {
    expect(fromWhere('made').origin).toBe('computed');
    expect(fromSourceLabel('ai_assisted').origin).toBe('ai');
  });
});

describe('which cues are drawn, and in what order', () => {
  it('puts access first, then age, doubt, process, and good news last', () => {
    expect(allCues(everything).map((c) => c.key)).toEqual(['restricted', 'stale', 'pending', 'verified']);
  });

  it('draws at most two beside the origin, the strongest two', () => {
    expect(MAX_CUES).toBe(2);
    expect(cues(everything).map((c) => c.key)).toEqual(['restricted', 'stale']);
  });

  it('puts doubt about accuracy after doubt about age, before the process', () => {
    const p: FactProvenance = { origin: 'imported', assurance: 'needs_review', freshness: 'stale', lifecycle: 'submitted' };
    expect(allCues(p).map((c) => c.key)).toEqual(['stale', 'needs-review', 'submitted']);
  });

  it('does not repeat "verified" on a fact that is official by definition', () => {
    expect(allCues(fromSourceLabel('institution_verified')).map((c) => c.key)).not.toContain('verified');
    expect(allCues({ origin: 'ai', assurance: 'verified', freshness: 'unknown' }).map((c) => c.key)).toContain('verified');
  });

  it('says a missing age only where a reader expects one', () => {
    const unknown = (origin: Origin) =>
      allCues(origin === 'official' ? { origin, authority: 'Registrar', assurance: 'verified', freshness: 'unknown' } : { origin, assurance: 'unverified', freshness: 'unknown' }).some(
        (c) => c.key === 'age-unknown',
      );
    expect(unknown('official')).toBe(true);
    expect(unknown('connected')).toBe(true);
    for (const o of ORIGINS.filter((x) => x !== 'official' && x !== 'connected')) expect(unknown(o), o).toBe(false);
  });

  it('names who is acting on a pending request, and who decides on a restriction', () => {
    const words = allCues(everything).map((c) => c.word);
    expect(words).toContain('Pending · Dean’s office');
    expect(words).toContain('Restricted · the Registrar decides');
    expect(words).toContain('Verified · your advisor');
  });
});

describe('the encoding never rests on colour alone', () => {
  it('gives every origin its own glyph and its own word', () => {
    expect(new Set(ORIGINS.map((o) => ORIGIN_GLYPH[o])).size).toBe(ORIGINS.length);
    expect(new Set(ORIGINS.map((o) => ORIGIN_WORD[o])).size).toBe(ORIGINS.length);
  });

  it('gives every cue a glyph and a word, and no two cues the same glyph', () => {
    const all = allCues({ ...everything, lifecycle: 'pending', assurance: 'needs_review' });
    const keys = ['restricted', 'stale', 'age-unknown', 'needs-review', 'pending', 'submitted', 'approved', 'rejected', 'revoked', 'verified'];
    const seen = new Map<string, string>();
    const probe = (p: FactProvenance) => allCues(p).forEach((c) => seen.set(c.key, c.glyph));
    probe(everything);
    probe({ origin: 'connected', assurance: 'needs_review', freshness: 'unknown', lifecycle: 'submitted' });
    for (const l of ['approved', 'rejected', 'revoked'] as const) probe({ origin: 'user', assurance: 'unverified', freshness: 'current', lifecycle: l });
    expect([...seen.keys()].sort()).toEqual([...keys].sort());
    expect(new Set(seen.values()).size).toBe(seen.size);
    for (const c of all) expect(c.word.trim().length).toBeGreaterThan(0);
  });

  it('draws official solid and a sample dashed, so greyscale can tell them from the rest', () => {
    expect(ORIGIN_FILL.official).toBe('solid');
    expect(ORIGIN_FILL.sample).toBe('dashed');
    expect(ORIGINS.filter((o) => ORIGIN_FILL[o] === 'outline')).toHaveLength(ORIGINS.length - 2);
  });
});

describe('the sentence for a screen reader', () => {
  it('says every cue, including the ones the row has no room to draw', () => {
    const s = phrase(everything, NOW);
    expect(s).toContain('Connected');
    for (const c of allCues(everything)) expect(s).toContain(c.word);
    expect(s).toContain('updated 5 days ago');
  });

  it('says nothing about age when none is recorded', () => {
    expect(phrase({ origin: 'user', assurance: 'unverified', freshness: 'unknown' }, NOW)).toBe('Student entered');
  });

  it('reads the connected system into the origin', () => {
    expect(phrase({ origin: 'connected', assurance: 'unverified', freshness: 'current', system: 'Brightspace' }, NOW)).toBe('Connected · Brightspace');
  });
});
