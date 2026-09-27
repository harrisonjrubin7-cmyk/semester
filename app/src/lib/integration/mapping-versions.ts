/**
 * Tenant mapping versions: propose, simulate, approve, go live, roll back.
 *
 * A school may adjust how a provider's fields map onto Semester's — within the
 * bounded transforms `adapter.ts` allows, never an expression somebody types.
 * Every change is a new version, and the rules below are the whole workflow:
 *
 * - A version goes live only after a simulation that did not come back
 *   `blocked` (see `simulate.ts`), recorded on the version.
 * - The person who approves is not the person who proposed.
 * - Rollback does not rewrite history: it makes the previous version live
 *   again as a new event, and the one it replaced is marked rolled back.
 *
 * Pure: each function takes the history and returns the next one or a
 * sentence saying why not. The persisted form is `tenant_mapping_versions`
 * beside #779's `integration_mappings`.
 *
 * See `docs/TENANT-MAPPING-CONFIGURATION.md`.
 */
import type { EntityMapping, Transform } from './adapter.ts';

export type VersionStatus = 'proposed' | 'approved' | 'live' | 'retired' | 'rolled_back';

export const VERSION_STATUSES: readonly VersionStatus[] = ['proposed', 'approved', 'live', 'retired', 'rolled_back'];

export interface MappingVersion {
  version: number;
  entity: string;
  mapping: EntityMapping;
  status: VersionStatus;
  proposedBy: string;
  proposedAt: string;
  simulation: { runId: string; verdict: 'ready' | 'review' | 'blocked' } | null;
  approvedBy: string | null;
  liveAt: string | null;
  events: { at: string; by: string; what: string }[];
}

export type Step = { ok: true; versions: MappingVersion[] } | { ok: false; why: string };

/** The transforms a school may choose. Anything else is refused, not evaluated. */
export const ALLOWED_TRANSFORMS: readonly Transform[] = ['none', 'trim', 'lower', 'iso_datetime'];

export function mappingProblems(m: EntityMapping): string[] {
  const out: string[] = [];
  for (const f of m.fields) {
    if (!ALLOWED_TRANSFORMS.includes(f.transform ?? 'none')) out.push(`${f.external}: transform ${String(f.transform)} is not allowed`);
    if (!/^[A-Za-z][A-Za-z0-9_.]{0,63}$/.test(f.external)) out.push(`${f.external}: not a field name`);
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(f.canonical)) out.push(`${f.canonical}: not a canonical field name`);
  }
  return out;
}

const replace = (list: MappingVersion[], v: MappingVersion) => list.map((x) => (x.version === v.version ? v : x));

export function propose(versions: MappingVersion[], mapping: EntityMapping, by: string, now: Date): Step {
  const problems = mappingProblems(mapping);
  if (problems.length) return { ok: false, why: problems[0] };
  if (!by.trim()) return { ok: false, why: 'A proposal needs the person making it.' };
  const version = Math.max(0, ...versions.map((v) => v.version)) + 1;
  const at = now.toISOString();
  return {
    ok: true,
    versions: [
      ...versions,
      {
        version, entity: mapping.externalEntity, mapping: { ...mapping, version }, status: 'proposed',
        proposedBy: by, proposedAt: at, simulation: null, approvedBy: null, liveAt: null,
        events: [{ at, by, what: 'proposed' }],
      },
    ],
  };
}

export function recordSimulation(
  versions: MappingVersion[], version: number, runId: string, verdict: 'ready' | 'review' | 'blocked', by: string, now: Date,
): Step {
  const v = versions.find((x) => x.version === version);
  if (!v || v.status !== 'proposed') return { ok: false, why: 'Only a proposed version can be simulated.' };
  return {
    ok: true,
    versions: replace(versions, {
      ...v, simulation: { runId, verdict }, events: [...v.events, { at: now.toISOString(), by, what: `simulated: ${verdict}` }],
    }),
  };
}

export function approve(versions: MappingVersion[], version: number, by: string, now: Date): Step {
  const v = versions.find((x) => x.version === version);
  if (!v || v.status !== 'proposed') return { ok: false, why: 'Only a proposed version can be approved.' };
  if (!v.simulation) return { ok: false, why: 'Simulate it before approving it.' };
  if (v.simulation.verdict === 'blocked') return { ok: false, why: 'Its simulation was blocked.' };
  if (by.trim() === v.proposedBy.trim()) return { ok: false, why: 'Somebody other than the proposer must approve it.' };
  return {
    ok: true,
    versions: replace(versions, {
      ...v, status: 'approved', approvedBy: by, events: [...v.events, { at: now.toISOString(), by, what: 'approved' }],
    }),
  };
}

/** Make an approved version live; the one it replaces is retired. */
export function goLive(versions: MappingVersion[], version: number, by: string, now: Date): Step {
  const v = versions.find((x) => x.version === version);
  if (!v || v.status !== 'approved') return { ok: false, why: 'Only an approved version can go live.' };
  const at = now.toISOString();
  const next = versions.map((x) =>
    x.status === 'live' ? { ...x, status: 'retired' as const, events: [...x.events, { at, by, what: `retired by v${version}` }] } : x,
  );
  return {
    ok: true,
    versions: replace(next, { ...v, status: 'live', liveAt: at, events: [...v.events, { at, by, what: 'live' }] }),
  };
}

/**
 * Put the most recently retired version back. The live one is marked rolled
 * back, not deleted, and both carry the event.
 */
export function rollback(versions: MappingVersion[], by: string, now: Date): Step {
  const live = versions.find((x) => x.status === 'live');
  if (!live) return { ok: false, why: 'Nothing is live to roll back.' };
  const previous = versions
    .filter((x) => x.status === 'retired' && x.version < live.version)
    .sort((a, b) => b.version - a.version)[0];
  if (!previous) return { ok: false, why: 'There is no earlier version to return to.' };
  const at = now.toISOString();
  let next = replace(versions, {
    ...live, status: 'rolled_back', events: [...live.events, { at, by, what: `rolled back to v${previous.version}` }],
  });
  next = replace(next, {
    ...previous, status: 'live', liveAt: at, events: [...previous.events, { at, by, what: `live again after rollback of v${live.version}` }],
  });
  return { ok: true, versions: next };
}
