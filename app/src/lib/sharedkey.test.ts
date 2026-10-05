import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KEY_UNUSABLE_MESSAGE, describeThrow, keyShape, sharedKey } from '../../../supabase/functions/_shared/sharedkey';

/**
 * The shared key is checked before it is sent, and a failed send is logged as
 * a kind.
 *
 * On 29 September 2026 production had the key set and answered every
 * signed-in call with 502 "Claude could not be reached", counting each one,
 * with nothing in the logs to say whether the key or the network was at
 * fault. `_shared/sharedkey.ts` says which, without a character of the key.
 */

/** Shaped like an Anthropic key, and not one. */
const FAKE = `sk-ant-api03-${'Ab3_-x'.repeat(15)}AA`;

describe('whether a key can be sent', () => {
  it('passes a key shaped like Anthropic’s', () => {
    expect(keyShape(FAKE)).toMatchObject({ sendable: true, anthropicPrefix: true, outsideAscii: 0, whitespace: 0, quotes: 0 });
  });

  it('refuses the placeholder pasted as it is written in the docs', () => {
    expect(keyShape('sk-ant-…')).toMatchObject({ sendable: false, anthropicPrefix: true, outsideAscii: 1 });
  });

  it('refuses a key pasted with its quotes, curly or straight', () => {
    expect(keyShape(`"${FAKE}"`)).toMatchObject({ sendable: false, quotes: 2 });
    expect(keyShape(`“${FAKE}”`)).toMatchObject({ sendable: false, outsideAscii: 2 });
  });

  it('refuses a break or a space inside the key', () => {
    expect(keyShape(`${FAKE.slice(0, 20)}\n${FAKE.slice(20)}`)).toMatchObject({ sendable: false, whitespace: 1 });
    expect(keyShape(`${FAKE.slice(0, 20)} ${FAKE.slice(20)}`)).toMatchObject({ sendable: false, whitespace: 1 });
  });

  it('drops the whitespace around a key, as a header would, and then passes it', () => {
    expect(sharedKey(`  ${FAKE}\n`)).toBe(FAKE);
    expect(keyShape(sharedKey(`${FAKE}\n`)).sendable).toBe(true);
    expect(sharedKey(undefined)).toBe('');
    expect(keyShape('').sendable).toBe(false);
  });

  it('never carries a character of the key', () => {
    for (const key of [FAKE, 'sk-ant-…', `"${FAKE}"`]) {
      const logged = JSON.stringify(keyShape(key));
      expect(logged).not.toContain('api03');
      expect(logged).not.toContain('Ab3');
    }
  });
});

describe('what a thrown send was', () => {
  it('names a header the runtime refused', () => {
    expect(describeThrow(new TypeError('Header value is not valid.'))).toEqual({ name: 'TypeError', kind: 'header' });
    // Deno's words for a character above U+00FF, which is what `…` is.
    expect(
      describeThrow(new TypeError('Cannot convert argument to a ByteString because the character at index 6 has a value of 8230 which is greater than 255.')),
    ).toEqual({ name: 'TypeError', kind: 'header' });
  });

  it('names the network', () => {
    const e = new TypeError('error sending request for url (https://api.anthropic.com/v1/messages): dns error: failed to lookup address');
    expect(describeThrow(e)).toEqual({ name: 'TypeError', kind: 'network' });
  });

  it('says neither when it is neither, and never repeats the message', () => {
    expect(describeThrow(new Error('something else'))).toEqual({ name: 'Error', kind: 'other' });
    expect(describeThrow('a string')).toEqual({ name: 'string', kind: 'other' });
    const e = new TypeError('error sending request for url (https://api.anthropic.com/v1/messages): connection reset');
    expect(JSON.stringify(describeThrow(e))).not.toContain('anthropic.com');
  });
});

describe('the function checks the key first, and logs a throw by its kind', () => {
  const fn = readFileSync(new URL('../../../supabase/functions/claude/index.ts', import.meta.url), 'utf8');
  const code = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('refuses an unusable key before anybody is authenticated or counted', () => {
    const check = code.indexOf('if (!shape.sendable)');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(code.indexOf('admin.auth.getUser('));
    expect(check).toBeLessThan(code.indexOf("admin.rpc('count_call'"));
    expect(code).toContain('KEY_UNUSABLE_MESSAGE');
    expect(KEY_UNUSABLE_MESSAGE).toMatch(/Add your own under Ask Claude → Settings/);
  });

  it('sends the key it checked', () => {
    // The key that is shape-checked is the one the upstream is built from and
    // the one that is sent: the gateway's when it is set, Anthropic's otherwise.
    expect(code).toMatch(/const gatewayKey = sharedKey\(Deno\.env\.get\('AI_GATEWAY_API_KEY'\)\);/);
    expect(code).toMatch(/const key = gatewayKey \|\| sharedKey\(Deno\.env\.get\('ANTHROPIC_API_KEY'\)\);/);
    expect(code).toMatch(/chooseUpstream\(\{ gateway: gatewayKey, anthropic: key \}\)/);
    expect(code).toMatch(/headers: upstreamTo\.headers,/);
  });

  it('logs a thrown send by its kind and never by its message', () => {
    const at = code.indexOf('} catch (e) {');
    expect(at).toBeGreaterThan(-1);
    const handler = code.slice(at, code.indexOf('502', at));
    expect(handler).toContain('describeThrow(e)');
    expect(handler).not.toMatch(/e\.message|String\(e\)|,\s*e\s*\)/);
  });
});
