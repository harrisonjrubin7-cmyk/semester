/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Reading a setting must not cost an API client.
 *
 * `lib/assistant.ts` says which provider answers, which model, and which of
 * the four routes a question would take. `lib/claude.ts` and `lib/openai.ts`
 * are what *ask* — sixteen hundred lines and two hundred more, plus
 * `lib/figure.ts`, `lib/study.ts` and `lib/controls.ts` behind them.
 *
 * They were one file, and the cost of that was paid on every first load by
 * everybody: `App.tsx` imported `provider()` — six words deciding whether a
 * heading says Claude or GPT — and `state/store.tsx` imported
 * `setSessionToken`, six lines setting a variable. Between them those two
 * imports compiled both clients into the chunks the page cannot paint
 * without. Measured on the built bundle before the split, `api.anthropic.com`,
 * `anthropic-version` and `x-api-key` were all in the eager path; after it,
 * neither `api.anthropic.com` nor `api.openai.com` is, and the first load is
 * 6.6 kB gzipped lighter.
 *
 * None of that is visible from inside any of the files. All of them compile
 * either way, every test passes either way, and one convenience import — a
 * type, a constant, a helper that happens to live next door — silently puts
 * the whole thing back. So the shape is asserted here rather than left to
 * whoever is next.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/**
 * The same file with its comments taken out.
 *
 * `ai/split.test.ts` learned this first and the reason has not changed: this
 * codebase explains at length what a file used to do, so a test that cannot
 * tell the explanation from the thing explained fails on its own
 * documentation. Every note above mentions the imports being forbidden.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** Every `from '…'` in a file, which is what decides what a chunk carries. */
const importsOf = (path: string) =>
  [...code(path).matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);

describe('the settings are a cheap half and the clients are not', () => {
  it('reads a setting without importing anything that sends a request', () => {
    // `./token` is the one import it is allowed, and that file holds a
    // variable and two functions.
    for (const client of ['./claude', './openai']) {
      expect(importsOf('./assistant.ts'), `assistant.ts should not import ${client}`).not.toContain(
        client,
      );
    }
  });

  it('keeps the first paint clear of both clients', () => {
    // These two are eager: `App.tsx` is the entry and `store.tsx` is mounted
    // above every screen. What they import, everybody downloads.
    for (const [file, prefix] of [
      ['../App.tsx', './lib/'],
      ['../state/store.tsx', '../lib/'],
    ] as const) {
      for (const client of ['claude', 'openai']) {
        expect(importsOf(file), `${file} should not import lib/${client}`).not.toContain(
          `${prefix}${client}`,
        );
      }
    }
  });

  it('leaves one route to each name rather than two', () => {
    /*
     * A re-export from `claude.ts` would make both halves work and undo the
     * whole thing: every importer that kept the old path would pull the client
     * again, and nothing would fail. This codebase spends its audits removing
     * second routes to one thing; this is the one that would cost measurable
     * bytes as well as clarity.
     */
    const client = code('./claude.ts');
    expect(client).not.toMatch(/export\s*\{[^}]*\bsettings\b[^}]*\}\s*from\s*'\.\/assistant'/);
    expect(client).not.toMatch(/export\s*\*\s*from\s*'\.\/assistant'/);
  });

  it('points the token at nothing at all', () => {
    // The smallest module in the app, and it has to stay that way: the store
    // imports it on sign-in, which is the eager path again.
    expect(importsOf('./token.ts')).toEqual([]);
  });
});
