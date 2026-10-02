import { describe, expect, it } from 'vitest';
import { credentialFindings } from './bundle-secrets.mjs';

const jwt = (payload: Record<string, unknown>) => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
};

describe('browser bundle secret scan', () => {
  it('recognizes credential shapes without returning their values', () => {
    const text = [
      ['sk-ant-api03', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('-'),
      ['sk', 'live', '1234567890abcdefghijklmnop'].join('_'),
      ['sb', 'secret', 'abcdefghijklmnopqrstuvwxyz'].join('_'),
      '-----BEGIN PRIVATE KEY-----',
    ].join('\n');
    expect(credentialFindings(text)).toEqual([
      'private-key',
      'anthropic-key',
      'stripe-secret',
      'supabase-secret',
    ]);
  });

  it('rejects a service-role JWT but permits the public anon role', () => {
    expect(credentialFindings(jwt({ role: 'service_role' }))).toContain('supabase-service-role-jwt');
    expect(credentialFindings(jwt({ role: 'anon' }))).not.toContain('supabase-service-role-jwt');
  });

  it('does not flag ordinary minified application text', () => {
    expect(credentialFindings('const re_value = "semester"; const skin="dark";')).toEqual([]);
  });
});
