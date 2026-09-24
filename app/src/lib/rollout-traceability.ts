import type { EvidenceRef, RolloutCapability } from './rollout-capabilities';

export type EvidenceStatus = 'verified' | 'unverified' | 'unavailable' | 'superseded';

export interface SourceRecord {
  ref: EvidenceRef;
  title: string;
  status: EvidenceStatus;
  checkedAt: string;
  sha256?: string;
  note: string;
}

export interface TraceabilityContext {
  repoPaths?: ReadonlySet<string>;
  attachments?: ReadonlyMap<string, number>;
  driveIds?: ReadonlySet<string>;
}

const REF = /^(repo|drive|web|attachment):(.+)$/;
const ATTACHMENT = /^attachment:(.+)#L(\d+)-L(\d+)$/;
const DRIVE_ID = /^[A-Za-z0-9_-]{20,}$/;

function syntax(ref: string): string | null {
  const match = REF.exec(ref);
  if (!match) return `invalid evidence reference ${ref}`;
  if (match[1] === 'repo' && (!match[2] || match[2].startsWith('/') || match[2].includes('..'))) {
    return `invalid repository reference ${ref}`;
  }
  if (match[1] === 'web') {
    try {
      const url = new URL(match[2]);
      if (url.protocol !== 'https:') return `invalid web URL ${ref}`;
    } catch {
      return `invalid web URL ${ref}`;
    }
  }
  if (match[1] === 'drive' && !DRIVE_ID.test(match[2])) return 'invalid Drive file ID';
  if (match[1] === 'attachment') {
    const range = ATTACHMENT.exec(ref);
    if (!range || Number(range[2]) < 1 || Number(range[3]) < Number(range[2])) {
      return `invalid attachment range ${ref}`;
    }
  }
  return null;
}

function availability(source: SourceRecord, context: TraceabilityContext): string | null {
  if (source.ref.startsWith('repo:')) {
    const path = source.ref.slice('repo:'.length);
    if (source.status === 'verified' && context.repoPaths && !context.repoPaths.has(path)) {
      return 'verified repository file is unavailable';
    }
  }
  if (source.ref.startsWith('drive:')) {
    const id = source.ref.slice('drive:'.length);
    if (source.status === 'verified' && context.driveIds && !context.driveIds.has(id)) {
      return 'verified Drive file was not read back';
    }
  }
  if (source.ref.startsWith('attachment:')) {
    const range = ATTACHMENT.exec(source.ref);
    if (!range) return null;
    const lines = context.attachments?.get(range[1]);
    if (source.status === 'verified' && lines === undefined) return 'verified attachment is unavailable';
    if (lines !== undefined && Number(range[3]) > lines) return `line range exceeds ${lines}`;
  }
  return null;
}

export function validateTraceability(
  capabilities: RolloutCapability[],
  sources: SourceRecord[],
  context: TraceabilityContext = {},
): string[] {
  const errors: string[] = [];
  const indexed = new Map<string, SourceRecord>();

  for (const source of sources) {
    const problem = syntax(source.ref);
    if (problem) errors.push(`${source.ref}: ${problem}`);
    const unavailable = availability(source, context);
    if (unavailable) errors.push(`${source.ref}: ${unavailable}`);
    if (indexed.has(source.ref)) errors.push(`${source.ref}: duplicate source record`);
    indexed.set(source.ref, source);
  }

  for (const capability of capabilities) {
    for (const ref of capability.sources) {
      const problem = syntax(ref);
      if (problem) {
        errors.push(`${capability.id}: ${problem}`);
        continue;
      }
      const source = indexed.get(ref);
      if (!source) {
        errors.push(`${capability.id}: source is not indexed ${ref}`);
        continue;
      }
      if (capability.currentState === 'verified' && source.status !== 'verified') {
        errors.push(`${capability.id}: verified capability cites ${source.status} evidence ${ref}`);
      }
    }
  }

  return errors.sort();
}
