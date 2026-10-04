/**
 * The evidence ledger: an append-only, hash-chained record of what was
 * checked, decided and signed.
 *
 * Auditability here means a reviewer, years later, can tell that nothing was
 * removed, reordered or edited. Each entry commits to the previous entry's
 * hash and to a SHA-256 digest of the artifact it describes (the check
 * results, the manifest, the signed approval), so the ledger itself holds no
 * student data — only digests, opaque references and short sanitized text.
 *
 * Retention is the institution's records schedule, not ours: every entry must
 * be given a `retainUntil` by the caller and the ledger refuses one without,
 * rather than guess a number that sounds legal.
 */
import { sanitizeMessage } from '../integration/redact.ts';

export const EVIDENCE_KINDS = [
  'inventory', 'extract_manifest', 'mapping_approved', 'check_run', 'gate_result', 'exception_event',
  'rehearsal', 'parallel_run_day', 'signoff', 'cutover_event', 'rollback_event', 'archive_manifest',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export interface EvidenceEntry {
  seq: number;
  at: string;
  actor: string;
  kind: EvidenceKind;
  /** A domain, or `all`. */
  subject: string;
  /** SHA-256 hex of the canonical form of the artifact. The artifact is stored elsewhere. */
  artifactDigest: string;
  summary: string;
  retainUntil: string;
  prevHash: string;
  hash: string;
}

export const GENESIS = '0'.repeat(64);

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** JSON with keys sorted at every depth, so the same value always has the same digest. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function digestOf(artifact: unknown): Promise<string> {
  return sha256Hex(canonical(artifact));
}

type Body = Omit<EvidenceEntry, 'hash'>;
const entryHash = (b: Body) => sha256Hex(canonical(b));

export interface AppendInput {
  at: string;
  actor: string;
  kind: EvidenceKind;
  subject: string;
  artifact: unknown;
  summary: string;
  retainUntil: string;
}

export async function append(ledger: readonly EvidenceEntry[], input: AppendInput): Promise<EvidenceEntry[]> {
  if (!input.retainUntil) throw new Error('every evidence entry needs a retainUntil from the institution\'s records schedule');
  if (!(input.retainUntil > input.at)) throw new Error('retainUntil must be after the entry');
  const prev = ledger.length === 0 ? GENESIS : ledger[ledger.length - 1].hash;
  const body: Body = {
    seq: ledger.length,
    at: input.at,
    actor: input.actor,
    kind: input.kind,
    subject: input.subject,
    artifactDigest: await digestOf(input.artifact),
    summary: sanitizeMessage(input.summary),
    retainUntil: input.retainUntil,
    prevHash: prev,
  };
  return [...ledger, { ...body, hash: await entryHash(body) }];
}

export type ChainVerdict = { ok: true } | { ok: false; at: number; reason: 'seq' | 'link' | 'hash' };

/** Walk the ledger; the first entry that was edited, reordered or has a neighbour removed is named. */
export async function verifyChain(ledger: readonly EvidenceEntry[]): Promise<ChainVerdict> {
  let prev = GENESIS;
  for (let i = 0; i < ledger.length; i++) {
    const { hash, ...body } = ledger[i];
    if (body.seq !== i) return { ok: false, at: i, reason: 'seq' };
    if (body.prevHash !== prev) return { ok: false, at: i, reason: 'link' };
    if ((await entryHash(body)) !== hash) return { ok: false, at: i, reason: 'hash' };
    prev = hash;
  }
  return { ok: true };
}

/**
 * The hash a sign-off binds to: the last entry that is not itself a
 * sign-off. Signing adds entries; it must not invalidate the other signatures
 * on the same evidence, while any new check, run or exception event does.
 */
export function evidenceHead(ledger: readonly EvidenceEntry[]): string {
  for (let i = ledger.length - 1; i >= 0; i--) if (ledger[i].kind !== 'signoff') return ledger[i].hash;
  return GENESIS;
}
