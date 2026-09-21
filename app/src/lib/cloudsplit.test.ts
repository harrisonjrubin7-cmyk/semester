/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The address and the key are one setting, and two files used to disagree.
 *
 * `lib/cloud.ts` needs both `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`
 * before it will say this build has accounts. `lib/assistant.ts` needed only
 * the address before it would say this build has a shared key service. A
 * build with one and not the other — one repository variable away, since
 * `SETUP.md` asks for the pair — therefore had a shared key service that
 * nothing could ever authenticate to, because the token that reaches it only
 * exists inside the effect in `state/store.tsx` that returns early without an
 * account service.
 *
 * `route()` was right by accident throughout: `sessionToken()` is null, so it
 * answered `none`. Every sentence explaining why was wrong. Measured on such
 * a build, in one page load:
 *
 *     #/draw, #/work, #/solve   "Sign in to use the shared key, or add your own."
 *     #/groupwork               a Sign in button, leading to…
 *     #/account                 "This build has no account service"
 *     #/classmates              "No account service on this build"
 *
 * which is the fault `components/NeedsKey.tsx`'s own docstring is about —
 * one install being told two different stories about whether signing in
 * would help — arriving through the door `routeWhy` left open.
 *
 * ## Why this is a source check
 *
 * Both conditions are read from `import.meta.env` at module scope, so a test
 * cannot restub them per case without a fresh module registry per case. What
 * matters is not the value on this run but that the two files ask for the
 * same pair, so that is what is asserted — and `assistant.test.ts` next door
 * covers what `sharedEndpoint()` returns for the values it does see.
 */

const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

/** The `env.VITE_…` names a function's body reads. */
function envNames(source: string, fn: string): string[] {
  const at = source.indexOf(`export function ${fn}(`);
  expect(at, `${fn} has moved; re-point this guard`).toBeGreaterThan(-1);
  const body = source.slice(at, source.indexOf('\n}', at));
  return [...new Set([...body.matchAll(/env\.(VITE_[A-Z_]+)/g)].map((m) => m[1]))].sort();
}

describe('one setting, read the same way in both files', () => {
  const cloud = read('./cloud.ts');
  const assistant = read('./assistant.ts');

  it('has the two declarations this guard reads', () => {
    // The probe, pointed at itself: a regex that matched nothing would make
    // the comparison below vacuously true.
    expect(cloud).toMatch(/const URL = env\.VITE_SUPABASE_URL/);
    expect(cloud).toMatch(/const KEY = env\.VITE_SUPABASE_KEY/);
    expect(envNames(assistant, 'sharedEndpoint').length).toBeGreaterThan(0);
  });

  /*
   * The guard. Revert `sharedEndpoint()` to reading the address alone and
   * this goes red, naming the variable it stopped asking for.
   */
  it('asks for the key as well as the address before claiming a shared service', () => {
    expect(envNames(assistant, 'sharedEndpoint')).toEqual(['VITE_SUPABASE_KEY', 'VITE_SUPABASE_URL']);
  });

  it('is the same pair cloudConfigured is built from', () => {
    const pair = [...new Set([...cloud.matchAll(/env\.(VITE_SUPABASE_[A-Z_]+)/g)].map((m) => m[1]))].sort();
    expect(envNames(assistant, 'sharedEndpoint')).toEqual(pair);
    expect(cloud).toMatch(/cloudConfigured = Boolean\(URL && KEY\)/);
  });

  /*
   * The control. Every assertion above is that a name is present, and a
   * helper that returned every `VITE_` name in the file would satisfy them —
   * so this is the one that says it reads the function and not the module.
   */
  it('CONTROL: reads one function, not the whole file', () => {
    const whole = [...new Set([...assistant.matchAll(/env\.(VITE_[A-Z_]+)/g)].map((m) => m[1]))];
    expect(whole.length, 'assistant.ts reads more env names than sharedEndpoint does').toBeGreaterThan(2);
    expect(envNames(assistant, 'sharedEndpoint')).not.toEqual([...whole].sort());
  });
});

/**
 * And the deploy, which is where the half-configured build would come from.
 *
 * The workflow used to note the pair and carry on. A notice is the right
 * shape for "no variables set, falling back to the committed file" and the
 * wrong one for "one of two set", which is not a partial configuration but a
 * build that contradicts itself on screen.
 */
describe('the deploy refuses a half-configured build', () => {
  const pages = readFileSync(new URL('../../../.github/workflows/pages.yml', import.meta.url), 'utf8');

  it('fails when the address is set without the key', () => {
    expect(pages).toMatch(/-n "\$VITE_SUPABASE_URL" \] && \[ -z "\$VITE_SUPABASE_KEY"/);
  });

  it('fails when the key is set without the address', () => {
    expect(pages).toMatch(/-z "\$VITE_SUPABASE_URL" \] && \[ -n "\$VITE_SUPABASE_KEY"/);
  });

  it('exits rather than only noting it', () => {
    const at = pages.indexOf('-n "$VITE_SUPABASE_URL" ] && [ -z "$VITE_SUPABASE_KEY"');
    expect(pages.slice(at, at + 600)).toContain('exit 1');
  });

  /*
   * The control: the both-set and neither-set cases are still notices, so
   * this has not turned an ordinary device-only build into a failure.
   */
  it('CONTROL: still only notes the configured and device-only builds', () => {
    expect(pages).toContain('this build has accounts.');
    expect(pages).toContain('falls back to the committed app/.env.production.');
  });
});
