import { freshnessLine, freshnessState, SOURCE_MEANING, type TrustKind } from './source';
import type { Tone } from './status';
import type { Where } from './where';

/**
 * Where a fact came from, how far to trust it, and whether it can be acted on,
 * as independent answers rather than one badge.
 *
 * ## Why not one list
 *
 * The app has had four overlapping vocabularies for this — `SourceLabel` (the
 * five the database stores), `TRUST_KINDS` (those and three more for display),
 * `Where` (six, ordered) and the provenance rows of `StatusKey`. Each folds
 * several different questions into one word, and then a fact that is official
 * *and* out of date, or AI-written *and* waiting on a reviewer, cannot be said.
 * "Stale" is not an origin; "pending" is not an assurance; "restricted" is not
 * a freshness. Five axes, each answered on its own:
 *
 *   origin     who produced it
 *   assurance  has anyone vouched for it
 *   freshness  is it current (from a real observation time, never assumed)
 *   lifecycle  where it stands in a process, if it is in one
 *   access     whether the viewer's access is limited, and who controls it
 *
 * ## This is not `lib/provenance.ts`
 *
 * That file's `Provenance` is a source/scope/status *sentence* (the journal's).
 * This is the structured fact behind the badge. The name differs so neither
 * import can be taken for the other.
 *
 * ## What it must not do
 *
 * - **Nothing here changes a stored value.** `SOURCE_LABELS` is the database's
 *   check constraint; `fromSourceLabel` reads it and never writes it.
 * - **Nothing here produces `official` that was not already `official`.**
 *   `institution_verified` and `Where.official` map to it; no new path does.
 *   `where.test.ts` records that no adapter in this build returns `official`;
 *   this file does not weaken that.
 * - **Freshness is never assumed.** An absent time is `unknown`, and `current`
 *   needs the caller's own rule (`freshnessState` takes a max age and has no
 *   default). The one exception is `fromWhere('connected')`, where `Where`
 *   itself already applied the three-day rule.
 */

export type Origin = 'official' | 'connected' | 'imported' | 'user' | 'computed' | 'ai' | 'external' | 'sample' | 'unknown';
export type Assurance = 'verified' | 'unverified' | 'needs_review';
export type Freshness = 'current' | 'stale' | 'unknown';
export type Lifecycle = 'pending' | 'submitted' | 'approved' | 'rejected' | 'revoked';

interface Base {
  assurance: Assurance;
  freshness: Freshness;
  /** When the fact was last observed or synced, epoch ms. Null or absent when not recorded. */
  observedAt?: number | null;
  /** The connected system or file, by name — "Brightspace", "transcript.pdf". */
  system?: string;
  lifecycle?: Lifecycle;
  /** Who is acting in the process — "Dean's office". Used by `pending` and `submitted`. */
  owner?: string;
  /** Present when the viewer's access is limited. `controller` says who decides. */
  access?: 'restricted';
  controller?: string;
  /** Who vouched, when `assurance` is `verified` and the origin is not an authority itself. */
  verifiedBy?: string;
}

/**
 * An `official` fact must name who stands behind it. "Official" with no office
 * is a claim nobody can check, so the type refuses it rather than a reviewer.
 */
export type FactProvenance =
  | (Base & { origin: 'official'; authority: string })
  | (Base & { origin: Exclude<Origin, 'official'>; authority?: undefined });

// ── Words ────────────────────────────────────────────────────────────────

/**
 * What an official fact is called. One constant, because the choice between
 * "Institution verified" (what `lib/source.ts` and the database label say) and
 * "Official" (what `lib/where.ts` says) is the owner's open decision DD-003.
 * Flipping it is this one line and the tests that name it.
 */
export const OFFICIAL_WORD = 'Institution verified';

/**
 * The origin words are role-neutral on purpose. A badge is read by the
 * student, the faculty member, the advisor and the guardian, so "Yours" — right
 * for one reader in four — is "Student entered".
 */
export const ORIGIN_WORD: Record<Origin, string> = {
  official: OFFICIAL_WORD,
  connected: 'Connected',
  imported: 'Imported',
  user: 'Student entered',
  computed: 'Estimated',
  ai: 'AI-assisted',
  external: 'External',
  sample: 'Sample',
  unknown: 'Source not recorded',
};

export const ORIGIN_GLYPH: Record<Origin, string> = {
  official: '◆',
  connected: '↔',
  imported: '↓',
  user: '◇',
  computed: '≈',
  ai: '✦',
  external: '↗',
  sample: '◌',
  unknown: '·',
};

/** A second, non-colour carrier of origin: how the chip is drawn. */
export type Fill = 'solid' | 'outline' | 'dashed';
export const ORIGIN_FILL: Record<Origin, Fill> = {
  official: 'solid',
  connected: 'outline',
  imported: 'outline',
  user: 'outline',
  computed: 'outline',
  ai: 'outline',
  external: 'outline',
  sample: 'dashed',
  unknown: 'outline',
};

/** Origins that are the ones to double-check, and so draw the eye (`wantsAttention`). */
const ATTENTIVE: ReadonlySet<Origin> = new Set<Origin>(['computed', 'ai']);

const ORIGIN_MEANING: Record<Origin, string> = {
  official: SOURCE_MEANING.institution_verified,
  connected: 'Read from an account or calendar you connected.',
  imported: SOURCE_MEANING.imported,
  user: SOURCE_MEANING.student_entered,
  computed: SOURCE_MEANING.estimated,
  ai: 'Written with Semester’s assistant. It is not an official answer — check anything you act on.',
  external: 'From a source outside your institution and outside Semester, such as a web page.',
  sample: 'Shipped with the app as a demonstration. Not your semester.',
  unknown: 'Semester has no record of where this came from.',
};

// ── Cues ─────────────────────────────────────────────────────────────────

export type CueKey = 'restricted' | 'stale' | 'age-unknown' | 'needs-review' | Lifecycle | 'verified';

export interface Cue {
  key: CueKey;
  word: string;
  glyph: string;
  tone: Tone;
}

/** Most cues drawn beside the origin. The rest are said by `phrase` and shown in the details drawer. */
export const MAX_CUES = 2;

const LIFECYCLE_WORD: Record<Lifecycle, [string, string, Tone]> = {
  pending: ['Pending', '…', 'neutral'],
  submitted: ['Submitted', '↑', 'neutral'],
  approved: ['Approved', '✔', 'success'],
  rejected: ['Not approved', '✕', 'attention'],
  revoked: ['Revoked', '↩', 'attention'],
};

/** Origins whose age a reader expects to see, so a missing time is itself worth saying. */
const EXPECTS_AGE: ReadonlySet<Origin> = new Set<Origin>(['official', 'connected']);

/**
 * Every cue that applies, strongest first.
 *
 * The order is the rule: a limit on access outranks a doubt about age, which
 * outranks a doubt about accuracy, which outranks where a process stands, which
 * outranks good news. A row that is both restricted and verified shows
 * "restricted" first because it changes what the reader can do.
 *
 * `verified` is left off an official fact, which is verified by definition.
 */
export function allCues(p: FactProvenance): Cue[] {
  const out: Cue[] = [];
  if (p.access === 'restricted') {
    out.push({ key: 'restricted', word: p.controller ? `Restricted · ${p.controller} decides` : 'Restricted', glyph: '⊘', tone: 'neutral' });
  }
  if (p.freshness === 'stale') out.push({ key: 'stale', word: 'Out of date', glyph: '↻', tone: 'attention' });
  else if (p.freshness === 'unknown' && EXPECTS_AGE.has(p.origin)) {
    // Neutral, not attention: a missing time is information, and most official
    // records carry none. `stale` is the one that warns.
    out.push({ key: 'age-unknown', word: 'Age unknown', glyph: '–', tone: 'neutral' });
  }
  if (p.assurance === 'needs_review') out.push({ key: 'needs-review', word: 'Needs review', glyph: '?', tone: 'attention' });
  if (p.lifecycle) {
    const [word, glyph, tone] = LIFECYCLE_WORD[p.lifecycle];
    const owned = (p.lifecycle === 'pending' || p.lifecycle === 'submitted') && p.owner ? `${word} · ${p.owner}` : word;
    out.push({ key: p.lifecycle, word: owned, glyph, tone });
  }
  if (p.assurance === 'verified' && p.origin !== 'official') {
    out.push({ key: 'verified', word: p.verifiedBy ? `Verified · ${p.verifiedBy}` : 'Verified', glyph: '✓', tone: 'success' });
  }
  return out;
}

/** The cues that fit beside the origin. */
export function cues(p: FactProvenance): Cue[] {
  return allCues(p).slice(0, MAX_CUES);
}

export interface OriginChip {
  word: string;
  glyph: string;
  tone: Tone;
  fill: Fill;
  meaning: string;
}

export function originChip(p: FactProvenance): OriginChip {
  const word = p.origin === 'official' ? `${ORIGIN_WORD.official} · ${p.authority}` : p.system ? `${ORIGIN_WORD[p.origin]} · ${p.system}` : ORIGIN_WORD[p.origin];
  return {
    word,
    glyph: ORIGIN_GLYPH[p.origin],
    tone: p.origin === 'official' ? 'success' : ATTENTIVE.has(p.origin) ? 'attention' : 'neutral',
    fill: ORIGIN_FILL[p.origin],
    meaning: ORIGIN_MEANING[p.origin],
  };
}

/**
 * The whole thing as one sentence, for a screen reader and for any place that
 * cannot draw chips. Unlike `cues` it is not capped: what does not fit on the
 * row is still said.
 */
export function phrase(p: FactProvenance, now = Date.now()): string {
  const parts = [originChip(p).word, ...allCues(p).map((c) => c.word)];
  const age = freshnessLine(p.observedAt, now);
  if (age) parts.push(age.charAt(0).toLowerCase() + age.slice(1));
  return parts.join(', ');
}

// ── Adapters from the vocabularies that exist ────────────────────────────

export interface AdaptOptions {
  /** When it was last observed or synced, epoch ms. */
  at?: number | null;
  /**
   * The source's own rule for how old is too old. Without it freshness stays
   * `unknown` even when `at` is given — `freshnessState` has no default on purpose.
   */
  maxAgeMs?: number;
  now?: number;
  /** Required in effect for official facts; defaults to the generic "Your institution". */
  authority?: string;
  system?: string;
}

/** The generic authority, for the stored label that says "your institution" and nothing narrower. */
export const GENERIC_AUTHORITY = 'Your institution';

function freshnessOf(o: AdaptOptions): Freshness {
  return o.maxAgeMs === undefined ? 'unknown' : freshnessState(o.at, o.maxAgeMs, o.now);
}

function make(origin: Origin, assurance: Assurance, freshness: Freshness, o: AdaptOptions): FactProvenance {
  const base: Base = { assurance, freshness, observedAt: o.at ?? null, ...(o.system ? { system: o.system } : {}) };
  return origin === 'official'
    ? { ...base, origin, authority: o.authority ?? GENERIC_AUTHORITY }
    : { ...base, origin };
}

/**
 * The seven display kinds and the five stored ones, as provenance.
 *
 * Injective on the eight kinds below `unavailable_stale`: no two map to the
 * same fact, which is what lets the database keep its five values and nothing
 * be lost on the way to the screen (`factprovenance.test.ts`).
 */
export function fromSourceLabel(label: TrustKind, o: AdaptOptions = {}): FactProvenance {
  const f = freshnessOf(o);
  switch (label) {
    case 'institution_verified':
      return make('official', 'verified', f, o);
    case 'imported':
      return make('imported', 'unverified', f, o);
    case 'student_entered':
      return make('user', 'unverified', f, o);
    case 'estimated':
      return make('computed', 'unverified', f, o);
    case 'needs_review':
      // The stored label says only that it should be checked. Calling it imported
      // would invent a claim the old badge never made, so the origin is unknown.
      return make('unknown', 'needs_review', f, o);
    case 'ai_assisted':
      return make('ai', 'unverified', f, o);
    case 'external':
      return make('external', 'unverified', f, o);
    case 'unavailable_stale':
      return make('connected', 'unverified', 'stale', o);
  }
}

/**
 * `Where` as provenance. `connected` is `current` because `whereFeed` already
 * applied the three-day rule to produce it; every other freshness comes from
 * the caller or stays unknown. `made` is rule-based extraction, not AI, so it
 * is `computed`.
 */
export function fromWhere(w: Where, o: AdaptOptions = {}): FactProvenance {
  switch (w) {
    case 'official':
      return make('official', 'verified', freshnessOf(o), o);
    case 'connected':
      return make('connected', 'unverified', 'current', o);
    case 'stale':
      return make('connected', 'unverified', 'stale', o);
    case 'made':
      return make('computed', 'unverified', freshnessOf(o), o);
    case 'yours':
      return make('user', 'unverified', freshnessOf(o), o);
    case 'sample':
      return make('sample', 'unverified', 'unknown', o);
  }
}
