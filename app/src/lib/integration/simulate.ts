/**
 * The sync simulation sandbox: run a mapping against fixtures and see what
 * would happen, with no path to a live provider or to production data.
 *
 * Three walls, each a different kind:
 *
 * 1. **Types.** The runner takes a `SimulationAdapter`, which only
 *    `asSimulation` makes, and only from a declaration with `mock: true`.
 *    A live adapter does not type-check (see the `@ts-expect-error` test).
 * 2. **Run time.** `asSimulation` checks `mock` again, for a declaration that
 *    reached here through `any` or JSON.
 * 3. **Storage.** The runner makes its own in-memory store. It is never handed
 *    one, so it cannot write to the tables `ingest` writes in production — the
 *    persisted version keeps its runs in a separate `simulation` schema, which
 *    no production query reads.
 *
 * What it reports is what the dashboard needs before a mapping goes live: the
 * drift the batch shows, what `ingest` would take and refuse, and the lineage
 * conflicts in the declaration. Never writeback: a simulation has no write
 * path to fake.
 *
 * See `docs/SYNC-SIMULATION-SANDBOX.md`.
 */
import type { AdapterDeclaration } from './adapter.ts';
import { validateDeclaration } from './adapter.ts';
import { detectDrift, withoutHeld, type DriftReport } from './drift.ts';
import { lineageConflicts, lineageOf } from './lineage.ts';
import { memoryStore } from './mock-adapter.ts';
import { ingest, type ConnectionState, type ExternalRecord, type IngestResult } from './pipeline.ts';

declare const simulationBrand: unique symbol;

/** A mock declaration, checked. The only thing `simulate` accepts. */
export type SimulationAdapter = AdapterDeclaration & { readonly mock: true; readonly [simulationBrand]: true };

/** A declaration fit to simulate, or null. Never a live adapter. */
export function asSimulation(adapter: AdapterDeclaration): SimulationAdapter | null {
  return adapter.mock === true ? (adapter as SimulationAdapter) : null;
}

export interface SimulationInput {
  adapter: SimulationAdapter;
  records: readonly ExternalRecord[];
  /** Scopes and ceiling to simulate against: what the school would approve. */
  approvedScopes: readonly string[];
  classificationCeiling: ConnectionState['classificationCeiling'];
  subjects?: Record<string, string>;
  consents?: string[];
  now: Date;
}

export interface SimulationReport {
  declarationProblems: string[];
  lineageConflicts: string[];
  drift: DriftReport;
  /** What `ingest` would do with everything drift did not hold. */
  result: IngestResult;
  /** The one line an integration admin reads first. */
  verdict: 'ready' | 'review' | 'blocked';
}

export async function simulate(input: SimulationInput): Promise<SimulationReport> {
  // Checked again at run time: the type is a promise, not a proof.
  if (input.adapter.mock !== true) throw new Error('Only a mock adapter can be simulated.');
  const { adapter, now } = input;

  const declarationProblems = validateDeclaration(adapter);
  const conflicts = lineageConflicts(lineageOf(adapter));
  const drift = detectDrift(adapter, input.records);
  const connection: ConnectionState = {
    tenantId: 'simulation',
    publicId: `sim_${adapter.id}`,
    status: 'healthy',
    approved: true,
    approvedScopes: input.approvedScopes,
    classificationCeiling: input.classificationCeiling,
  };
  const result = await ingest({
    adapter,
    connection,
    batch: {
      idempotencyKey: `simulation-${now.getTime()}`,
      eventType: 'simulation',
      eventVersion: '1',
      trigger: 'manual',
      cursorBefore: {},
      cursorAfter: {},
      records: withoutHeld(input.records, drift),
    },
    store: memoryStore({ subjects: input.subjects, consents: input.consents }),
    killSwitchEngaged: false,
    now,
  });

  const verdict: SimulationReport['verdict'] =
    declarationProblems.length > 0 || conflicts.length > 0 || drift.breaking || result.status === 'failed'
      ? 'blocked'
      : result.rejected > 0 || drift.changes.length > 0
        ? 'review'
        : 'ready';
  return { declarationProblems, lineageConflicts: conflicts, drift, result, verdict };
}
