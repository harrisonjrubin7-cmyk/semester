import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A few Edge Functions still keep their complete handler in index.ts because
 * the Deno runtime is their only caller. This test holds those entrypoints to
 * an ordered fail-closed boundary: reject an absent or invalid credential
 * before the first protected database read or outbound request.
 *
 * The mutation case matters. A source-pattern test that never proves it can
 * see a missing guard would report green for an empty or broken scanner.
 */

const ROOT = join(__dirname, '../../..');
const entry = (fn: string) => readFileSync(join(ROOT, 'supabase/functions', fn, 'index.ts'), 'utf8');

interface Contract {
  fn: string;
  ordered: readonly RegExp[];
}

export const ENTRY_AUTH_CONTRACTS: readonly Contract[] = [
  {
    fn: 'calendar',
    ordered: [
      /if \(!TOKEN\.test\(token\)\)/,
      /status: 404/,
      /rpc\('read_feed'/,
      /if \(error \|\| !data/,
    ],
  },
  {
    fn: 'canvas',
    ordered: [
      /const session = req\.headers\.get\('Authorization'\)/,
      /if \(!session\).*401/,
      /admin\.auth\.getUser\(session\)/,
      /if \(authError \|\| !user\?\.user\)/,
      /upstream = await fetch/,
    ],
  },
  {
    fn: 'fetchcal',
    ordered: [
      /const token = req\.headers\.get\('Authorization'\)/,
      /if \(!token\).*401/,
      /admin\.auth\.getUser\(token\)/,
      /if \(authError \|\| !user\?\.user\)/,
      /followSafely\(/,
    ],
  },
  {
    fn: 'productivity-sourcecheck',
    ordered: [
      /const auth=req\.headers\.get\('authorization'\)/,
      /client\.auth\.getUser\(\)/,
      /if\(error\|\|!data\.user\)return response\(401/,
      /approvedUrl\(input\.url\)/,
      /page=await fetch\(/,
    ],
  },
  {
    fn: 'push',
    ordered: [
      /if \(!CRON_SECRET\)/,
      /status: 503/,
      /req\.headers\.get\('Authorization'\) !== `Bearer \$\{CRON_SECRET\}`/,
      /status: 401/,
      /createClient\(SUPABASE_URL, SERVICE_KEY\)/,
    ],
  },
  {
    fn: 'lti',
    ordered: [
      /if \(path\.endsWith\('\/score'\)\)/,
      /const bearer = req\.headers\.get\('Authorization'\)/,
      /if \(!bearer\).*401/,
      /client\.auth\.getUser\(bearer\)/,
      /if \(authError \|\| !session\?\.user\).*401/,
      /\.from\('lti_identity'\)/,
    ],
  },
];

function problems(contract: Contract, source: string): string[] {
  const out: string[] = [];
  let previous = -1;
  for (const pattern of contract.ordered) {
    const relative = source.slice(previous + 1).search(pattern);
    const at = relative < 0 ? -1 : previous + 1 + relative;
    if (at < 0) out.push(`missing ${pattern}`);
    previous = at;
  }
  return out;
}

describe('inline Edge Function authentication', () => {
  for (const contract of ENTRY_AUTH_CONTRACTS) {
    it(`${contract.fn} rejects before protected work`, () => {
      expect(problems(contract, entry(contract.fn))).toEqual([]);
    });

    it(`${contract.fn} control detects a removed credential check`, () => {
      const source = entry(contract.fn);
      const guard = contract.ordered[0];
      expect(source).toMatch(guard);
      expect(problems(contract, source.replace(guard, ''))).not.toEqual([]);
    });
  }
});
