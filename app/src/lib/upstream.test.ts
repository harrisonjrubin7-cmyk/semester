import { describe, expect, it } from 'vitest';
import { chooseUpstream, gatewayModel } from '../../../supabase/functions/_shared/upstream';

/**
 * The shared-key function can send to Vercel AI Gateway instead of Anthropic.
 * Only what leaves the function changes: see `_shared/upstream.ts`.
 */

describe('the gateway model id', () => {
  it('prefixes the provider and writes the version with a dot', () => {
    expect(gatewayModel('claude-haiku-4-5')).toBe('anthropic/claude-haiku-4.5');
    expect(gatewayModel('claude-fable-5-1')).toBe('anthropic/claude-fable-5.1');
  });
  it('leaves a model with no minor version alone', () => {
    expect(gatewayModel('claude-opus-5')).toBe('anthropic/claude-opus-5');
    expect(gatewayModel('claude-sonnet-5')).toBe('anthropic/claude-sonnet-5');
  });
  it('drops a date and does not prefix twice', () => {
    expect(gatewayModel('claude-haiku-4-5-20251001')).toBe('anthropic/claude-haiku-4.5');
    expect(gatewayModel('anthropic/claude-opus-5')).toBe('anthropic/claude-opus-5');
  });
});

describe('where the request goes', () => {
  const body = JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 10, messages: [] });

  it('is the gateway, with a bearer token and its model id, when the gateway has a key', () => {
    const u = chooseUpstream({ gateway: 'vck_x', anthropic: 'sk-ant-y' })!;
    expect(u.gateway).toBe(true);
    expect(u.url).toBe('https://ai-gateway.vercel.sh/v1/messages');
    expect(u.headers.Authorization).toBe('Bearer vck_x');
    expect(u.headers['x-api-key']).toBeUndefined();
    expect(JSON.parse(u.body(body)).model).toBe('anthropic/claude-haiku-4.5');
    expect(JSON.parse(u.body(body)).max_tokens).toBe(10);
  });

  it('never carries the gateway key to Anthropic', () => {
    const u = chooseUpstream({ gateway: 'vck_x', anthropic: 'sk-ant-y' })!;
    expect(JSON.stringify(u.headers)).not.toContain('sk-ant-y');
  });

  it('is Anthropic, with the body untouched, when only its key is set', () => {
    const u = chooseUpstream({ anthropic: 'sk-ant-y' })!;
    expect(u.gateway).toBe(false);
    expect(u.url).toBe('https://api.anthropic.com/v1/messages');
    expect(u.headers['x-api-key']).toBe('sk-ant-y');
    expect(u.body(body)).toBe(body);
  });

  it('is Anthropic when the gateway key is the empty string an unset secret reads as', () => {
    const u = chooseUpstream({ gateway: '', anthropic: 'sk-ant-y' })!;
    expect(u.gateway).toBe(false);
    expect(u.headers['x-api-key']).toBe('sk-ant-y');
  });

  it('is nowhere when neither key is set', () => {
    expect(chooseUpstream({})).toBeNull();
    expect(chooseUpstream({ gateway: null, anthropic: null })).toBeNull();
  });
});
