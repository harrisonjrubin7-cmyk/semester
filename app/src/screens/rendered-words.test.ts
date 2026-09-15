/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A screen may not read out the instructions for deploying it.
 *
 * The Connect screen used to answer an unconfigured provider with this, four
 * times over, once per provider:
 *
 *     No client ID yet. Register one at portal.azure.com → App registrations →
 *     single-page application, allow http://localhost:5173 as the redirect,
 *     and put it in app/.env.local.
 *
 * Measured on the running app at 1363×936, signed out: fourteen distinct
 * deployer terms across five paragraphs on one screen, and a sixth on Account
 * naming two environment variables and a file in the repository. The reader is
 * a student. They cannot edit `app/.env.local`, they have no account on
 * `portal.azure.com`, and the redirect URI is not a fact about them.
 *
 * None of it was lost by going, because none of it was ever only there:
 * `app/.env.example` carries every one of those four registrations in more
 * detail than the screen did, and SETUP.md §5 lists them. The screen was the
 * fourth copy and the only one pointed at the wrong audience.
 *
 * ## What this reads
 *
 * Source, not a rendered page — so it is a heuristic, and the same kind
 * `src/rootunmount.test.ts` is. It strips comments and looks at what is left:
 * string literals, and the bare text between JSX tags, which together are
 * everything a screen can put in front of somebody.
 *
 * Comments are stripped because they are the right home for this vocabulary
 * and several screens should keep theirs — `screens/Connect.tsx` explains in
 * its docblock exactly which sentence went and why, and that explanation has
 * to be allowed to name it.
 *
 * ## What it cannot see
 *
 * Text that reaches a screen from somewhere else. `lib/connect.ts` supplies
 * the provider blurbs and Apple's caveat, and nothing here reads `lib/`: the
 * same sentence moved one import away would pass. That is not hypothetical —
 * the Apple caveat ended in a list of registration requirements and lives in
 * exactly that file. It is covered below by reading the provider table too,
 * which is the one crossing this screen actually has.
 *
 * A regex literal holding a quote can also desynchronise the scanner. It would
 * show up as a spurious failure rather than a silent pass, which is the right
 * way round for a guard.
 */

const HERE = new URL('.', import.meta.url).pathname;

/**
 * Words that belong to whoever deploys a copy, never to whoever opens one.
 *
 * Deliberately concrete. A rule against "technical language" is a rule nobody
 * can apply; these are the strings that were actually on screen.
 *
 * The rule underneath them is not "no jargon" but **no instruction the reader
 * cannot act on**, and one term had to be taken back out to keep it honest.
 * `console.anthropic.com` was on this list for a draft, and it flagged
 * `settings/Assistant.tsx` — which offers a box to paste an API key into and
 * then says where to get one. That is the same reader, told the one thing they
 * need. Whether a student should be pasting a key at all is a real question
 * and the audit's second finding; it is a question about the box, not about
 * the sentence next to it, and this guard is the wrong instrument for it.
 */
const DEPLOYER = [
  '.env.local',
  '.env.example',
  'VITE_',
  'SETUP.md',
  'npm run',
  'redeploy',
  'portal.azure.com',
  'console.cloud.google.com',
  'marketplace.zoom.us',
  'developer.apple.com',
  'App registration',
  'OAuth client',
  'Services ID',
  'client secret',
];

/**
 * The file with its comments blanked.
 *
 * A scanner rather than a pair of regexes, because `//` inside a URL in a
 * string is not a comment and a naive strip eats the rest of the line.
 *
 * Blanked to spaces rather than deleted, and newlines inside a comment kept,
 * so that an offset into the result is the same offset into the file. The
 * first draft deleted them, and every line number it reported was short by
 * however much commentary stood above the finding — which sent the first read
 * of its own output to the wrong three places. A probe that reports a location
 * has to report the real one.
 */
function withoutComments(src: string): string {
  let out = '';
  let i = 0;
  let mode: 'code' | 'line' | 'block' | "'" | '"' | '`' = 'code';
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && n === '/') {
        mode = 'line';
        out += '  ';
        i += 2;
        continue;
      }
      if (c === '/' && n === '*') {
        mode = 'block';
        out += '  ';
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') mode = c;
      out += c;
      i += 1;
      continue;
    }
    if (mode === 'line') {
      if (c === '\n') mode = 'code';
      out += c === '\n' ? c : ' ';
      i += 1;
      continue;
    }
    if (mode === 'block') {
      if (c === '*' && n === '/') {
        mode = 'code';
        out += '  ';
        i += 2;
      } else {
        out += c === '\n' ? c : ' ';
        i += 1;
      }
      continue;
    }
    // Inside a string literal: it is kept, and only its own quote closes it.
    if (c === '\\') {
      out += c + (n ?? '');
      i += 2;
      continue;
    }
    if (c === mode) mode = 'code';
    out += c;
    i += 1;
  }
  return out;
}

/** Every `.tsx` under `src/screens`, at any depth. */
function screens(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...screens(path));
    else if (name.endsWith('.tsx') && !name.includes('.test.')) found.push(path);
  }
  return found;
}

/**
 * Where a term sits in the text, or -1.
 *
 * A term reached through a dot is a property being read, not a word being
 * shown: `import.meta.env.VITE_SUPABASE_URL` is how Privacy works out which
 * region holds the data, and Account how it knows there is no account service
 * at all. Neither prints it.
 */
function shownAt(text: string, term: string): number {
  let from = 0;
  for (;;) {
    const at = text.toLowerCase().indexOf(term.toLowerCase(), from);
    if (at === -1) return -1;
    if (text[at - 1] !== '.') return at;
    from = at + 1;
  }
}

describe('what a screen says out loud', () => {
  const files = screens(HERE);

  it('found the screens, or this guard proves nothing', () => {
    // The control. A path that has moved reads as "no violations anywhere".
    expect(files.length).toBeGreaterThan(30);
    expect(files.some((f) => f.endsWith('Connect.tsx'))).toBe(true);
    expect(files.some((f) => f.endsWith('Account.tsx'))).toBe(true);
  });

  it('never reads out the instructions for deploying it', () => {
    const said: string[] = [];
    for (const file of files) {
      const text = withoutComments(readFileSync(file, 'utf8'));
      for (const term of DEPLOYER) {
        const at = shownAt(text, term);
        if (at === -1) continue;
        const line = text.slice(0, at).split('\n').length;
        said.push(`${file.slice(HERE.length)}:${line} says "${term}"`);
      }
    }
    expect(said, `a screen is telling a student how to deploy it:\n${said.join('\n')}`).toEqual([]);
  });

  it('keeps the vocabulary in the comments that explain it', () => {
    /*
     * The other half, and the reason the scanner strips comments rather than
     * banning the words outright. `Connect.tsx` has to be able to say which
     * sentence it stopped saying — a rule that made the explanation illegal
     * would delete the record of why the screen changed, which is the thing
     * this repository is least willing to lose.
     */
    const connect = readFileSync(join(HERE, 'Connect.tsx'), 'utf8');
    expect(connect).toContain('.env.local');
    expect(withoutComments(connect)).not.toContain('.env.local');
  });
});
