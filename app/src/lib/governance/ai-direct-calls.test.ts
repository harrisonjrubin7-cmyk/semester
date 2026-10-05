import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every place the code names a model provider's endpoint, and a refusal when a
 * new one appears.
 *
 * `docs/architecture/ai/ai-policy-enforcement-map.md` found that tenant AI
 * policy is enforced at one door (the institution gateway) and not at the
 * others, and that the doors are easy to add: a new `fetch('https://api…')`
 * is a new way to invoke a model that no kill switch, tenant policy or spend
 * meter has heard of. This is the structural check that makes adding one a
 * decision somebody writes down here, rather than something a later audit
 * finds.
 *
 * It matches a provider host inside a string literal with its scheme, so a
 * comment that names the host does not count. It is a floor, not a proof: a
 * URL built from pieces, or a provider SDK, would pass. `ai-systems.test.ts`
 * is the census of doors; this is the tripwire in front of it.
 */

const REPO = join(import.meta.dirname, '..', '..', '..', '..');
const ROOTS = ['app/src', 'app/server', 'app/api', 'supabase/functions', ...packageSources()];
const PROVIDER_URL = /['"`]https:\/\/api\.(?:anthropic|openai)\.com/;

/** Files allowed to name a provider endpoint, and why. Adding one needs a reason here. */
const DOORS: Record<string, string> = {
  'app/src/lib/claude.ts': 'consumer door: the student\'s own Anthropic key from the browser (P5), and the ping at the end of the file',
  'app/src/lib/openai.ts': 'consumer door: the student\'s own OpenAI key (P6)',
  'supabase/functions/claude/index.ts': 'shared-key function (P1): activation gate, kill row, clamp, spend meter',
  'supabase/functions/_shared/aispend.ts': 'token counting for the spend meter on the shared-key function; no completion',
};

function packageSources(): string[] {
  const dir = join(REPO, 'packages');
  return readdirSync(dir)
    .filter((p) => statSync(join(dir, p)).isDirectory())
    .map((p) => `packages/${p}/src`);
}

const isCode = (f: string) => /\.(ts|tsx|mjs|js)$/.test(f) && !/\.(test|live\.test|check)\./.test(f);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const at = join(dir, entry);
    if (statSync(at).isDirectory()) walk(at, out);
    else if (isCode(entry)) out.push(at);
  }
  return out;
}

/** Repo-relative paths of the files in `sources` that name a provider endpoint. */
function namesProvider(files: Record<string, string>): string[] {
  return Object.keys(files).filter((f) => PROVIDER_URL.test(files[f])).sort();
}

describe('direct model-provider calls', () => {
  it('appear only in the files listed as doors', () => {
    const files: Record<string, string> = {};
    for (const root of ROOTS) {
      let dir: string;
      try { dir = join(REPO, root); statSync(dir); } catch { continue; }
      for (const f of walk(dir)) files[relative(REPO, f)] = readFileSync(f, 'utf8');
    }
    // An empty scan is the way this guard fails silently.
    expect(Object.keys(files).length).toBeGreaterThan(200);

    const found = namesProvider(files);
    expect(found.filter((f) => !DOORS[f]), 'a new file calls a model provider directly: route it through the policy gateway, or list it in DOORS with the reason').toEqual([]);
    expect(Object.keys(DOORS).filter((f) => !found.includes(f)), 'a listed door no longer names a provider: remove it from DOORS').toEqual([]);
  });

  it('control: sees a literal and ignores a comment', () => {
    expect(namesProvider({ a: "fetch('https://api.anthropic.com/v1/messages')" })).toEqual(['a']);
    expect(namesProvider({ b: 'const u = `https://api.openai.com/v1/chat/completions`;' })).toEqual(['b']);
    expect(namesProvider({ c: '// the key goes to api.anthropic.com directly' })).toEqual([]);
  });
});
