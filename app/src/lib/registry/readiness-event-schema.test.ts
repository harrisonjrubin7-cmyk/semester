import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { READINESS_WORKFLOW_EVENT_TYPES } from '../../../../packages/institution/src/readiness-workflow';

const schema = JSON.parse(
  readFileSync(new URL('../../../../docs/pilot/registration-readiness/readiness-event.schema.json', import.meta.url), 'utf8'),
);
const storeMigration = readFileSync(
  new URL('../../../../supabase/migrations/20261009160000_registration_readiness_store.sql', import.meta.url),
  'utf8',
);

describe('the registration-readiness event schema', () => {
  it('tracks the runtime workflow event vocabulary and durable store', () => {
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.properties.eventType.enum).toEqual([...READINESS_WORKFLOW_EVENT_TYPES]);
    for (const eventType of READINESS_WORKFLOW_EVENT_TYPES) expect(storeMigration).toContain(`'${eventType}'`);
  });

  it('requires the receipt-bound event identity and refuses undeclared fields', () => {
    expect(schema.required).toEqual([
      'eventType',
      'aggregateId',
      'idempotencyKey',
      'correlationId',
      'payload',
    ]);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.idempotencyKey).toMatchObject({ minLength: 1, maxLength: 300 });
    expect(schema.properties.correlationId.pattern).toBe('^[A-Za-z0-9._:-]{8,128}$');
  });

  it('carries only identifiers and versions, with timeout as the sole optional reason', () => {
    const payload = schema.properties.payload;
    expect(payload.required).toEqual(['evaluationId', 'termId', 'version']);
    expect(payload.additionalProperties).toBe(false);
    expect(Object.keys(payload.properties)).toEqual(['evaluationId', 'termId', 'version', 'reason']);
    expect(payload.properties.version).toMatchObject({ type: 'integer', minimum: 1 });
    expect(payload.properties.reason.enum).toEqual(['evaluator_timeout']);
    expect(schema.allOf[0].if.properties.eventType.not.const).toBe('registration.readiness_evaluated');
    expect(schema.allOf[0].then.properties.payload.not.required).toEqual(['reason']);
  });
});
