/**
 * What may be sent to a model from a set of candidate sources: `RP-01` to
 * `RP-05` of docs/ai-governance/03-retrieval-policy.md, as one pure function.
 *
 * The gateway checks that each source a client names is approved for the
 * tenant, and that is a strong check on a smaller thing than retrieval. Four
 * things it does not do, each found in the code and each decided here:
 *
 * - **No classification.** `approved_source` has no data tier and the server
 *   never asks the question `toolkit/classification.ts` says it must ("the
 *   phase that adds generation must call the gate on the server"). Here a
 *   source with no tier is treated as an education record, as that file does,
 *   and T3 and above never go to a model.
 * - **No freshness.** `verifiedAt` is the row's `updated_at`, which nobody
 *   verified. Here a source past `validUntil` is dropped, not sent with a
 *   warning a model may ignore.
 * - **`authority` is read and dropped.** Here it travels with every item, so
 *   the model and the provenance panel can say which source is which.
 * - **No input bound.** Here there is a chunk count and a size, checked
 *   before the call.
 *
 * `dropped` is part of the result on purpose. A retrieval that silently
 * returns less is how a student gets a confident answer from half a policy.
 * It names the source and the reason, never the text.
 *
 * Pure: no database, network or clock (`today` is an argument), and not
 * wired. The columns it needs (`classification`, `valid_until`, a real
 * `verified_at` and `verified_by`) do not exist yet, so the loader cannot
 * supply them. That migration is its own decision.
 */

export type DataTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';
export type SourceOrigin = 'course' | 'institution' | 'library' | 'web';
export type SourceAuthority = 'authoritative' | 'supplemental' | 'prohibited';

export interface Candidate {
  tenantId: string;
  sourceId: string;
  chunkId: string;
  versionHash: string;
  text: string;
  /** Page, section or timestamp the claim rests on. */
  anchor: string | null;
  origin: SourceOrigin;
  authority: SourceAuthority;
  /** Undefined means nobody classified it, which is treated as an education record. */
  classification: DataTier | undefined;
  /** When a person last confirmed it, and who. Null when nobody has. */
  verifiedAt: string | null;
  verifiedBy: string | null;
  /** The last ISO day it may be sent; null when the institution set none. */
  validUntil: string | null;
  superseded: boolean;
}

export interface RetrievalPolicy {
  tenantId: string;
  /** An ISO day, passed in. */
  today: string;
  /** The course policy's answer, already resolved. The gate never widens it. */
  courseAllowsAi: boolean;
  webAllowed: boolean;
  /** Drop what no person has verified. */
  requireVerified: boolean;
  maxChunks: number;
  /** A size bound on the text sent, in characters, checked before the call. */
  maxChars: number;
}

export type DropReason =
  | 'other-tenant' | 'prohibited' | 'superseded' | 'classification' | 'course-policy'
  | 'web-not-allowed' | 'stale' | 'unverified' | 'budget';

export interface RetrievalItem {
  sourceId: string;
  chunkId: string;
  versionHash: string;
  text: string;
  anchor: string | null;
  origin: SourceOrigin;
  /** What the model and the provenance panel say this source is. */
  authority: 'authoritative' | 'supplemental';
  verifiedAt: string | null;
  validUntil: string | null;
  /** True when the institution set no expiry, so the answer cannot say how current the source is. */
  undated: boolean;
}

export interface RetrievalSet {
  items: readonly RetrievalItem[];
  dropped: readonly { sourceId: string; chunkId: string; reason: DropReason }[];
  /** The ids and versions that were sent, in order, for the audit to hash. */
  key: string;
  /** True when a candidate belonged to another tenant: an index and policy that disagree, a P0 signal and never a quiet drop. */
  crossTenant: boolean;
}

const BLOCKED_TIERS: ReadonlySet<DataTier | undefined> = new Set<DataTier | undefined>(['T3', 'T4', 'T5', 'T6', undefined]);

/** Why one candidate may not be sent, or null. Checked in a fixed order so the reason is stable. */
export function dropReason(c: Candidate, p: RetrievalPolicy): DropReason | null {
  if (c.tenantId !== p.tenantId) return 'other-tenant';
  if (c.authority === 'prohibited') return 'prohibited';
  if (c.superseded) return 'superseded';
  if (BLOCKED_TIERS.has(c.classification)) return 'classification';
  if (!p.courseAllowsAi) return 'course-policy';
  if (c.origin === 'web' && !p.webAllowed) return 'web-not-allowed';
  if (c.validUntil !== null && c.validUntil < p.today) return 'stale';
  if (p.requireVerified && (c.verifiedAt === null || c.verifiedBy === null)) return 'unverified';
  return null;
}

/**
 * Assemble what may be sent, in the caller's order (the caller ranks). A
 * candidate that fits is taken; one that would exceed the chunk count or the
 * size is dropped as `budget` and the next is tried, so the choice is
 * deterministic. Text is never truncated: a clipped policy is a different policy.
 */
export function assemble(candidates: readonly Candidate[], p: RetrievalPolicy): RetrievalSet {
  const items: RetrievalItem[] = [];
  const dropped: { sourceId: string; chunkId: string; reason: DropReason }[] = [];
  let chars = 0;
  let crossTenant = false;
  for (const c of candidates) {
    const why = dropReason(c, p);
    if (why === 'other-tenant') crossTenant = true;
    if (why) { dropped.push({ sourceId: c.sourceId, chunkId: c.chunkId, reason: why }); continue; }
    if (items.length >= p.maxChunks || chars + c.text.length > p.maxChars) {
      dropped.push({ sourceId: c.sourceId, chunkId: c.chunkId, reason: 'budget' });
      continue;
    }
    chars += c.text.length;
    items.push({
      sourceId: c.sourceId, chunkId: c.chunkId, versionHash: c.versionHash, text: c.text, anchor: c.anchor,
      origin: c.origin, authority: c.authority as 'authoritative' | 'supplemental',
      verifiedAt: c.verifiedAt, validUntil: c.validUntil, undated: c.validUntil === null,
    });
  }
  return { items, dropped, key: items.map((i) => `${i.sourceId}#${i.chunkId}@${i.versionHash}`).join('|'), crossTenant };
}
