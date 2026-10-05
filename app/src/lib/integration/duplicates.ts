/**
 * Duplicate candidates across source records, and a merge that can be undone.
 *
 * `ingest` refuses the same external id twice in one batch. It cannot see two
 * *different* ids that mean the same thing — a section re-keyed by the SIS
 * after a term rollover, or the same event from the calendar and the events
 * office. This finds those by a deterministic natural key per canonical
 * entity, suggests which to keep, and records a resolution that keeps
 * everything it would need to reverse itself.
 *
 * Nothing is deleted. A merge marks the others `supersededBy` the kept one;
 * reversing it puts back exactly what was there before. Candidates carry a
 * hash of the key, never the values that made it, so a candidate list can be
 * shown to a data steward without carrying student data.
 *
 * See `docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md`.
 */
import type { CanonicalReference } from './pipeline.ts';

/**
 * The fields that make two records the same thing, per canonical entity.
 * An entity not listed here is never matched: guessing at a key is how a
 * de-duplicator merges two different students.
 */
export const NATURAL_KEYS: Readonly<Record<string, readonly string[]>> = {
  term: ['code'],
  program: ['code'],
  course_catalog_entry: ['subject', 'number'],
  course_section: ['term', 'course', 'section'],
  registration_window: ['term', 'audience'],
  enrollment: ['term', 'course', 'section'],
};

/** Entities about one person also match on the person, so two students never merge. */
const PERSONAL = new Set(['enrollment']);

export interface DuplicateCandidate {
  canonicalEntity: string;
  /** A hash of the natural key: identifies the group, reveals nothing. */
  keyHash: string;
  members: string[];
  /** The deterministic suggestion; a person decides. */
  suggestedKeep: string;
  why: string;
}

function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const norm = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

function naturalKey(ref: CanonicalReference): string | null {
  const fields = NATURAL_KEYS[ref.canonicalEntity];
  if (!fields || ref.externalDeletedAt) return null;
  const parts = fields.map((f) => norm(ref.values[f]));
  if (parts.some((p) => p === '')) return null;
  if (PERSONAL.has(ref.canonicalEntity)) {
    if (!ref.subjectUserId) return null;
    parts.unshift(ref.subjectUserId);
  }
  return `${ref.tenantId}\u0000${ref.canonicalEntity}\u0000${parts.join('\u0000')}`;
}

/**
 * The one to keep: the source of truth's own record first, then the most
 * recently changed at source, then the lowest canonical id — so the same
 * group always gets the same suggestion.
 */
function preferred(group: CanonicalReference[]): { keep: CanonicalReference; why: string } {
  const sorted = [...group].sort((a, b) => {
    const truthA = a.sourceSystem === a.sourceOfTruth ? 0 : 1;
    const truthB = b.sourceSystem === b.sourceOfTruth ? 0 : 1;
    if (truthA !== truthB) return truthA - truthB;
    const tA = a.sourceTimestamp ? Date.parse(a.sourceTimestamp) : -Infinity;
    const tB = b.sourceTimestamp ? Date.parse(b.sourceTimestamp) : -Infinity;
    if (tA !== tB) return tB - tA;
    return a.canonicalId.localeCompare(b.canonicalId);
  });
  const keep = sorted[0];
  const why = keep.sourceSystem === keep.sourceOfTruth ? 'from the source of truth' : 'most recently changed at source';
  return { keep, why };
}

export function findDuplicateCandidates(refs: readonly CanonicalReference[]): DuplicateCandidate[] {
  const groups = new Map<string, CanonicalReference[]>();
  for (const ref of refs) {
    const k = naturalKey(ref);
    if (!k) continue;
    const list = groups.get(k) ?? [];
    list.push(ref);
    groups.set(k, list);
  }
  const out: DuplicateCandidate[] = [];
  for (const [k, group] of groups) {
    const ids = new Set(group.map((r) => `${r.sourceSystem}\u0000${r.sourceRecordId}`));
    if (ids.size < 2) continue;
    const { keep, why } = preferred(group);
    out.push({
      canonicalEntity: group[0].canonicalEntity,
      keyHash: fnv(k),
      members: group.map((r) => r.canonicalId).sort(),
      suggestedKeep: keep.canonicalId,
      why,
    });
  }
  return out.sort((a, b) => a.keyHash.localeCompare(b.keyHash));
}

/** Which record each canonical id defers to, if any. */
export type Supersession = Readonly<Record<string, string | null>>;

export interface Resolution {
  id: string;
  keyHash: string;
  kept: string;
  superseded: string[];
  /** Exactly what each member deferred to before, so reversal is exact. */
  before: Record<string, string | null>;
  decidedBy: string;
  at: string;
  reversedAt: string | null;
}

export type Resolved = { ok: true; state: Supersession; resolution: Resolution } | { ok: false; why: string };

/** Merge a candidate group into `keep`. Refuses a keep outside the group. */
export function resolveDuplicate(
  state: Supersession,
  candidate: DuplicateCandidate,
  keep: string,
  decidedBy: string,
  now: Date,
  id: string,
): Resolved {
  if (!candidate.members.includes(keep)) return { ok: false, why: 'The record to keep is not in this group.' };
  if (!decidedBy.trim()) return { ok: false, why: 'A resolution needs the person who made it.' };
  const before: Record<string, string | null> = {};
  const next: Record<string, string | null> = { ...state };
  for (const m of candidate.members) {
    before[m] = state[m] ?? null;
    next[m] = m === keep ? null : keep;
  }
  return {
    ok: true,
    state: next,
    resolution: {
      id, keyHash: candidate.keyHash, kept: keep, superseded: candidate.members.filter((m) => m !== keep),
      before, decidedBy, at: now.toISOString(), reversedAt: null,
    },
  };
}

/**
 * Undo a resolution: every member defers to exactly what it deferred to
 * before. Refuses when a member has since been changed by another decision,
 * because putting back an old value over a newer one is not an undo.
 */
export function reverseResolution(
  state: Supersession,
  resolution: Resolution,
  now: Date,
): { ok: true; state: Supersession; resolution: Resolution } | { ok: false; why: string } {
  if (resolution.reversedAt) return { ok: false, why: 'This resolution was already reversed.' };
  for (const m of Object.keys(resolution.before)) {
    const expected = m === resolution.kept ? null : resolution.kept;
    if ((state[m] ?? null) !== expected) {
      return { ok: false, why: 'A later decision changed one of these records; reverse that one first.' };
    }
  }
  const next: Record<string, string | null> = { ...state };
  for (const [m, was] of Object.entries(resolution.before)) next[m] = was;
  return { ok: true, state: next, resolution: { ...resolution, reversedAt: now.toISOString() } };
}
