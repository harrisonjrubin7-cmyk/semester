/**
 * The evidence ledger: what happened, who did it, and proof it was not edited.
 *
 * An append-only chain. Each entry carries the hash of the one before it, so
 * changing, removing or reordering any entry breaks every hash after it and
 * `verifyChain` says where. The migration's state is not stored anywhere else —
 * `lifecycle.ts` *replays* this ledger — so there is no second record to
 * disagree with it and no way to claim a stage was passed without an entry
 * showing the evidence and the sign-offs that passed it.
 *
 * What goes in: counts, hashes, verdicts, durations, names of invariants,
 * references that are already redacted. What never does: a value from a
 * student's record. `entryProblems` refuses a summary or a body string that
 * `sanitizeMessage` would have changed (an email, a long digit run, a token),
 * and refuses long free text outright, because a field that can hold a
 * sentence will eventually hold a name.
 *
 * Retention is a policy the institution sets and counsel approves. This file
 * has no default retention period and will not invent one: it refuses to seal
 * an archive until every retention class has an explicit value and the policy
 * records that counsel reviewed it.
 */
import { sanitizeMessage } from '../integration/redact.ts';

export const GENESIS = '0'.repeat(64);

export type EntryType = 'evidence' | 'signoff' | 'stage' | 'decision' | 'exceptions';

export type RetentionClass = 'permanent_record' | 'program_record' | 'working';

export type BodyValue = string | number | boolean | null | readonly string[] | readonly number[];
export type Body = Readonly<Record<string, BodyValue>>;

export interface EntryInput {
  type: EntryType;
  /** The evidence kind, role, stage or decision. */
  kind: string;
  /** Who did it. For a sign-off, the person signing. */
  actor: string;
  domain?: string;
  /** ISO 8601. Must not precede the previous entry. */
  at: string;
  summary: string;
  body: Body;
  retention: RetentionClass;
  /** For a sign-off: the hashes of the entries it signs. */
  covers?: readonly string[];
}

export interface Entry extends EntryInput {
  seq: number;
  prev: string;
  hash: string;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** JSON with sorted keys, so the same entry always hashes the same. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export const sha256 = sha256Hex;

const MAX_STRING = 120;

export function entryProblems(input: EntryInput, previous?: Entry): string[] {
  const out: string[] = [];
  if (!input.actor.trim()) out.push('an entry needs the person who made it');
  if (!Number.isFinite(Date.parse(input.at))) out.push('the time is not an ISO 8601 date');
  if (previous && Date.parse(input.at) < Date.parse(previous.at)) out.push('the time precedes the previous entry');
  if (!input.kind.trim()) out.push('an entry needs a kind');
  if (!input.summary.trim()) out.push('an entry needs a one-line summary');
  else if (sanitizeMessage(input.summary) !== input.summary.replace(/\s+/g, ' ').trim()) out.push('the summary contains something that looks personal or secret');
  if (input.summary.length > 200) out.push('the summary is longer than a line; put detail in the evidence file, not the ledger');
  const strings = (v: BodyValue): string[] => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  for (const [k, v] of Object.entries(input.body)) {
    for (const s of strings(v)) {
      if (s.length > MAX_STRING) out.push(`body.${k} is long free text`);
      else if (sanitizeMessage(s) !== s) out.push(`body.${k} contains something that looks personal or secret`);
    }
  }
  if (input.type === 'signoff' && !(input.covers && input.covers.length)) out.push('a sign-off must name the entries it signs');
  return out;
}

export type Appended = { ok: true; entry: Entry } | { ok: false; problems: string[] };

export async function append(chain: readonly Entry[], input: EntryInput): Promise<Appended> {
  const previous = chain.at(-1);
  const problems = entryProblems(input, previous);
  if (problems.length) return { ok: false, problems };
  const unsigned = { ...input, seq: chain.length, prev: previous?.hash ?? GENESIS };
  return { ok: true, entry: { ...unsigned, hash: await sha256Hex(canonical(unsigned)) } };
}

export type Verified = { ok: true; head: string } | { ok: false; at: number; why: string };

export async function verifyChain(chain: readonly Entry[]): Promise<Verified> {
  let prev = GENESIS;
  for (let i = 0; i < chain.length; i += 1) {
    const { hash, ...rest } = chain[i];
    if (chain[i].seq !== i) return { ok: false, at: i, why: 'entries are missing or out of order' };
    if (chain[i].prev !== prev) return { ok: false, at: i, why: 'does not follow the entry before it' };
    if ((await sha256Hex(canonical(rest))) !== hash) return { ok: false, at: i, why: 'the entry was changed after it was written' };
    prev = hash;
  }
  return { ok: true, head: prev };
}

/* ── Retention ─────────────────────────────────────────────────────────── */

export type Years = number | 'until_exit' | 'permanent';

export interface RetentionPolicy {
  permanent_record: Years;
  program_record: Years;
  working: Years;
  /** True only when counsel has reviewed these periods for this institution. */
  counselReviewed: boolean;
}

export function retentionProblems(p: Partial<RetentionPolicy> | undefined): string[] {
  if (!p) return ['no retention policy: the institution sets one and counsel approves it'];
  const out: string[] = [];
  for (const k of ['permanent_record', 'program_record', 'working'] as const) {
    const v = p[k];
    if (v === undefined) out.push(`retention for ${k} is not set`);
    else if (typeof v === 'number' && !(Number.isInteger(v) && v > 0)) out.push(`retention for ${k} must be whole years`);
  }
  if (p.counselReviewed !== true) out.push('counsel has not reviewed the retention periods');
  return out;
}

/** The retention class an entry defaults to: decisions and sign-offs are the permanent record. */
export function defaultRetention(type: EntryType, kind: string): RetentionClass {
  if (type === 'signoff' || type === 'decision' || type === 'stage') return 'permanent_record';
  if (['validation_report', 'rehearsal_report', 'parallel_run_report', 'cutover_report', 'final_reconciliation', 'rollback_report', 'archive_manifest', 'scope_approval', 'mapping_spec'].includes(kind)) return 'program_record';
  return type === 'exceptions' ? 'program_record' : 'working';
}

/* ── Sealing ───────────────────────────────────────────────────────────── */

export interface SealedFile {
  name: string;
  sha256: string;
  bytes: number;
}

export interface Manifest {
  tenant: string;
  wave: string;
  entries: number;
  head: string;
  files: SealedFile[];
  sealedAt: string;
  retention: RetentionPolicy;
  manifestHash: string;
}

export type Sealed = { ok: true; manifest: Manifest } | { ok: false; problems: string[] };

/**
 * Seal the ledger and the files it names. Refused on a broken chain, on a file
 * listed twice, or on a retention policy that is not complete and reviewed.
 */
export async function seal(chain: readonly Entry[], files: readonly SealedFile[], meta: { tenant: string; wave: string; now: string; retention: Partial<RetentionPolicy> | undefined }): Promise<Sealed> {
  const problems = [...retentionProblems(meta.retention)];
  const v = await verifyChain(chain);
  if (!v.ok) problems.push(`the ledger is broken at entry ${v.at}: ${v.why}`);
  const names = files.map((f) => f.name);
  if (new Set(names).size !== names.length) problems.push('a file is listed twice');
  if (problems.length || !v.ok) return { ok: false, problems };
  const body = { tenant: meta.tenant, wave: meta.wave, entries: chain.length, head: v.head, files: [...files].sort((a, b) => a.name.localeCompare(b.name)), sealedAt: meta.now, retention: meta.retention as RetentionPolicy };
  return { ok: true, manifest: { ...body, manifestHash: await sha256Hex(canonical(body)) } };
}

export async function verifyManifest(m: Manifest, chain: readonly Entry[], actual: readonly SealedFile[]): Promise<string[]> {
  const out: string[] = [];
  const { manifestHash, ...body } = m;
  if ((await sha256Hex(canonical(body))) !== manifestHash) out.push('the manifest was changed after it was sealed');
  const v = await verifyChain(chain);
  if (!v.ok) out.push(`the ledger is broken at entry ${v.at}: ${v.why}`);
  else if (v.head !== m.head || chain.length !== m.entries) out.push('the ledger is not the one that was sealed (entries added or removed since)');
  for (const f of m.files) {
    const now = actual.find((a) => a.name === f.name);
    if (!now) out.push(`${f.name} is missing`);
    else if (now.sha256 !== f.sha256 || now.bytes !== f.bytes) out.push(`${f.name} has changed since it was sealed`);
  }
  return out;
}
