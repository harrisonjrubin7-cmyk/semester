/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CORRELATION_ID_PATTERN,
  edgeJsonBody,
  identifierHeaders,
  requestIdentifiers,
} from '../../../supabase/functions/_shared/error-envelope';

describe('edge request identifiers', () => {
  it('keeps a bounded caller correlation id and mints a request id', () => {
    const ids = requestIdentifiers(
      new Headers({ 'X-Correlation-Id': 'student-action-0001' }),
      () => '00000000-0000-4000-8000-000000000001',
    );
    expect(ids).toEqual({
      requestId: '00000000-0000-4000-8000-000000000001',
      correlationId: 'student-action-0001',
    });
    expect(identifierHeaders(ids)).toEqual({
      'X-Request-Id': ids.requestId,
      'X-Correlation-Id': ids.correlationId,
    });
  });

  it('replaces malformed, executable and oversized correlation ids', () => {
    for (const supplied of ['short', '<script>alert(1)</script>', 'x'.repeat(129)]) {
      const values = [
        '00000000-0000-4000-8000-000000000010',
        '00000000-0000-4000-8000-000000000011',
      ];
      const ids = requestIdentifiers(new Headers({ 'X-Correlation-Id': supplied }), () => values.shift()!);
      expect(ids.correlationId).toBe('00000000-0000-4000-8000-000000000011');
      expect(CORRELATION_ID_PATTERN.test(ids.correlationId)).toBe(true);
    }
  });
});

describe('edge error envelope', () => {
  it('preserves domain fields and adds the shared wire contract', () => {
    expect(edgeJsonBody({
      error: {
        message: 'Choose a listed model.',
        code: 'model_not_on_plan',
        allowed_models: ['claude-haiku-4-5'],
      },
    }, 400, 'student-action-0001')).toEqual({
      error: {
        message: 'Choose a listed model.',
        code: 'model_not_on_plan',
        allowed_models: ['claude-haiku-4-5'],
        correlation_id: 'student-action-0001',
        retryable: false,
      },
      message: 'Choose a listed model.',
    });
  });

  it('uses conservative defaults and retries only 429 and 503', () => {
    expect(edgeJsonBody({ error: { message: 'Try later.' } }, 503, 'corr-0001')).toMatchObject({
      error: { code: 'unavailable', retryable: true },
    });
    expect(edgeJsonBody({ error: { message: 'Unknown outcome.' } }, 502, 'corr-0002')).toMatchObject({
      error: { code: 'outcome_uncertain', retryable: false },
    });
    expect(edgeJsonBody({ error: { message: 'No provider.' } }, 501, 'corr-0003')).toMatchObject({
      error: { code: 'provider_not_configured', retryable: false },
    });
    expect(edgeJsonBody({ ok: true }, 200, 'corr-0004')).toEqual({ ok: true });
  });
});

describe('the first adopted edge route', () => {
  const source = readFileSync(new URL('../../../supabase/functions/claude/index.ts', import.meta.url), 'utf8');

  it('uses the shared body and identifier boundary for every owned response', () => {
    expect(source).toContain('requestIdentifiers(req.headers)');
    expect(source).toContain('edgeJsonBody(body, status, ids.correlationId)');
    expect(source).toContain('Object.assign(cors, identifierHeaders(ids))');
    expect(source).toContain('X-Request-Id, X-Correlation-Id, X-Calls-Remaining');
  });

  it('does not pass an upstream refusal body through to the browser', () => {
    expect(source).toContain('await upstream.body?.cancel()');
    expect(source).toContain("'provider_refused'");
    expect(source).toContain("{ 'X-Calls-Remaining': String(Math.max(0, MONTHLY_CALLS - used)) }");
    expect(source).not.toContain('return new Response(upstream.body, { status: upstream.status, headers });');
  });
});
