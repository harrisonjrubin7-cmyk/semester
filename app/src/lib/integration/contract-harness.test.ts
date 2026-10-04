import { describe, expect, it } from 'vitest';
import type { AdapterDeclaration } from './adapter';
import type { ProviderClient } from './provider-client';
import { contractFailures, runContract, type ContractSubject } from './contract-harness';
import { MOCK_ASSIGNMENT, MOCK_LMS } from './mock-adapter';
import { ingest, type ExternalRecord, type ProviderBatch } from './pipeline';

const second: ExternalRecord = {
  ...MOCK_ASSIGNMENT, id: '9002', updatedAt: '2026-09-28T11:00:00Z',
  fields: { ...MOCK_ASSIGNMENT.fields, name: 'Problem set 4' },
};

/** A well-behaved two-page adapter over the mock LMS declaration. */
function goodAdapter(over: { declaration?: Partial<AdapterDeclaration>; pull?: ContractSubject['pull'] } = {}): ContractSubject {
  const declaration = { ...MOCK_LMS, ...over.declaration };
  const pull: ContractSubject['pull'] = async ({ cursor }, client) => {
    const first = cursor.watermark === undefined;
    // Every provider call goes through the client, as the tick requires.
    await client.call(async () => undefined);
    return {
      idempotencyKey: first ? 'evt-page-0001' : 'evt-page-0002',
      eventType: 'assignment.updated', eventVersion: '1', trigger: 'scheduled',
      cursorBefore: cursor,
      cursorAfter: { watermark: first ? 'page-1' : 'page-2' },
      records: [first ? MOCK_ASSIGNMENT : second],
    };
  };
  return { declaration, pull: over.pull ?? pull };
}

/** A real canonical reference, made by ingesting the same batch with the forbidden field removed. */
async function cleanReference(input: Parameters<typeof ingest>[0]) {
  const records = input.batch.records.map(({ fields: { grade: _grade, ...fields }, ...rest }) => ({ ...rest, fields }));
  const store = { ...input.store, claimIdempotencyKey: async () => true };
  return (await ingest({ ...input, store, batch: { ...input.batch, records } })).references[0];
}

const ALL = [
  'declaration', 'native_fallback', 'live_not_mock', 'cursor_chain', 'declared_entities_only',
  'ingest_clean', 'idempotent_replay', 'never_ingest_dropped', 'provider_calls_guarded', 'no_secret_in_output', 'disable_safe',
];

const failed = async (subject: ContractSubject, live = false) =>
  contractFailures(await runContract(subject, { live })).map((c) => c.id);

describe('the connector contract harness', () => {
  it('runs every check, and a well-behaved adapter passes all of them (the control)', async () => {
    const checks = await runContract(goodAdapter(), { live: false });
    expect(checks.map((c) => c.id).sort()).toEqual([...ALL].sort());
    expect(contractFailures(checks)).toEqual([]);
  });

  it('fails exactly the promise an adapter breaks', async () => {
    // Each case is broken in one way and must trip that check and no other.
    const sameCursor: ContractSubject['pull'] = async ({ cursor }, client) => (await client.call(async () => undefined), {
      idempotencyKey: 'evt-stuck-01', eventType: 'x', eventVersion: '1', trigger: 'scheduled',
      cursorBefore: cursor, cursorAfter: { watermark: 'stuck' }, records: [MOCK_ASSIGNMENT],
    });
    const leaky: ContractSubject['pull'] = async (request, client) => {
      const batch = await goodAdapter().pull(request, client);
      return { ...batch, records: batch.records.map((r) => ({ ...r, fields: { ...r.fields, debug: 'Bearer abcdefghijklmnop0123' } })) };
    };
    const empty: ContractSubject['pull'] = async ({ cursor }, client) => (await client.call(async () => undefined), {
      idempotencyKey: 'evt-empty-01', eventType: 'x', eventVersion: '1', trigger: 'scheduled',
      cursorBefore: cursor, cursorAfter: { watermark: 'e' }, records: [],
    });
    expect(await failed(goodAdapter({ declaration: { credentialsReference: 'a-raw-secret-not-a-pointer' } }))).toEqual(['declaration']);
    expect(await failed(goodAdapter({ pull: sameCursor }))).toEqual(['cursor_chain']);
    expect(await failed(goodAdapter({ pull: leaky }))).toEqual(['no_secret_in_output']);
    // Echoes the credential it was handed into what it returns.
    const echoes: ContractSubject['pull'] = async (request, client) => {
      const batch = await goodAdapter().pull(request, client);
      const token = await client.call(async (auth) => auth.accessToken ?? auth.secret ?? '');
      return { ...batch, records: batch.records.map((r) => ({ ...r, fields: { ...r.fields, note: `via ${token}` } })) };
    };
    expect(await failed(goodAdapter({ pull: echoes }))).toEqual(['no_secret_in_output']);
    // Calls its provider some other way, round the guard, the vault and OAuth.
    const unguarded: ProviderClient = { call: (fn) => fn({ accessToken: null, secret: null }) };
    const bypass: ContractSubject['pull'] = async (request) => goodAdapter().pull(request, unguarded);
    expect(await failed(goodAdapter({ pull: bypass }))).toEqual(['provider_calls_guarded']);
    expect(await failed(goodAdapter({ pull: empty }))).toEqual(['never_ingest_dropped']);
    expect(await failed(goodAdapter(), true)).toEqual(['live_not_mock']);
  });

  it('fails when the pipeline stores a forbidden field, and when it drops one without saying so', async () => {
    // The real pipeline refuses these; these two stand in for a pipeline that has regressed.
    const storing: typeof ingest = async (input) => {
      const result = await ingest(input);
      const poisoned = input.batch.records.some((r) => 'grade' in r.fields);
      return poisoned
        ? { ...result, errors: [], references: input.batch.records.map((r) => ({ ...result.references[0], values: { ...r.fields } })) }
        : result;
    };
    const silent: typeof ingest = async (input) => {
      const result = await ingest(input);
      return input.batch.records.some((r) => 'grade' in r.fields) ? { ...result, errors: [], references: [] } : result;
    };
    // Stores the grade and says it refused: only the stored-value check can catch this one.
    const contradictory: typeof ingest = async (input) => {
      const result = await ingest(input);
      if (!input.batch.records.some((r) => 'grade' in r.fields)) return result;
      return { ...result, references: [{ ...(await cleanReference(input)), values: { grade: 'A' } }] };
    };
    const run = async (ingestWith: typeof ingest) =>
      contractFailures(await runContract(goodAdapter(), { live: false, ingestWith })).map((c) => c.id);
    expect(await run(storing)).toEqual(['never_ingest_dropped']);
    expect(await run(contradictory)).toEqual(['never_ingest_dropped']);
    expect(await run(silent)).toEqual(['never_ingest_dropped']);
    expect(await run(ingest)).toEqual([]);
  });

  it('fails an adapter that returns an entity its mapping never declared', async () => {
    const stray: ContractSubject['pull'] = async (request, client) => {
      const batch = await goodAdapter().pull(request, client);
      return { ...batch, records: [...batch.records, { entityType: 'roster', id: 'r1', fields: { name: 'x' } }] };
    };
    const ids = await failed(goodAdapter({ pull: stray }));
    expect(ids).toContain('declared_entities_only');
    expect(ids).toContain('ingest_clean');
  });

  it('reports a pull that throws against every check that needed one, and keeps the rest', async () => {
    const boom: ContractSubject['pull'] = async () => { throw new Error('connect ECONNREFUSED https://idp?code=SECRET'); };
    const checks = await runContract(goodAdapter({ pull: boom }), { live: false });
    const ids = contractFailures(checks).map((c) => c.id).sort();
    expect(ids).toEqual(['cursor_chain', 'declared_entities_only', 'idempotent_replay', 'ingest_clean', 'never_ingest_dropped', 'provider_calls_guarded', 'no_secret_in_output'].sort());
    expect(checks.find((c) => c.id === 'declaration')?.ok).toBe(true);
    // The detail names the class of error, not its message: nothing from the provider.
    expect(JSON.stringify(checks)).not.toContain('SECRET');
  });

  it('fails an adapter for a domain with no native fallback, rather than crashing', async () => {
    const orphan = goodAdapter({ declaration: { domain: 'not_a_domain' as AdapterDeclaration['domain'] } });
    const ids = await failed(orphan);
    expect(ids).toContain('native_fallback');
    expect(ids).toContain('disable_safe');
  });

  it('passes the same batch to the pipeline it will meet in production', async () => {
    const batch: ProviderBatch = await goodAdapter().pull(
      { connectionPublicId: 'c', tenantId: 't', cursor: {}, trigger: 'scheduled' }, { call: (fn) => fn({ accessToken: null, secret: null }) });
    expect(batch.records[0].entityType).toBe('assignment');
  });
});
