import { isTestFile, reachableFrom, resolveImport, zoneOf, type Tree } from './importgraph';

/**
 * Which part of this repository may import which — the rules, and the one list
 * of exceptions, in one place.
 *
 * `docs/target-architecture/02-MONOREPO-STRUCTURE.md` §3 says what the rebuilt
 * repository's boundaries must be. This file is the part of that which is true
 * *today*: every rule below holds on `main` with no exception except the one
 * ledger, and every one was measured on the real tree before it was written
 * down. A rule that was merely wished for would have failed on day one and been
 * turned off by lunchtime.
 *
 * The rules are what already failed, or nearly did, in this repository:
 *
 *   - `check:university` compiles the gateway under NodeNext, where a `.ts`
 *     file is CommonJS unless a `package.json` above it says otherwise, and
 *     nothing under `supabase/functions/` does. #803 had `packages/institution`
 *     re-export a module from `supabase/functions/_shared/`, every local gate
 *     passed, and CI failed with TS1287. *The gateway and the packages stay out
 *     of the functions* is that, as a rule instead of a story.
 *   - The app is one bundle. A screen that imports `node:fs` does not fail the
 *     build: vite externalises the module with a warning and the page breaks
 *     when the line runs. Five files under `app/src` do import `node:` modules
 *     (the audits and the counts), and they are safe only because nothing the
 *     browser loads reaches them. That is a fact about the import graph, and
 *     nothing was holding it.
 *   - A package other code depends on that quietly imports the app is not a
 *     package.
 *
 * ## Tests are a different thing
 *
 * A test may import across zones — `app/src` tests exercise `supabase/functions`
 * modules, and server tests use the client's mock adapters — and sixty-odd of
 * them do. What a test imports is never shipped. The rules that apply to tests
 * are the ones about *leaves*: `packages/` and `supabase/functions/` are
 * imported by everything, so they import nothing back, tests included.
 */

export interface Violation {
  rule: string;
  file: string;
  /** What the file named, or what is stale. */
  spec: string;
  /** What to do about it. */
  fix: string;
}

/** The one place the browser's import graph begins. */
export const BROWSER_ENTRY = 'app/src/main.tsx';

/**
 * Non-test files under `app/server` that import files under `app/src`, as
 * `<server file> => <src file>`.
 *
 * This is an inversion — the gateway's integration worker is built from the
 * client's `lib/integration`, which is where that code was written first — and
 * it is recorded rather than refused because it is real and working. It is a
 * **ratchet**: a pair not on this list fails, and so does a pair that is on it
 * and no longer exists, so the list can only get shorter. The rebuild moves
 * the integration domain into its own package (`docs/target-architecture/
 * 09-CONVERSION-PLAN.md`, wave C4); the day the last pair goes, delete the list
 * and make the rule absolute.
 */
export const SERVER_USES_CLIENT_LIB: readonly string[] = [
  'app/server/integration/fakedb.ts => app/src/lib/integration/freshness.ts',
  'app/server/integration/registry-preflight.ts => app/src/lib/integration/adapter.ts',
  'app/server/integration/tick.ts => app/src/lib/integration/adapter.ts',
  'app/server/integration/tick.ts => app/src/lib/integration/catalog.ts',
  'app/server/integration/tick.ts => app/src/lib/integration/freshness.ts',
  'app/server/integration/tick.ts => app/src/lib/integration/pipeline.ts',
  'app/server/integration/tick.ts => app/src/lib/integration/retry.ts',
  'app/server/integration/worker.ts => app/src/lib/integration/adapter.ts',
  'app/server/integration/worker.ts => app/src/lib/integration/catalog.ts',
  'app/server/integration/worker.ts => app/src/lib/integration/classification.ts',
  'app/server/integration/worker.ts => app/src/lib/integration/freshness.ts',
  'app/server/integration/worker.ts => app/src/lib/integration/governance-envelope.ts',
  'app/server/integration/worker.ts => app/src/lib/integration/pipeline.ts',
  'app/server/integration/worker.ts => app/src/lib/integration/redact.ts',
  'app/server/integration/worker.ts => app/src/lib/integration/retry.ts',
];

/**
 * The third-party packages the gateway (`app/server`, `app/api`) may import in
 * code that ships. Adding one is a dependency decision, so it is a diff here, in
 * front of a reviewer, and `docs/SUPPLY-CHAIN.md` is where it is priced.
 */
export const GATEWAY_EXTERNALS: readonly string[] = ['@supabase/supabase-js', 'openai'];

/** A non-test gateway file that is allowed one more package, and why. */
export const GATEWAY_EXTERNAL_EXCEPTIONS: Readonly<Record<string, { spec: string; why: string }>> = {
  'app/server/productivity/repository-contract.ts': {
    spec: 'vitest',
    why: 'a contract suite that every repository implementation runs; it is test code that is not named like a test',
  },
};

const named = (spec: string, allowed: readonly string[]) => allowed.some((a) => spec === a || spec.startsWith(`${a}/`));

export interface Options {
  /** Overridden by the tests, to show a stale or a missing entry is caught. */
  ledger?: readonly string[];
}

export function checkBoundaries(tree: Tree, options: Options = {}): Violation[] {
  const out: Violation[] = [];
  const ledger = options.ledger ?? SERVER_USES_CLIENT_LIB;
  const seenPairs = new Set<string>();

  for (const [file, specs] of tree.imports) {
    const zone = zoneOf(file);
    const test = isTestFile(file);
    const packageScript = /^packages\/[^/]+\/scripts\//.test(file);
    for (const spec of specs) {
      const r = resolveImport(file, spec, tree.files);
      const target = r.kind === 'file' ? zoneOf(r.path) : null;

      if (zone === 'packages') {
        if (target !== null && target !== 'packages') {
          out.push({ rule: 'packages-are-a-leaf', file, spec, fix: `packages/ is imported by the app, the gateway and the tests, so it imports none of them. Move what ${spec} provides into packages/, or take the import out.` });
        } else if (r.kind === 'external' && !(test && spec === 'vitest')) {
          out.push({ rule: 'packages-are-a-leaf', file, spec, fix: 'A package declares no third-party dependency: its manifest has none, and `check:university` compiles it with none. Only a test may import vitest.' });
        } else if (r.kind === 'builtin' && !test && !packageScript) {
          out.push({ rule: 'packages-are-a-leaf', file, spec, fix: 'A package that imports a Node built-in cannot be bundled into the browser. Take it out of the package, or into a test.' });
        } else if (r.kind === 'unresolved') {
          out.push({ rule: 'packages-are-a-leaf', file, spec, fix: 'This import resolves to no file, so nothing can say where it lands.' });
        }
      }

      if (zone === 'functions') {
        if (target !== null && target !== 'functions') {
          out.push({ rule: 'functions-are-self-contained', file, spec, fix: 'Edge functions run on Deno and import only each other (`_shared/`), `jsr:` and `npm:`. Share code the other way: the app imports the function module, as its tests do.' });
        } else if (r.kind === 'external' && !/^(jsr|npm):/.test(spec)) {
          out.push({ rule: 'functions-are-self-contained', file, spec, fix: 'A bare specifier means nothing to Deno without an import map. Write `jsr:` or `npm:` with the version pinned.' });
        } else if (r.kind === 'unresolved') {
          out.push({ rule: 'functions-are-self-contained', file, spec, fix: 'This import resolves to no file under supabase/functions/.' });
        }
      }

      if ((zone === 'app-server' || zone === 'app-api') && target === 'functions') {
        out.push({ rule: 'gateway-stays-out-of-the-functions', file, spec, fix: 'This is #803. Code under supabase/functions/ is not a NodeNext module, so `check:university` cannot compile anything that imports it. Move the shared piece into packages/.' });
      }

      if (zone === 'app-api' && target !== null && target !== 'app-api' && target !== 'app-server' && target !== 'packages') {
        out.push({ rule: 'api-reaches-only-the-server', file, spec, fix: 'The Vercel entry point is a thin adapter over app/server. Put the logic there.' });
      }

      if ((zone === 'app-server' || zone === 'app-api') && !test && r.kind === 'external') {
        const exception = GATEWAY_EXTERNAL_EXCEPTIONS[file];
        if (!named(spec, GATEWAY_EXTERNALS) && !(exception && exception.spec === spec)) {
          out.push({ rule: 'gateway-dependencies-are-named', file, spec, fix: `The gateway ships with ${GATEWAY_EXTERNALS.join(' and ')}. A new package is a decision: add it to GATEWAY_EXTERNALS in lib/importboundaries.ts, in this diff, with the reason.` });
        }
      }

      if (zone === 'app-server' && !test && target === 'app-src') {
        seenPairs.add(`${file} => ${(r as { path: string }).path}`);
      }
    }
  }

  for (const pair of [...seenPairs].sort()) {
    if (!ledger.includes(pair)) {
      out.push({ rule: 'server-uses-client-lib-only-as-recorded', file: pair.split(' => ')[0], spec: pair.split(' => ')[1], fix: 'The gateway importing client source is a recorded inversion that may shrink, not grow. Put what it needs in packages/, where both sides may import it.' });
    }
  }
  for (const pair of ledger) {
    if (!seenPairs.has(pair)) {
      out.push({ rule: 'server-uses-client-lib-only-as-recorded', file: pair.split(' => ')[0], spec: `stale: ${pair.split(' => ')[1]}`, fix: 'This pair is on the ledger and no longer exists. Delete the line from SERVER_USES_CLIENT_LIB — that is the ratchet working.' });
    }
  }

  // What a browser loads. Followed from the one entry, through every dynamic
  // import, because the lazy screens are most of the app.
  if (tree.files.has(BROWSER_ENTRY)) {
    const { files, via } = reachableFrom(tree, BROWSER_ENTRY);
    const chain = (file: string) => {
      const path = [file];
      for (let at = via.get(file); at !== undefined; at = via.get(at)) path.unshift(at);
      return path.length > 4 ? `${path[0]} → … → ${path.slice(-2).join(' → ')}` : path.join(' → ');
    };
    for (const file of [...files].sort()) {
      const zone = zoneOf(file);
      if (zone !== 'app-src' && zone !== 'packages') {
        out.push({ rule: 'browser-graph-is-clean', file, spec: chain(file), fix: 'The browser loads this file, and it is not browser code. Break the import at the first link in the chain.' });
      } else if (isTestFile(file)) {
        out.push({ rule: 'browser-graph-is-clean', file, spec: chain(file), fix: 'A test file is reachable from the entry point and would ship.' });
      }
      for (const spec of tree.imports.get(file) ?? []) {
        const r = resolveImport(file, spec, tree.files);
        if (r.kind === 'builtin') {
          out.push({ rule: 'browser-graph-is-clean', file, spec, fix: `${chain(file)} imports ${spec}. Vite externalises a Node built-in for the browser with a warning, and the page breaks when the line runs. Take the import out of this chain.` });
        } else if (r.kind === 'unresolved') {
          out.push({ rule: 'browser-graph-is-clean', file, spec, fix: 'This import resolves to no file, so the browser graph under it cannot be read.' });
        }
      }
    }
  }

  return out;
}
