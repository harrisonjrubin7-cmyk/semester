/**
 * The conformance suite every adapter runs before it is added to
 * `app/server/integration/registry.ts`, and again in CI for as long as it is
 * there. `declaration.contractTests` names the test file that calls this.
 *
 * It checks the adapter against the *framework's* promises, not the
 * provider's behaviour — that is what a sandbox tenant is for. Each check is
 * independent and reports `ok` with a one-line detail, so a failing adapter
 * says which promise it broke:
 *
 *   declaration            passes `validateDeclaration`
 *   native_fallback        a native screen still does the job when it is off
 *   live_not_mock          a live adapter is not a fixture
 *   cursor_chain           the second pull starts where the first stopped
 *   idempotent_replay      the same batch twice writes once
 *   declared_entities_only it returns only entities its mapping declares
 *   ingest_clean           its own batch goes through the pipeline without error
 *   never_ingest_dropped   a forbidden field is refused, not stored
 *   provider_calls_guarded every provider call goes through `client.call`
 *   no_secret_in_output    nothing token-shaped, and not the canary credential, comes out
 *   disable_safe           kill switch → paused, with the native route intact
 *
 * `contract-harness.test.ts` runs this against the mock adapters and, as
 * controls, against adapters broken in exactly one way each. A check that no
 * broken adapter can fail would be decoration.
 */
import { validateDeclaration, type AdapterDeclaration } from './adapter.ts';
import { ingest, type IngestStore, type ProviderBatch } from './pipeline.ts';
import { NATIVE_FALLBACK } from './fallback.ts';
import { connectionHealth, degradedExperience } from './health.ts';
import type { CallAuth, ProviderClient } from './provider-client.ts';

export interface ContractPullRequest {
  connectionPublicId: string;
  tenantId: string;
  providerBaseUrl?: string;
  cursor: Record<string, unknown>;
  trigger: 'scheduled' | 'replay';
}

export interface ContractSubject {
  declaration: AdapterDeclaration;
  pull(request: ContractPullRequest, client: ProviderClient): Promise<ProviderBatch>;
}

export interface ContractOptions {
  /** True when the adapter is about to be registered for real connections. */
  live: boolean;
  now?: Date;
  /** The pipeline under test. Defaults to the real one; a test swaps in a broken one. */
  ingestWith?: typeof ingest;
}

export interface ContractCheck {
  id: string;
  ok: boolean;
  detail: string;
}

/** The credential the harness hands every adapter. It must never appear in what comes back. */
const CANARY = 'canary-credential-7f3a9c1e5b2d';
const TENANT = 'contract-tenant';
const CONNECTION = 'contract-connection';
const TOKEN_SHAPED = /(bearer\s+[a-z0-9._~+/-]{10,}|access_token|refresh_token|client_secret|api[_-]?key\s*[:=]|password\s*[:=])/i;

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Resolves every subject and grants every consent, on purpose: the harness
 * asks whether the adapter's output is well formed, not whether a particular
 * person consented. Consent and subject rules have their own tests in
 * `pipeline.test.ts`.
 */
function contractStore(): IngestStore {
  const keys = new Set<string>();
  return {
    async claimIdempotencyKey(connection, key) {
      const k = `${connection}\u0000${key}`;
      if (keys.has(k)) return false;
      keys.add(k);
      return true;
    },
    async lastSourceTimestamp() { return null; },
    async resolveSubject(_tenant, subject) { return `user:${subject}`; },
    async hasConsent() { return true; },
  };
}

export async function runContract(subject: ContractSubject, options: ContractOptions): Promise<ContractCheck[]> {
  const { declaration: d } = subject;
  const now = options.now ?? new Date('2026-10-01T12:00:00Z');
  const checks: ContractCheck[] = [];
  const check = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail: ok ? 'ok' : detail });

  const problems = validateDeclaration(d);
  check('declaration', problems.length === 0, problems.join('; '));
  check('native_fallback', Boolean(NATIVE_FALLBACK[d.domain]?.nativeRoute), `${d.domain} has no native fallback`);
  check('live_not_mock', !(options.live && d.mock), 'a mock cannot be registered as a live adapter');

  const request = (cursor: Record<string, unknown>): ContractPullRequest =>
    ({
      connectionPublicId: CONNECTION,
      tenantId: TENANT,
      providerBaseUrl: 'https://contract.instructure.com',
      cursor,
      trigger: 'scheduled',
    });

  // A client that records its use. An adapter that never calls it has made its
  // provider calls some other way, round the guard, the vault and OAuth.
  let guardedCalls = 0;
  const auth: CallAuth = d.authentication === 'oauth2' || d.authentication === 'oidc'
    ? { accessToken: CANARY, secret: null } : { accessToken: null, secret: CANARY };
  const client: ProviderClient = {
    async call(fn) {
      guardedCalls++;
      return fn(auth);
    },
  };

  let first: ProviderBatch | null = null;
  let second: ProviderBatch | null = null;
  try {
    first = await subject.pull(request({}), client);
    second = await subject.pull(request(first.cursorAfter), client);
  } catch (error) {
    const why = `pull threw ${error instanceof Error ? error.constructor.name : typeof error}`;
    for (const id of ['cursor_chain', 'idempotent_replay', 'declared_entities_only', 'ingest_clean', 'never_ingest_dropped', 'provider_calls_guarded', 'no_secret_in_output']) {
      check(id, false, why);
    }
    first = null;
  }

  if (first && second) {
    const seen = new Set(first.records.map((r) => `${r.entityType}\u0000${r.id}\u0000${r.updatedAt ?? ''}`));
    const repeated = second.records.filter((r) => seen.has(`${r.entityType}\u0000${r.id}\u0000${r.updatedAt ?? ''}`)).length;
    check('cursor_chain',
      sameJson(second.cursorBefore, first.cursorAfter) && repeated === 0 && (first.records.length === 0 || second.idempotencyKey !== first.idempotencyKey),
      `second pull ${sameJson(second.cursorBefore, first.cursorAfter) ? '' : 'did not start at the first cursor; '}${repeated ? `returned ${repeated} records again; ` : ''}${second.idempotencyKey === first.idempotencyKey ? 'reused the idempotency key' : ''}`.trim());

    const declared = new Set(d.entities.map((e) => e.externalEntity));
    const stray = [...new Set(first.records.map((r) => r.entityType).filter((t) => !declared.has(t)))];
    check('declared_entities_only', stray.length === 0, `returned undeclared entities: ${stray.join(', ')}`);

    const connection = {
      tenantId: TENANT, publicId: CONNECTION, status: 'healthy' as const, approved: true,
      approvedScopes: d.scopes, classificationCeiling: d.classificationCeiling,
    };
    const pipeline = options.ingestWith ?? ingest;
    const run = (batch: ProviderBatch, store: IngestStore) =>
      pipeline({ adapter: d, connection, batch, store, killSwitchEngaged: false, now });

    const store = contractStore();
    const once = await run(first, store);
    check('ingest_clean', once.status === 'succeeded' && once.errors.length === 0,
      `its own batch ingested as ${once.status} with ${once.errors.length} errors`);
    const twice = await run(first, store);
    check('idempotent_replay', twice.status === 'duplicate' && twice.created === 0 && twice.updated === 0,
      `the same batch the second time was ${twice.status}`);

    const probe = first.records[0];
    if (probe) {
      const poisoned: ProviderBatch = {
        ...first, idempotencyKey: `${first.idempotencyKey}-probe`,
        records: [{ ...probe, fields: { ...probe.fields, grade: 'A' } }],
      };
      const result = await run(poisoned, contractStore());
      const stored = result.references.some((r) => 'grade' in r.values);
      check('never_ingest_dropped', !stored && result.errors.some((e) => e.category === 'classification_block'),
        stored ? 'a grade field was stored' : 'a grade field was not refused');
    } else {
      check('never_ingest_dropped', false, 'the fixture returned no record to probe with');
    }

    check('provider_calls_guarded', guardedCalls > 0, 'a pull made no call through client.call, so nothing it did was rate limited or authorized');

    const output = JSON.stringify(first) + JSON.stringify(second);
    check('no_secret_in_output',
      !TOKEN_SHAPED.test(output) && !output.includes(CANARY) && !(d.credentialsReference && output.includes(d.credentialsReference)),
      'a pull returned something token-shaped, the credential it was given, or the credential pointer');
  }

  let disableSafe = false;
  try {
    const health = connectionHealth({
      approved: true, paused: false, killSwitchEngaged: true, auth: 'ok', breaker: 'closed', rateLimitedUntil: null,
      lastSuccessAt: now, lastRun: { status: 'succeeded', at: now }, freshnessTargetMinutes: d.freshnessTargetMinutes,
      openDeadLetters: 0, driftHeld: false, now,
    });
    const experience = degradedExperience(d.domain, health, d.sourceOfTruth);
    disableSafe = health.status === 'paused' && experience.coreJourneyAvailable
      && experience.nativeRoute === NATIVE_FALLBACK[d.domain]?.nativeRoute
      && experience.student !== null && !experience.officialCurrent;
  } catch {
    // A domain with no fallback cannot say what keeps working: that is the failure.
  }
  check('disable_safe', disableSafe, 'with the kill switch on the native route was lost or the screen still called the data official');
  return checks;
}

export const contractFailures = (checks: readonly ContractCheck[]): ContractCheck[] => checks.filter((c) => !c.ok);
