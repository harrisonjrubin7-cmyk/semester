import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIONS, APPROVED, BY_NAME, FORBIDDEN, LOCKFILES, NAMED, PATCH_POLICY, REGISTRY, WORKFLOW, actionOf, judge, namedFor, type Lockfile } from './supplychain';

/**
 * Holds every lockfile to the licence policy in `supplychain.ts`, every
 * workflow to the approved Actions, and the deploy to producing an SBOM.
 *
 * `docs/SUPPLY-CHAIN.md` is rendered from the data and the lockfiles; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/SUPPLY-CHAIN.md';

interface Entry {
  name: string;
  license: string | undefined;
  resolved?: string;
  integrity?: string;
  link?: boolean;
  dev?: boolean;
}

const entries = (lockfile: Lockfile): Entry[] => {
  const lock = JSON.parse(read(LOCKFILES[lockfile].path)) as { packages: Record<string, Omit<Entry, 'name'> & { license?: unknown }> };
  return Object.entries(lock.packages)
    // The root entry, the workspace members (`app`, `packages/*`) and the links
    // that point at them are this repository's own code, not third-party
    // packages; only a non-link `node_modules/…` entry is.
    .filter(([key, v]) => key.startsWith('node_modules/') && !v.link)
    .map(([key, v]) => ({
      ...v,
      name: key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length),
      license: typeof v.license === 'string' ? v.license : undefined,
    }));
};

const lockfiles = Object.keys(LOCKFILES) as Lockfile[];

const workflows = () =>
  readdirSync(join(root, '.github/workflows'))
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => ({ file: f, text: read(`.github/workflows/${f}`) }));

/** The `uses:` values of real steps, not ones quoted in a comment. */
const usesIn = (text: string) =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .map((line) => /^\s*(?:-\s+)?uses:\s*([^\s#]+)/.exec(line)?.[1])
    .filter((u): u is string => Boolean(u) && !u!.startsWith('./'));

describe('the licence policy', () => {
  it('can tell a forbidden, an unnamed and an approved licence apart', () => {
    expect(judge('app', 'left-pad', 'MIT')).toEqual({ ok: true, via: 'approved' });
    expect(judge('app', 'dompurify', '(MPL-2.0 OR Apache-2.0)')).toEqual({ ok: true, via: 'approved' });
    expect(judge('app', 'some-gpl-lib', 'GPL-3.0-only').ok).toBe(false);
    expect(judge('app', 'some-agpl-lib', 'AGPL-3.0').ok).toBe(false);
    expect(judge('app', 'some-mpl-lib', 'MPL-2.0').ok).toBe(false);
    expect(judge('app', 'mystery', undefined).ok).toBe(false);
    // Named covers a family by prefix, and only in its own lockfile.
    expect(judge('app', 'lightningcss-linux-x64-gnu', 'MPL-2.0')).toEqual({ ok: true, via: 'named' });
    expect(judge('video', 'lightningcss', 'MPL-2.0').ok).toBe(false);
    expect(namedFor('app', 'elkjs-extra')?.pkg).toBe('elkjs');
    expect(namedFor('app', 'elk')).toBeUndefined();
  });

  it('refuses an open decision in anything that ships, and allows it where nothing ships', () => {
    expect(judge('video', '@remotion/renderer', 'SEE LICENSE IN LICENSE.md')).toEqual({ ok: true, via: 'named' });
    // The same package in the app would reach every student under a licence nobody has bought.
    const shipped = { ...LOCKFILES.app };
    expect(shipped.ships).toBe(true);
    expect(NAMED.filter((n) => n.lockfile === 'app' && n.decision === 'open')).toEqual([]);
  });

  it('names nothing forbidden, and no approved licence twice', () => {
    for (const n of NAMED) expect(FORBIDDEN.test(n.license), n.pkg).toBe(false);
    for (const l of BY_NAME) expect(APPROVED as readonly string[]).not.toContain(l);
    for (const l of APPROVED) expect(FORBIDDEN.test(l), l).toBe(false);
  });

  for (const lockfile of lockfiles) {
    it(`admits every package in ${LOCKFILES[lockfile].path}`, () => {
      const refused = entries(lockfile)
        .map((e) => judge(lockfile, e.name, e.license))
        .filter((v): v is { ok: false; reason: string } => !v.ok)
        .map((v) => v.reason);
      expect(refused).toEqual([]);
    });

    it(`names nothing in ${lockfile} that is not there any more`, () => {
      const names = entries(lockfile).map((e) => e.name);
      for (const n of NAMED.filter((x) => x.lockfile === lockfile)) {
        expect(names.some((name) => namedFor(lockfile, name) === n), `${n.pkg} is named for ${lockfile} and not in it`).toBe(true);
      }
    });

    it(`resolves every package in ${lockfile} from the registry, with an integrity hash`, () => {
      for (const e of entries(lockfile)) {
        if (e.link) continue;
        expect(e.integrity, `${e.name} has no integrity hash`).toMatch(/^sha512-/);
        if (e.resolved) expect(e.resolved.startsWith(REGISTRY), `${e.name} comes from ${e.resolved}`).toBe(true);
      }
    });
  }
});

describe('the workflows', () => {
  it('reads a uses line and ignores a commented one', () => {
    expect(usesIn('      - uses: actions/checkout@v7\n      # uses: evil/thing@v1\n        uses: a/b/sub@v2')).toEqual(['actions/checkout@v7', 'a/b/sub@v2']);
    expect(actionOf('github/codeql-action/init@v3')).toBe('github/codeql-action');
  });

  it('runs only approved Actions', () => {
    const found = workflows().flatMap((w) => usesIn(w.text).map((u) => ({ file: w.file, action: actionOf(u) })));
    expect(found.length).toBeGreaterThan(10);
    for (const { file, action } of found) expect(ACTIONS[action], `${file} runs ${action}, which is not in supplychain.ts ACTIONS`).toBeDefined();
  });

  it('approves no Action that nothing runs', () => {
    const used = new Set(workflows().flatMap((w) => usesIn(w.text).map(actionOf)));
    for (const action of Object.keys(ACTIONS)) expect(used.has(action), `${action} is approved and unused`).toBe(true);
  });

  it('pins every Action to a full commit SHA, not a tag a publisher can move', () => {
    for (const w of workflows()) for (const u of usesIn(w.text)) expect(u, w.file).toMatch(/@[0-9a-f]{40}$/);
  });

  it('says which release each pinned SHA is, so a reviewer can read the pin', () => {
    for (const w of workflows())
      for (const line of w.text.split('\n').filter((l) => /^\s*(?:-\s+)?uses:\s*[^\s#]+@[0-9a-f]{40}/.test(l)))
        expect(line, `${w.file}: ${line.trim()}`).toMatch(/@[0-9a-f]{40}\s+#\s*v\d/);
  });

  it('reads a pin, a tag and a short SHA apart', () => {
    const pin = /@[0-9a-f]{40}$/;
    expect('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1').toMatch(pin);
    expect('actions/checkout@v7').not.toMatch(pin);
    expect('actions/checkout@3d3c42e').not.toMatch(pin);
  });

  it('gives every workflow a least-privilege token by default', () => {
    // A write scope at the top applies to every job; only the Pages deploy needs one.
    const allowed: Record<string, string[]> = { 'pages.yml': ['pages', 'id-token'] };
    for (const w of workflows()) {
      const top = /^permissions:\n((?:[ \t]+.*\n)+)/m.exec(w.text);
      expect(top, `${w.file} declares no top-level permissions`).not.toBeNull();
      const writes = [...top![1].matchAll(/^\s+([\w-]+):\s*write/gm)].map((m) => m[1]);
      expect(writes, w.file).toEqual(allowed[w.file] ?? []);
      expect(top![1], w.file).toMatch(/contents:\s*read/);
    }
  });

  it('keeps Actions updated by Dependabot alongside npm', () => {
    const dependabot = read('.github/dependabot.yml');
    expect(dependabot).toMatch(/package-ecosystem: github-actions/);
    expect(dependabot).toMatch(/package-ecosystem: npm/);
  });

  it('writes an SBOM of what the deploy ships, and keeps it with the run', () => {
    const pages = read('.github/workflows/pages.yml');
    const pkg = JSON.parse(read('app/package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts.sbom).toMatch(/npm sbom --sbom-format cyclonedx --omit dev/);
    const sbom = pages.search(/npm run (--silent )?sbom/);
    const build = pages.indexOf('run: npm run build');
    const deploy = pages.indexOf('actions/deploy-pages');
    expect(sbom, 'pages.yml does not run npm run sbom').toBeGreaterThan(-1);
    expect(sbom).toBeGreaterThan(build);
    expect(sbom).toBeLessThan(deploy);
    expect(pages.slice(sbom, deploy)).toMatch(/actions\/upload-artifact@\S+[\s\S]*retention-days: 90/);
  });
});

describe('the response policy', () => {
  it('answers faster the worse the finding is', () => {
    expect(PATCH_POLICY.map((p) => p.severity)).toEqual(['critical', 'high', 'medium', 'low']);
    const days = PATCH_POLICY.map((p) => p.days);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });

  it('cites, for every workflow step it says is held, a file that exists', () => {
    for (const { step, heldBy } of WORKFLOW) {
      if (!heldBy) continue;
      const files = heldBy.match(/[\w./-]+\.(?:ya?ml|md|ts|json)\b/g) ?? [];
      expect(files.length, step).toBeGreaterThan(0);
      for (const f of files) {
        const candidates = [f, `app/src/lib/${f}`, `app/${f}`, `.github/workflows/${f}`, `.github/${f}`, `docs/${f}`];
        expect(candidates.some((c) => existsSync(join(root, c))), `${step} cites ${f}`).toBe(true);
      }
    }
    expect(read('.github/pull_request_template.md')).toMatch(/## New dependency/);
  });
});

it('is what docs/SUPPLY-CHAIN.md says', () => {
  const rendered = render();
  if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
  expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function render(): string {
  const out: string[] = [
    '# Software supply chain',
    '',
    '<!-- Rendered from app/src/lib/supplychain.ts and the lockfiles by supplychain.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'What a dependency or a build step is allowed to be, held by a test rather',
    'than by review. Every row below is checked on every change; a new package',
    'under an unlisted licence, a lockfile entry from outside the registry, or a',
    'workflow step from an unapproved publisher fails CI.',
    '',
    '| Control | Held by |',
    '| --- | --- |',
    '| Lockfile installed exactly (`npm ci`) | `ci.yml`, `pages.yml` |',
    '| Known advisories reported on every run — non-blocking by design, so an advisory published overnight does not turn an unrelated PR red; see the comment on the step | `ci.yml` — `npm audit --audit-level=high` |',
    '| Every workflow\'s job token is read-only unless a job asks for more | `app/src/lib/supplychain.test.ts` |',
    '| Fix PRs for advisories and updates, npm and Actions | `.github/dependabot.yml` |',
    '| Secrets never committed | `ci.yml` — gitleaks, `.gitleaks.toml` |',
    '| Every package under an approved or named licence | `app/src/lib/supplychain.test.ts` |',
    '| Every package from `registry.npmjs.org` with a sha512 integrity hash | `app/src/lib/supplychain.test.ts` |',
    '| Only approved third-party Actions run | `app/src/lib/supplychain.test.ts` |',
    '| Every Action pinned to a full commit SHA, with its release in a comment | `app/src/lib/supplychain.test.ts` |',
    '| An SBOM (CycloneDX) of every deploy, kept 90 days | `pages.yml` → `npm run sbom`; asserted by `supplychain.test.ts` |',
    '',
    'What is **not** held yet — signed build provenance, a',
    'supplier-compromise playbook — is tracked with the rest of the',
    'strategic expansion in [`STRATEGIC-EXPANSION-REGISTER.md`](STRATEGIC-EXPANSION-REGISTER.md).',
    '',
    '## Licence inventory',
    '',
  ];

  const header = ['Licence', ...lockfiles.map((l) => `\`${l}/\``)];
  const counts = new Map<string, Record<Lockfile, number>>();
  for (const l of lockfiles) {
    for (const e of entries(l)) {
      const named = namedFor(l, e.name);
      const license = e.license ?? (named ? `${named.license} (stated in package)` : 'unstated');
      const row = counts.get(license) ?? ({ app: 0, video: 0, pipeline: 0 } as Record<Lockfile, number>);
      row[l]++;
      counts.set(license, row);
    }
  }
  out.push(`| ${header.join(' | ')} |`, `| --- | ${lockfiles.map(() => '---:').join(' | ')} |`);
  const total = (r: Record<Lockfile, number>) => lockfiles.reduce((n, l) => n + r[l], 0);
  for (const [license, row] of [...counts].sort((a, b) => total(b[1]) - total(a[1]) || a[0].localeCompare(b[0])))
    out.push(`| ${cell(license)} | ${lockfiles.map((l) => row[l] || '').join(' | ')} |`);
  out.push(`| **total** | ${lockfiles.map((l) => `**${entries(l).length}**`).join(' | ')} |`, '');
  out.push(
    ...lockfiles.map((l) => `- \`${l}/\` — ${LOCKFILES[l].what}${LOCKFILES[l].ships ? ' **(ships)**' : ''}.`),
    '',
    `Approved without review: ${APPROVED.map((l) => `\`${l}\``).join(', ')}.`,
    '',
    `Allowed only by name: ${BY_NAME.map((l) => `\`${l}\``).join(', ')} — and anything the lockfile does not state.`,
    '',
    'Never allowed, even by name: GPL, AGPL, LGPL, SSPL, BUSL, Commons Clause, Elastic 2.0, and non-commercial or share-alike Creative Commons.',
    '',
    '## Named packages',
    '',
    '| Package | Lockfile | Licence | Decision | Why |',
    '| --- | --- | --- | --- | --- |',
    ...NAMED.map((n) => `| \`${n.pkg}\` | ${n.lockfile} | ${cell(n.license)} | ${n.decision === 'open' ? '**open**' : 'accepted'} | ${cell(n.why)} |`),
    '',
    '**The open decision.** The Remotion licence under `video/` is free for an',
    'individual or a small company and requires a paid company licence above its',
    'headcount threshold. Nothing under `video/` is deployed, and the test refuses',
    'an open decision in anything that is. It must be bought, or the tool',
    'replaced, before Semester is a company above that threshold.',
    '',
    '## A dependency, from request to response',
    '',
    '| Step | Held by |',
    '| --- | --- |',
    ...WORKFLOW.map((w) => `| ${cell(w.step)} | ${w.heldBy ? cell(w.heldBy) : '**nothing yet**'} |`),
    '',
    '## Severity and patch targets',
    '',
    'Accepted internal targets: the founder, acting in the security seat, accepted',
    'them unchanged on 29 September 2026 (D-124). Not a customer commitment until a',
    'contract or [`trust/SLA.md`](trust/SLA.md) says so.',
    'This is the severity model `market-readiness/HECVAT_READINESS.md` VULN-1 asks for.',
    'The same four rows stand in `SECURITY.md` beside the published contact',
    '(`app/public/.well-known/security.txt`), and `security.test.ts` holds the two',
    'tables to each other.',
    '',
    '| Severity | Example | Response | Fixed within | Escalate to |',
    '| --- | --- | --- | ---: | --- |',
    ...PATCH_POLICY.map((p) => `| ${p.severity} | ${cell(p.example)} | ${cell(p.respond)} | ${p.days} days | ${cell(p.escalate)} |`),
    '',
    '## Approved GitHub Actions',
    '',
    '| Action | Publisher | Why |',
    '| --- | --- | --- |',
    ...Object.entries(ACTIONS).map(([a, v]) => `| \`${a}\` | ${v.publisher} | ${cell(v.why)} |`),
    '',
  );
  return out.join('\n');
}
