/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEATS } from '../launchreadiness';
import { LAST_IN_LOG } from '../ops/decisionlog';

/**
 * The contributor pages, held to the repository they describe.
 *
 * `CONTRIBUTING.md` and everything in `docs/developers/` quote commands,
 * paths, script names, environment variables and test names. A page that
 * quotes `npm run registers` is a claim that the script exists, and it goes
 * on being a claim after somebody renames it. This test reads the pages and
 * the tree and fails on the divergence.
 *
 * What it holds, in order:
 *
 *   1. the card on every page, and the rules for what a page of each type
 *      may claim about its own truth;
 *   2. every relative link, every `npm run` script, every `npx vitest run`
 *      path, every repository path and every environment variable name;
 *   3. the repository map: every directory it names exists, and every
 *      top-level directory and every directory of `app/src` is named;
 *   4. the standards page: every holder it cites exists, convention rows cite
 *      none, and proposals stay in their own last section;
 *   5. the facts each how-to relies on, read from the code that holds them.
 *
 * Each check has a control: a fixture the check must convict. A scan that
 * finds nothing is also what a scan looking in the wrong place finds.
 *
 * What it does not hold: the measured durations and counts in the onboarding
 * table, and the "what failed" tables at the end of the how-tos. They are
 * dated readings, and the pages say so.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const SELF = 'app/src/lib/docs/developers.test.ts';

// ── what the card may say ──────────────────────────────────────────────────

const TYPES = ['tutorial', 'how-to', 'reference', 'explanation', 'runbook', 'help', 'release'];
const AUDIENCES = [
  'students', 'families', 'faculty', 'institution-admins', 'implementers', 'partner-developers',
  'contributors', 'operators', 'support', 'buyers', 'security-reviewers',
];
const STATUS_WORDS = ['LIVE', 'IMPLEMENTED_NOT_RELEASED', 'PARTIAL', 'MOCK_DEMO', 'PLANNED', 'BLOCKED'];
const CARD =
  /^> \*\*Type:\*\* (\S+) · \*\*Audience:\*\* ([a-z, -]+) · \*\*Owner:\*\* `([a-z]+)` · \*\*Truth:\*\* (generated|held|reviewed) · \*\*Reviewed:\*\* (\d{4}-\d{2}-\d{2}) · \*\*Held by:\*\* (`[^`]+`|—)$/;

/**
 * Paths a page may name that another author is adding. The lead's charter is
 * written outside this slice; `examples/` is being added beside it. Neither is
 * required to exist here, and both are checked like any other once they do.
 */
const NOT_YET_HERE = ['docs/documentation/README.md', 'docs/README.md'];
const DIRECTORIES_NOT_YET_HERE = ['examples'];

// ── the pages ──────────────────────────────────────────────────────────────

const PAGES = [
  'CONTRIBUTING.md',
  ...readdirSync(at('docs/developers'))
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => `docs/developers/${f}`),
];
const HOWTOS = PAGES.filter((p) => /docs\/developers\/HOW-TO-/.test(p));

// ── reading a page ─────────────────────────────────────────────────────────

const FENCE = /^[ ]*```(\w*)\n([\s\S]*?)^[ ]*```[ ]*$/gm;

function fences(text: string): { lang: string; body: string }[] {
  return [...text.matchAll(FENCE)].map((m) => ({ lang: m[1], body: m[2] }));
}
const prose = (text: string) => text.replace(FENCE, '');
const spans = (text: string) => [...prose(text).matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
const links = (text: string) => [...prose(text).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]);

function section(text: string, heading: string): string {
  const start = text.indexOf(`\n${heading}\n`);
  if (start < 0) return '';
  const rest = text.slice(start + heading.length + 2);
  const end = rest.search(/\n## /);
  return end < 0 ? rest : rest.slice(0, end);
}

/** Table rows as trimmed cells, header and rule rows dropped. */
function rows(text: string): string[][] {
  return text
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|[\s|:-]+\|$/.test(l))
    .map((l) => l.slice(1, -1).split('|').map((c) => c.trim()))
    .slice(1);
}

// ── the repository ─────────────────────────────────────────────────────────

const scripts: Record<string, string> = JSON.parse(read('app/package.json')).scripts;
const rootEntries = new Set(readdirSync(root));
const appEntries = new Set(readdirSync(at('app')));

/** Every file's basename, for pages that name a file without its directory. */
let basenames: Set<string> | null = null;
function allBasenames(): Set<string> {
  if (basenames) return basenames;
  const out = new Set<string>();
  const skip = new Set(['node_modules', 'dist', '.git', 'audio', 'video', 'worktrees', 'project']);
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else out.add(name);
    }
  };
  walk(root);
  return (basenames = out);
}

const BARE_EXTENSION = /\.(ts|tsx|mjs|js|json|sql|yml|yaml|toml|md|sh|snapshot|css|html|py)$/;

/** Why a backticked span that looks like a repository path does not resolve, or null. */
function pathProblem(span: string, pageDir: string): string | null {
  if (/[<>*{}$|\s,;()=:]/.test(span) || /^\.\w+$/.test(span) || (span.includes('...') && !span.includes('['))) return null;
  if (span.includes('/')) {
    const first = span.split('/')[0];
    if (!rootEntries.has(first) && !appEntries.has(first)) return null;
    if (NOT_YET_HERE.includes(span) || DIRECTORIES_NOT_YET_HERE.includes(span.replace(/\/$/, ''))) return null;
    const found = [at(span), at(`app/${span}`), join(root, pageDir, span)].some((p) => existsSync(p));
    return found ? null : `${span} does not exist`;
  }
  if (/^[A-Z][A-Z0-9_-]+\.md$/.test(span)) {
    const found = [at(span), at(`docs/${span}`), at(`${pageDir}/${span}`)].some((p) => existsSync(p));
    return found ? null : `${span} does not exist`;
  }
  if (BARE_EXTENSION.test(span) && !span.startsWith('.env')) {
    return allBasenames().has(span) ? null : `no file named ${span} exists`;
  }
  return null;
}

const ENV_SOURCES = [
  'app/server/institution/.env.example',
  'app/.env.example',
  'app/server/institution/start.ts',
  'app/src/lib/university.ts',
  'supabase/check.sh',
  'app/scripts/cold-smoke.mjs',
  'app/scripts/golden-path.mjs',
  'app/scripts/gateway-smoke.mjs',
  '.github/workflows/ci.yml',
];
const envText = () => ENV_SOURCES.map(read).join('\n');

/** Environment variable names in a span that no source of them mentions. */
function envProblems(span: string, haystack: string): string[] {
  return [...span.matchAll(/\b((?:SEMESTER|VITE|SMOKE)_[A-Z_]*[A-Z])\b/g)]
    .map((m) => m[1])
    .filter((name) => !haystack.includes(name))
    .map((name) => `${name} is named by no source`);
}

/** Why a command line quoted in a page would not run as written, or nothing. */
function commandProblems(line: string): string[] {
  const tokens = (line.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).filter((t, i, all) => !(/^[A-Z_]+=/.test(t) && all.slice(0, i).every((u) => /^[A-Z_]+=/.test(u))));
  const [tool, sub] = tokens;
  const out: string[] = [];
  if (tool === 'npm') {
    if (sub === 'run') {
      if (!(tokens[2] in scripts)) out.push(`npm run ${tokens[2]}: no such script in app/package.json`);
    } else if (sub === 'test') {
      if (!('test' in scripts)) out.push('npm test: no such script');
    } else if (!['ci', 'install'].includes(sub)) {
      out.push(`npm ${sub}: not a command these pages use`);
    }
  } else if (tool === 'npx') {
    if (!['tsc', 'vitest'].includes(sub)) out.push(`npx ${sub}: not a tool these pages use`);
    if (sub === 'vitest') {
      const args = tokens.slice(2);
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-t') { i++; continue; }
        if (args[i].startsWith('-') || args[i] === 'run') continue;
        if (/[/]|\.(tsx?|mjs)$/.test(args[i]) && !existsSync(at(`app/${args[i]}`))) {
          out.push(`vitest path ${args[i]} does not exist under app/`);
        }
      }
    }
  } else if (tool === 'node' && sub && !sub.startsWith('-')) {
    if (!existsSync(at(sub))) out.push(`node ${sub}: no such file`);
  } else if (tool && /^supabase\/.+\.sh$/.test(tool)) {
    if (!existsSync(at(tool))) out.push(`${tool}: no such file`);
  }
  return out;
}

/** The command lines in a page: bash fences, and spans that begin like a command. */
function commandsIn(text: string): string[] {
  const fenced = fences(text)
    .filter((f) => f.lang === 'bash' || f.lang === 'sh')
    .flatMap((f) => f.body.split('\n'))
    .map((l) => l.trim().replace(/^\$ /, ''))
    .filter((l) => l && !l.startsWith('#'));
  const inline = spans(text).filter((s) => /^(npm|npx|node|REGISTERS=|SEMESTER_\w+=1 supabase|supabase\/\S+\.sh)\b/.test(s) || /^supabase\/\S+\.sh/.test(s));
  return [...fenced, ...inline];
}

function linkProblems(text: string, pageDir: string): string[] {
  return links(text)
    .filter((l) => !/^(https?:|mailto:|#)/.test(l))
    .map((l) => l.split('#')[0])
    .filter((l) => l && !existsSync(join(root, pageDir, l)))
    .map((l) => `${l} does not resolve from ${pageDir}`);
}

function cardProblems(text: string, heldByExists: (p: string) => boolean): string[] {
  const lines = text.split('\n');
  const out: string[] = [];
  if (!/^# \S/.test(lines[0])) out.push('line 1 is not a # title');
  if (lines[1] !== '') out.push('line 2 is not blank');
  const m = CARD.exec(lines[2] ?? '');
  if (!m) return [...out, 'line 3 is not a card line in the charter form'];
  const [, type, audience, owner, truth, , heldBy] = m;
  if (!TYPES.includes(type)) out.push(`unknown type ${type}`);
  for (const a of audience.split(',').map((s) => s.trim())) if (!AUDIENCES.includes(a)) out.push(`unknown audience ${a}`);
  if (!(SEATS as readonly string[]).includes(owner)) out.push(`owner ${owner} is not a council seat`);
  if (type === 'reference' && truth === 'reviewed') out.push('a reference page must be generated or held');
  if ((type === 'how-to' || type === 'tutorial') && truth !== 'held') out.push(`a ${type} that quotes commands must be held`);
  if (truth === 'reviewed' ? heldBy !== '—' : !heldByExists(heldBy.replace(/`/g, ''))) {
    out.push(`held by ${heldBy} does not match the truth ${truth}`);
  }
  if (lines[3] !== '') out.push('line 4 is not blank');
  if (!/stop reading/.test(lines[4] ?? '') || /^[#>|]/.test(lines[4] ?? '')) {
    out.push('line 5 is not the one sentence saying what the page is for and who should stop reading');
  }
  return out;
}

// ── 1 · the card ───────────────────────────────────────────────────────────

describe('the card on every page', () => {
  it('finds the pages, so a scan of none cannot read as clean', () => {
    expect(PAGES.length).toBeGreaterThanOrEqual(14);
    for (const must of ['CONTRIBUTING.md', 'docs/developers/README.md', 'docs/developers/ONBOARDING.md', 'docs/developers/REPO-MAP.md', 'docs/developers/CODING-STANDARDS.md', 'docs/developers/TESTING-GUIDE.md']) {
      expect(PAGES, must).toContain(must);
    }
    expect(HOWTOS.length).toBeGreaterThanOrEqual(9);
  });

  for (const page of PAGES) {
    it(`${page} has the card, and is held by this test`, () => {
      const text = read(page);
      expect(cardProblems(text, (p) => existsSync(at(p))), page).toEqual([]);
      expect(CARD.exec(text.split('\n')[2])?.[6], page).toBe(`\`${SELF}\``);
    });

    it(`${page} labels every code block and uses a status word the truth table knows`, () => {
      const text = read(page);
      expect(fences(text).filter((f) => !f.lang).length, `${page} has an unlabelled code block`).toBe(0);
      expect((text.match(/```/g) ?? []).length % 2, `${page} has an unclosed fence`).toBe(0);
      for (const m of text.matchAll(/^\*\*Status:\*\* ([A-Z_]+)/gm)) expect(STATUS_WORDS, page).toContain(m[1]);
    });
  }

  it('convicts a card that breaks the rules (control)', () => {
    const good = [
      '# T', '',
      '> **Type:** reference · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/package.json`',
      '', 'What it is for; stop reading if not you.', '',
    ];
    const ok = (lines: string[]) => cardProblems(lines.join('\n'), (p) => existsSync(at(p)));
    expect(ok(good)).toEqual([]);
    expect(ok([good[0], good[1], good[2].replace('**Truth:** held', '**Truth:** reviewed').replace('· **Held by:** `app/package.json`', '· **Held by:** —'), ...good.slice(3)]).join()).toMatch(/reference page must be generated or held/);
    expect(ok([good[0], good[1], good[2].replace('`engineering`', '`bob`'), ...good.slice(3)]).join()).toMatch(/not a council seat/);
    expect(ok([good[0], good[1], good[2].replace('app/package.json', 'app/nope.test.ts'), ...good.slice(3)]).join()).toMatch(/does not match/);
    expect(ok([...good.slice(0, 4), 'A sentence.']).join()).toMatch(/stop reading/);
    expect(ok(['T', ...good.slice(1)]).join()).toMatch(/not a # title/);
  });
});

// ── 2 · links, commands, paths, variables ──────────────────────────────────

describe('what the pages quote', () => {
  for (const page of PAGES) {
    const text = read(page);
    const dir = dirname(page);

    it(`${page}: every relative link resolves`, () => {
      expect(linkProblems(text, dir), page).toEqual([]);
    });

    it(`${page}: every command it quotes would run`, () => {
      const problems = commandsIn(text).flatMap(commandProblems);
      expect(problems, page).toEqual([]);
    });

    it(`${page}: every repository path and environment variable it names exists`, () => {
      const haystack = envText();
      const problems = spans(text).flatMap((s) => [pathProblem(s, dir), ...envProblems(s, haystack)]).filter(Boolean);
      expect(problems, page).toEqual([]);
    });
  }

  it('finds commands to check, in the pages that are about commands (control)', () => {
    const onboarding = commandsIn(read('docs/developers/ONBOARDING.md'));
    expect(onboarding).toContain('npm ci');
    expect(onboarding).toContain('npm run dev:university');
    expect(onboarding).toContain('npx vitest run src/lib/branchprotection.test.ts');
    expect(commandsIn(read('docs/developers/HOW-TO-CHANGE-A-REGISTER-PAGE.md')).some((c) => c.startsWith('REGISTERS=write npx vitest run'))).toBe(true);
  });

  it('convicts what does not exist (control)', () => {
    expect(commandProblems('npm run no-such-script').join()).toMatch(/no such script/);
    expect(commandProblems('npm run lint:styles -- --fix')).toEqual([]);
    expect(commandProblems('npx vitest run src/lib/does-not-exist.test.ts').join()).toMatch(/does not exist under app/);
    expect(commandProblems('REGISTERS=write npx vitest run src/lib/ops/proofcalendar.test.ts')).toEqual([]);
    expect(commandProblems('npx vitest run -t "a name with /slash" src/lib/flags.test.ts')).toEqual([]);
    expect(commandProblems('npx jest').join()).toMatch(/not a tool/);
    expect(commandProblems('node pipeline/nope.mjs').join()).toMatch(/no such file/);
    expect(commandProblems('node pipeline/validate.mjs')).toEqual([]);
    expect(commandProblems('supabase/nope.sh')).toHaveLength(1);
    expect(commandProblems('supabase/check.sh groups')).toEqual([]);

    expect(pathProblem('app/src/lib/nope.ts', '.')).toMatch(/does not exist/);
    expect(pathProblem('app/src/lib/flags.ts', '.')).toBeNull();
    expect(pathProblem('src/lib/flags.ts', '.')).toBeNull();
    expect(pathProblem('flags.ts', '.')).toBeNull();
    expect(pathProblem('nosuchfile.ts', '.')).toMatch(/no file named/);
    expect(pathProblem('docs/decisions/D-<n>.md', '.')).toBeNull();
    expect(pathProblem('origin/main', '.')).toBeNull();

    expect(envProblems('SEMESTER_JOURNAL_KEY', envText())).toEqual([]);
    expect(envProblems('SEMESTER_NO_SUCH_THING_AT_ALL', envText())).toHaveLength(1);

    const dir = 'docs/developers';
    expect(linkProblems('[x](./nope.md)', dir)).toHaveLength(1);
    expect(linkProblems('[x](README.md) [y](../ARCHITECTURE.md#top) [z](https://example.org)', dir)).toEqual([]);
  });
});

// ── 3 · the repository map ─────────────────────────────────────────────────

/** Names in a list that the table does not name. */
const unnamed = (actual: string[], named: string[]) => actual.filter((d) => !named.includes(d));

function ignoredAtRoot(): string[] {
  return [
    '.git',
    ...read('.gitignore')
      .split('\n')
      .filter((l) => /^[\w.-]+\/$/.test(l))
      .map((l) => l.slice(0, -1)),
  ];
}

const dirsIn = (dir: string, ignore: string[] = []) =>
  readdirSync(dir)
    .filter((n) => !ignore.includes(n) && statSync(join(dir, n)).isDirectory())
    .sort();

describe('the repository map', () => {
  const map = read('docs/developers/REPO-MAP.md');
  const first = (heading: string) =>
    rows(section(map, heading)).map((r) => r[0].replace(/`/g, '').replace(/\/$/, ''));

  it('names every top-level directory, dot-directories included', () => {
    const named = first('## Top-level directories');
    const actual = dirsIn(root, ignoredAtRoot());
    expect(actual.length).toBeGreaterThanOrEqual(15);
    expect(unnamed(actual, named), 'directories the map does not name: add a row').toEqual([]);
  });

  it('names no top-level directory that does not exist', () => {
    const named = first('## Top-level directories');
    const missing = named.filter((d) => !existsSync(at(d)) && !DIRECTORIES_NOT_YET_HERE.includes(d));
    expect(missing).toEqual([]);
  });

  it('names every directory of app/src, and none that is not there', () => {
    const named = first('## Inside `app/src/`').map((p) => p.replace(/^app\/src\//, ''));
    const actual = dirsIn(at('app/src'));
    expect(actual).toContain('screens');
    expect(unnamed(actual, named), 'directories of app/src the map does not name').toEqual([]);
    expect(named.filter((d) => !actual.includes(d))).toEqual([]);
  });

  it('names the app, server, api and supabase paths it describes', () => {
    for (const heading of ['## Inside `app/`', '## Inside `supabase/`', '## The two packages']) {
      const cells = rows(section(map, heading)).map((r) => r[0]);
      expect(cells.length, heading).toBeGreaterThanOrEqual(2);
      for (const cell of cells) {
        for (const s of [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1])) {
          if (/[*]/.test(s)) continue;
          expect(pathProblem(s, 'docs/developers'), `${heading}: ${s}`).toBeNull();
        }
      }
    }
  });

  it('would notice a directory the map forgot (control)', () => {
    expect(unnamed(['app', 'docs', 'newplace'], ['app', 'docs'])).toEqual(['newplace']);
    expect(unnamed(['app', 'docs'], ['app', 'docs'])).toEqual([]);
  });

  it('holds the dependency rules it lists to files that carry them', () => {
    const table = rows(section(map, '## Dependency direction rules that exist today'));
    expect(table.length).toBeGreaterThanOrEqual(8);
    expect(read('app/src/aioptional.test.ts')).toContain('has no screen that statically imports the assistant');
    expect(read('app/src/rootunmount.test.ts')).toContain('createRoot');
    expect(read('app/src/isolation.test.ts')).toContain('vi.mock');
    expect(read('app/src/lib/ci.test.ts')).toContain('check:university');
    expect(read('app/src/donotbuild.test.ts')).toContain('Notification');
    expect(read('app/tsconfig.university.json')).toContain('"NodeNext"');
    expect(read('CLAUDE.md')).toContain('TS1287');
  });
});

// ── 4 · the standards ──────────────────────────────────────────────────────

describe('the standards page', () => {
  const standards = read('docs/developers/CODING-STANDARDS.md');
  const PROPOSED = '## Proposed, not enforced';

  /** Holders in a row: a script, a command, a path that exists, or a CI file. */
  const holders = (row: string[], pageDir = 'docs/developers') =>
    row.flatMap((cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1])).filter(
      (s) =>
        /^(npm|npx|node|supabase\/\S+\.sh|SEMESTER_)/.test(s) ||
        (pathProblem(s, pageDir) === null && (s.includes('/') || BARE_EXTENSION.test(s))),
    );

  it('keeps proposals in one section, last, each marked', () => {
    expect(standards.split('\n').filter((l) => l === PROPOSED)).toHaveLength(1);
    const after = standards.slice(standards.indexOf(PROPOSED));
    expect(after.slice(PROPOSED.length)).not.toMatch(/\n## /);
    const table = rows(after);
    expect(table.length).toBeGreaterThanOrEqual(8);
    for (const r of table) expect(r[1], r[0]).toMatch(/^Proposed, not enforced/);
    const before = standards.slice(0, standards.indexOf(PROPOSED));
    expect(before, 'the proposal pack is linked only from the proposed section').not.toContain('target-architecture/07');
  });

  it('cites a holder that exists for every standard that is enforced', () => {
    const enforced = ['## Enforced by a command that fails', '## Enforced by a test', '## Enforced in the database'];
    for (const heading of enforced) {
      const table = rows(section(standards, heading));
      expect(table.length, heading).toBeGreaterThan(3);
      for (const r of table) {
        const cited = holders(r.slice(1));
        expect(cited.length, `${heading}: "${r[0].slice(0, 60)}" cites no holder`).toBeGreaterThan(0);
      }
    }
  });

  it('cites a reviewer, and no test, for a convention', () => {
    const convention = section(standards, '## Convention');
    expect(convention.length).toBeGreaterThan(100);
    expect(spans(convention).filter((s) => /\.test\.tsx?$|^npm run/.test(s))).toEqual([]);
    const review = rows(section(standards, '## Practised and held by review'));
    expect(review.length).toBeGreaterThan(5);
    for (const r of review) expect(r[2].length, r[0]).toBeGreaterThan(5);
  });

  it('names the scripts and settings it describes as they are', () => {
    expect(scripts.lint).toContain('--max-warnings=25');
    expect(standards).toContain('--max-warnings=25');
    expect(scripts.lint).toMatch(/scripts\/styles\.mjs.*scripts\/labels\.mjs.*scripts\/terms\.mjs/);
    const oxlint = JSON.parse(read('app/.oxlintrc.json')).rules;
    expect(oxlint['react/rules-of-hooks']).toBe('error');
    expect(oxlint['no-duplicate-case']).toBe('error');
    const tsapp = read('app/tsconfig.app.json');
    for (const flag of ['noUnusedLocals', 'noUnusedParameters', 'erasableSyntaxOnly', 'noFallthroughCasesInSwitch', 'verbatimModuleSyntax']) {
      expect(tsapp, flag).toMatch(new RegExp(`"${flag}":\\s*true`));
      expect(standards, flag).toContain(flag);
    }
    expect(tsapp, 'the page says strict is not set').not.toMatch(/"strict"/);
    expect(read('app/tsconfig.university.json')).toMatch(/"strict":\s*true/);
    expect(read('app/src/lib/complexitybudgets.test.ts')).toContain('Math.max(2, Math.ceil(n * 0.1))');
    expect(read('app/src/lib/ops/decisionlog.test.ts')).toContain('takes no new decision into the log');
  });

  it('would find no holder in a row that has none (control)', () => {
    expect(holders(['The thing', 'Nobody, really'])).toEqual([]);
    expect(holders(['The thing', '`npm run lint`'])).toHaveLength(1);
    expect(holders(['The thing', '`app/src/lib/nope.ts`'])).toEqual([]);
    expect(holders(['The thing', '`app/src/donotbuild.test.ts`'])).toHaveLength(1);
  });
});

// ── 5 · the testing guide ──────────────────────────────────────────────────

describe('the testing guide', () => {
  const guide = read('docs/developers/TESTING-GUIDE.md');
  const ci = read('.github/workflows/ci.yml');
  const vite = read('app/vite.config.ts');

  it('describes the two Vitest projects as the config defines them', () => {
    expect(vite).toContain("name: 'shared'");
    expect(vite).toContain("name: 'mocked'");
    expect(vite).toMatch(/name: 'shared',\s*isolate: false/);
    expect(vite).toMatch(/name: 'mocked',\s*isolate: true/);
    expect(guide).toContain('`MOCKS_MODULES`');
    expect(vite).toContain('const MOCKS_MODULES');
    const workers = /maxWorkers: (\d+)/.exec(vite)?.[1];
    expect(workers).toBeTruthy();
    expect(guide).toContain(`\`maxWorkers\` is ${workers}`);
    const timeout = /testTimeout: ([\d_]+)/.exec(vite)?.[1].replace(/_/g, '');
    expect(guide).toContain(`\`testTimeout\` and \`hookTimeout\` are ${Number(timeout) / 1000} seconds`);
    expect(scripts['test:publication']).toContain('vitest.publication.config.ts');
    expect(scripts['test:zones']).toContain('America/Chicago');
    expect(scripts['test:zones']).toContain('Pacific/Kiritimati');
    expect(scripts['test:shuffle']).toContain('--sequence.shuffle');
  });

  it('names the CI jobs and the build job steps as ci.yml has them', () => {
    const jobs = [...ci.matchAll(/^  ([a-z-]+):$/gm)].map((m) => m[1]);
    for (const job of ['build', 'account-sync', 'secrets', 'notify']) {
      expect(jobs, job).toContain(job);
      expect(guide, job).toContain(`| \`${job}\` |`);
    }
    const buildRow = rows(section(guide, '## What CI runs')).find((r) => r[0] === '`build`');
    expect(buildRow).toBeTruthy();
    const steps = [...(buildRow ?? [])[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    expect(steps.length).toBeGreaterThanOrEqual(10);
    for (const step of steps) expect(ci, `step ${step}`).toContain(`- name: ${step}\n`);
    expect(ci).toMatch(/node-version: 22\n/);
  });

  it('names the other workflows by their file, name and trigger', () => {
    const table = rows(section(guide, '## What CI runs').split('Other workflows:')[1]);
    expect(table.length).toBe(11);
    for (const [name, file, trigger] of table) {
      const f = file.replace(/`/g, '');
      const yml = read(`.github/workflows/${f}`);
      expect(yml, f).toMatch(new RegExp(`^name: ${name}$`, 'm'));
      if (/Nightly/.test(trigger)) expect(yml, f).toContain("cron: '0 7 * * *'");
      if (/Hourly/.test(trigger)) expect(yml, f).toMatch(/cron: '\d+ \* \* \* \*'/);
      if (/After `CI`/.test(trigger)) expect(yml, f).toMatch(/workflows: \['CI'\]/);
      if (/07:17 UTC/.test(trigger)) expect(yml, f).toContain("cron: '17 7 * * *'");
      if (/Monday at 06:41 UTC/.test(trigger)) expect(yml, f).toContain("cron: '41 6 * * 1'");
      if (/workflow_dispatch|by hand/.test(trigger)) expect(yml, f).toContain('workflow_dispatch');
    }
    expect(readdirSync(at('.github/workflows')).filter((f) => f.endsWith('.yml'))).toHaveLength(table.length + 1);
  });

  it('would convict a step name that ci.yml does not have (control)', () => {
    expect(ci).toContain('- name: Typecheck\n');
    expect(ci).not.toContain('- name: Typecheck everything twice\n');
  });
});

// ── 6 · the onboarding page ────────────────────────────────────────────────

describe('the onboarding page', () => {
  const onboarding = read('docs/developers/ONBOARDING.md');

  it('says the Node version the way the repository selects it', () => {
    expect(read('.github/workflows/ci.yml')).toContain('node-version: 22\n');
    expect(onboarding).toContain('`node-version: 22`');
    expect(JSON.parse(read('app/package.json')).engines, 'the page says no engines field').toBeUndefined();
    expect(existsSync(at('.nvmrc')), 'the page says there is no .nvmrc').toBe(false);
    // The root manifest is the workspace root for app and packages/* (PRs 1180 and the C0 PR 1b that followed): it holds the one lockfile and no scripts, so `npm test` there fails with "Missing script".
    const root = JSON.parse(read('package.json')) as { private?: boolean; workspaces?: string[]; scripts?: object; engines?: { node?: string } };
    expect(root.private).toBe(true);
    expect(root.workspaces).toEqual(['app', 'packages/*']);
    expect(root.scripts, 'the page says the root defines no scripts').toBeUndefined();
    expect(onboarding).toContain(`engines: { node: "${root.engines?.node}" }`);
    expect(onboarding).toContain('workspace root for `app` and `packages/*` and defines no scripts');
    expect(existsSync(at('package-lock.json')), 'the page says the one lockfile is at the root').toBe(true);
    expect(existsSync(at('app/package-lock.json')), 'the page no longer mentions an app lockfile').toBe(false);
    expect(read('.github/workflows/ci.yml')).toContain('cache-dependency-path: package-lock.json');
    const lock = JSON.parse(read('package-lock.json')).packages['node_modules/jsdom'];
    expect(onboarding).toContain(lock.engines.node);
  });

  it('gives the PostgreSQL major the config asks for', () => {
    const want = /^\s*major_version\s*=\s*(\d+)/m.exec(read('supabase/config.toml'))?.[1];
    expect(want).toBeTruthy();
    expect(onboarding).toContain(`major_version = ${want}`);
    expect(onboarding).toContain(`No PostgreSQL ${want} server found`);
    expect(read('supabase/check.sh')).toContain('No PostgreSQL $want server found');
    expect(read('supabase/check.sh')).toContain('SEMESTER_CHECK_PG_ANY');
  });

  it('describes the local gateway as start.ts boots it', () => {
    const start = read('app/server/institution/start.ts');
    expect(start).toContain("process.env.SEMESTER_SANDBOX_INSTITUTION === '1'");
    expect(start).toContain('SANDBOX INSTITUTION IS ON');
    expect(start).toContain('Set SEMESTER_JOURNAL_KEY to 32 random bytes encoded as hex');
    expect(read('app/server/institution/.env.example')).not.toContain('SEMESTER_SANDBOX_INSTITUTION');
    expect(onboarding).toContain('is not in `.env.example`');
    expect(read('app/server/institution/gateway.ts')).toContain("path === '/health/live'");
    expect(scripts['dev:university']).toContain('server/institution/.env');
    expect(read('app/scripts/gateway-smoke.mjs')).toContain('/status');
  });

  it('describes the adoption prompt and the seed key as the code has them', () => {
    expect(read('app/src/screens/Onboarding.tsx')).toContain('Your syllabi. One brain.');
    expect(read('app/src/state/shape.ts')).toContain("STORAGE_KEY = 'semester.v1'");
    expect(read('app/src/lib/migrate.ts')).toMatch(/export const SCHEMA = \d+/);
    expect(onboarding).toContain('`semester.v1`');
    expect(read('.claude/skills/run/SKILL.md')).toContain('semester.v1');
  });

  it('reads the gateway status from the truth table', () => {
    const row = read('docs/FEATURE-TRUTH-TABLE.md').split('\n').find((l) => l.startsWith('| Institution gateway (records/actions/AI)'));
    expect(row).toBeTruthy();
    const status = (row ?? '').split('|')[2].trim();
    expect(onboarding).toContain(`is ${status}:`);
    expect(read('docs/developers/HOW-TO-ADD-A-GATEWAY-ROUTE.md')).toContain(`**Status:** ${status}.`);
  });
});

// ── 7 · the how-tos ────────────────────────────────────────────────────────

/** A symbol a how-to names, and the file that must still define or hold it. */
const SYMBOLS: [string, string][] = [
  ['EVENT_TYPES', 'packages/institution/src/events.ts'],
  ['EVENT_TYPE_PATTERN', 'packages/institution/src/events.ts'],
  ['RESOURCE_CLASSIFICATIONS', 'packages/institution/src/policy.ts'],
  ['POLICY_ACTIONS', 'packages/institution/src/policy.ts'],
  ['processOnce', 'packages/institution/src/events.ts'],
  ['TELEMETRY_ROUTES', 'app/server/institution/gateway.ts'],
  ['telemetryRoute', 'app/server/institution/gateway.ts'],
  ['createGateway', 'app/server/institution/gateway.ts'],
  ['EDGE_GUARDS', 'app/src/lib/edgeguards.ts'],
  ['MOCKS_MODULES', 'app/vite.config.ts'],
  ['OWNED_TABLES', 'app/src/lib/cloud.ts'],
  ['NAMED', 'app/src/lib/supplychain.ts'],
  ['ACTIONS', 'app/src/lib/supplychain.ts'],
  ['APPROVED', 'app/src/lib/supplychain.ts'],
  ['KILL_SWITCHES', 'app/src/lib/flags.ts'],
  ['evaluateFlag', 'app/src/lib/flags.ts'],
  ['OPERATION_POLICIES', 'app/src/lib/governance/operation-policy.ts'],
  ['CHARTERS', 'app/src/lib/governance/charters.ts'],
  ['charterProblems', 'app/src/lib/governance/charters.ts'],
  ['capabilityDefinition', 'app/src/lib/governance/capability-governance.ts'],
  ['WINDOW_TITLE', 'app/src/lib/ops/proofcalendar.ts'],
];

/** A test the how-tos say fails when a step is skipped, and a phrase it must still carry. */
const GUARDS: [string, string][] = [
  ['app/src/lib/tablerls.test.ts', 'has every created table enabling it in the repository, not via ensure_rls'],
  ['app/src/lib/migrationorder.test.ts', 'every pending migration is above the watermark'],
  ['app/src/lib/edgeguards.test.ts', 'lists every function that exists, so a new one cannot be deployed unguarded'],
  ['app/src/lib/deployfunctions.test.ts', 'lists every function that exists under "What is live"'],
  ['app/src/lib/deployfunctions.test.ts', 'declares every one of them in config.toml, or previews skip it'],
  ['app/src/lib/functionsdeployed.test.ts', 'has a row for every function that exists'],
  ['app/src/lib/flags.test.ts', 'is written down, key for key, in docs/FEATURE-FLAG-REGISTRY.md'],
  ['app/src/lib/complexitybudgets.test.ts', 'is within its budget'],
  ['app/src/lib/governance/operation-policy.test.ts', 'covers every flag exactly once, with the same risk and allowed capabilities'],
  ['app/src/lib/governance/activation-control-plane.test.ts', 'docs/ACTIVATION-CONTROL-PLANE.md'],
  ['app/src/lib/governance/charters.test.ts', 'charters every module and ops flag, and nothing that is not a flag'],
  ['packages/institution/src/events.test.ts', 'names every type as domain.name, and every classification and retention class is a known one'],
  ['packages/institution/src/events.test.ts', 'carries the audit event every policy action promises'],
  ['packages/institution/src/events.test.ts', 'holds the same classification list and type shape as the outbox constraint'],
  ['app/src/lib/ops/decisionlog.test.ts', 'has no number written down twice, in the log or across the files'],
  ['app/src/lib/ops/decisionlog.test.ts', 'names each decision file for the one decision it holds'],
  ['app/src/lib/ops/proofcalendar.test.ts', "REGISTERS === 'write'"],
  ['app/src/lib/supplychain.test.ts', 'is what docs/SUPPLY-CHAIN.md says'],
];

describe('the how-to pages', () => {
  const howtos = HOWTOS.map((p) => [p, read(p)] as const);
  const all = howtos.map(([, t]) => t).join('\n');
  const everything = PAGES.map(read).join('\n');

  it('give numbered steps, and say what failed when they were followed', () => {
    for (const [page, text] of howtos) {
      expect((text.match(/^\d+\. /gm) ?? []).length, `${page} has fewer than four numbered steps`).toBeGreaterThanOrEqual(4);
      expect(text, page).toMatch(/^## What (fails|holds)/m);
    }
  });

  it('name only symbols that the code still defines', () => {
    for (const [symbol, file] of SYMBOLS) {
      expect(read(file), `${file} should define ${symbol}`).toMatch(new RegExp(`\\b${symbol}\\b`));
      expect(everything, `no page names ${symbol}: remove it from SYMBOLS`).toContain(`\`${symbol}\``);
    }
  });

  it('name only failures that the guarding tests still report', () => {
    for (const [file, phrase] of GUARDS) {
      expect(read(file), `${file} should still carry "${phrase}"`).toContain(phrase);
    }
    for (const phrase of ['has every created table enabling it in the repository, not via ensure_rls', 'every pending migration is above the watermark', 'names every type as domain.name, and every classification and retention class is a known one', 'covers every flag exactly once, with the same risk and allowed capabilities']) {
      expect(all, phrase).toContain(phrase);
    }
  });

  it('quote the event name pattern as the code has it', () => {
    const source = /EVENT_TYPE_PATTERN = \/(.+)\/;/.exec(read('packages/institution/src/events.ts'))?.[1];
    expect(source).toBe('^[a-z_]+\\.[a-z_]+$');
    expect(read('docs/developers/HOW-TO-ADD-AN-EVENT-TYPE.md')).toContain(`\`${source}\``);
    expect(read('supabase/migrations/20260928320000_audit_correlation_and_outbox.sql')).toContain('event_type ~');
  });

  it('count the decision log as the decision test does', () => {
    expect(LAST_IN_LOG).toBe(160);
    const page = read('docs/developers/HOW-TO-ADD-A-DECISION-RECORD.md');
    expect(page).toContain(`D-160`);
    expect(read('docs/decisions/README.md')).toContain('D-001 to D-160');
    expect(read('CLAUDE.md')).toContain('closed at D-160');
    expect(existsSync(at('docs/decisions/D-1150.md'))).toBe(true);
  });

  it('name the next architecture record number as the directory has it', () => {
    const numbers = readdirSync(at('docs/architecture'))
      .map((f) => /^(\d{4})-/.exec(f)?.[1])
      .filter((n): n is string => !!n)
      .map(Number);
    const last = Math.max(...numbers);
    expect(numbers.length).toBeGreaterThan(5);
    const page = read('docs/developers/HOW-TO-ADD-AN-ADR.md');
    expect(page, 'the page says which record is last: update it and the next number').toContain(`the last record is \`${String(last).padStart(4, '0')}\``);
    expect(page).toContain(`starts \`${String(last + 1).padStart(4, '0')}-\``);
  });

  it('describe the migration watermark and the pending-row window as the tests do', () => {
    const ledger = read('supabase/ledger.snapshot').split('\n').filter((l) => /^\d{14}\s/.test(l));
    expect(ledger.length).toBeGreaterThan(10);
    expect(read('app/src/lib/migrationorder.test.ts')).toContain('pending version may not be **below the watermark**');
    const days = /PENDING_DAYS = (\d+)/.exec(read('app/src/lib/functionsdeployed.test.ts'))?.[1];
    expect(read('docs/developers/HOW-TO-ADD-AN-EDGE-FUNCTION.md')).toContain(`within ${days} days`);
    expect(read('supabase/check.sh')).toContain('SEMESTER_CHECK_REAPPLY');
    expect(read('.github/workflows/ci.yml')).toContain("SEMESTER_CHECK_REAPPLY: '1'");
    expect(readdirSync(at('supabase')).filter((f) => f.endsWith('.check.sql')).length).toBeGreaterThan(20);
  });

  it('describe the gateway route rules as the gateway has them', () => {
    const gateway = read('app/server/institution/gateway.ts');
    expect(gateway).toContain("return TELEMETRY_ROUTES.has(pathname) ? pathname : '/unmatched';");
    expect(gateway).toMatch(/request\.method === 'POST' && path !== '\/actions\/reconcile' && config\.readOnly\?\.\(\)/);
    expect(gateway).toContain("path === '/v1/auth/config'");
    expect(read('app/api/institution/[...path].ts')).toContain("replace(/^\\/api\\/institution/, '')");
    expect(read('app/server/institution/adapters.ts')).toContain('adapters: InstitutionAdapter[] = []');
    expect(read('docs/UNIVERSITY_CONNECTIONS.md')).toContain('| `POST /actions/reconcile` |');
  });

  it('describe the register mechanism as the scripts have it', () => {
    expect(scripts.registers).toContain('REGISTERS=write vitest run');
    expect(scripts.registers).toContain('scripts/source-index.mjs');
    expect(scripts.registers).toContain('src/lib/supplychain.test.ts');
    expect(scripts.registers).toContain('src/lib/ops/');
    expect(scripts.registers).toContain('src/lib/governance/activation-control-plane.test.ts');
    expect(read('docs/SUPPLY-CHAIN.md')).toContain('Rendered from app/src/lib/supplychain.ts');
  });

  it('describe the flag fields as the registry requires them', () => {
    const flags = read('app/src/lib/flags.ts');
    for (const field of ['key', 'description', 'type', 'owner', 'scopes', 'highRisk', 'reviewAt', 'rollout', 'successCriteria', 'rollback', 'killSwitches', 'capabilityIds']) {
      expect(flags, field).toMatch(new RegExp(`\\b${field}:`));
    }
    for (const prefix of ['module.', 'integration.', 'scope.', 'release.', 'experiment.', 'ops.', 'safety.', 'writeback.']) {
      expect(read('app/src/lib/flags.test.ts'), prefix).toContain(`'${prefix}'`);
    }
    const budgets = JSON.parse(read('app/complexity-budgets.json'));
    expect(budgets.flags).toBeGreaterThan(0);
  });

  it('are listed in the index, once each', () => {
    const index = read('docs/developers/README.md');
    for (const page of PAGES.filter((p) => p.startsWith('docs/developers/') && !p.endsWith('README.md'))) {
      const name = page.split('/').pop() as string;
      expect(index.split(`| [\`${name}\`](${name}) |`).length - 1, `${name} should be in the index table once`).toBe(1);
    }
  });

  it('would notice a symbol the code lost (control)', () => {
    expect(read('packages/institution/src/events.ts')).not.toMatch(/\bNO_SUCH_SYMBOL_ANYWHERE\b/);
    expect(read('packages/institution/src/events.ts')).toMatch(/\bEVENT_TYPES\b/);
  });
});

// ── 8 · CONTRIBUTING.md ────────────────────────────────────────────────────

/** The distinct handles a CODEOWNERS file names. */
const owners = (codeowners: string) =>
  [...new Set(codeowners.split('\n').filter((l) => !l.startsWith('#')).flatMap((l) => l.match(/@[\w-]+/g) ?? []))];

describe('CONTRIBUTING.md', () => {
  const contributing = read('CONTRIBUTING.md');
  const claude = read('CLAUDE.md').replace(/\s+/g, ' ');

  it('does not contradict CLAUDE.md on the commands it repeats', () => {
    for (const cmd of ['git fetch origin main', 'git log --oneline -30 origin/main', 'git log --oneline -40 origin/main | grep -i <the-thing>', 'git log -p --since="6 hours ago" origin/main -- <the-file-you-are-about-to-edit>']) {
      expect(contributing, cmd).toContain(cmd);
      expect(claude, `CLAUDE.md should still say ${cmd}`).toContain(cmd);
    }
    for (const gate of ['npx tsc -b', 'npm run lint', 'npm run check:university', 'npm test', 'npm run test:shuffle', 'npm run build']) {
      expect(contributing, gate).toContain(gate);
      expect(claude, `CLAUDE.md should still list ${gate}`).toContain(gate);
    }
    expect(contributing).toContain('`CLAUDE.md` wins');
    expect(claude).toContain('docs/decisions/D-<pull request number>.md');
    expect(contributing).toContain('docs/decisions/D-<pull request number>.md');
    expect(claude).toContain('Rebase onto `origin/main` before');
    expect(contributing).toContain('Rebase onto `origin/main` before you push');
    expect(contributing).toContain('docs/developers/ONBOARDING.md');
  });

  it('says one owner, as CODEOWNERS does', () => {
    expect(owners(read('.github/CODEOWNERS'))).toHaveLength(1);
    expect(contributing).toContain('names **one** owner today');
    const paths = ['supabase/migrations/', 'supabase/functions/', 'app/server/', 'app/api/', 'packages/institution/', '.github/', 'contracts/'];
    for (const p of paths) expect(read('.github/CODEOWNERS'), p).toContain(`/${p}`);
    for (const p of paths) expect(contributing, p).toContain(`\`${p}\``);
  });

  it('counts owners rather than assuming one (control)', () => {
    expect(owners('# c\n* @a\n/x/ @a\n')).toEqual(['@a']);
    expect(owners('# c\n* @a\n/x/ @a @b\n')).toEqual(['@a', '@b']);
  });

  it('says the ruleset is a definition that is not applied, while the page it cites says so', () => {
    const rules = JSON.parse(read('.github/rulesets/main.json'));
    const checks: string[] = rules.rules
      .filter((r: { type: string }) => r.type === 'required_status_checks')
      .flatMap((r: { parameters: { required_status_checks: { context: string }[] } }) => r.parameters.required_status_checks.map((c) => c.context));
    expect(checks.sort()).toEqual(['account-sync', 'build', 'secrets']);
    for (const c of checks) expect(contributing, c).toContain(`\`${c}\``);
    const jobs = read('.github/workflows/ci.yml');
    for (const c of checks) expect(jobs, c).toMatch(new RegExp(`^  ${c}:$`, 'm'));
    const protection = read('docs/BRANCH-PROTECTION.md');
    expect(protection).toContain('not yet applied');
    expect(protection).toContain('Not active until the owner applies it');
    expect(contributing).toContain('not yet applied');
    expect(read('docs/developers/CODING-STANDARDS.md')).toContain('not yet applied');
    expect(protection).toContain('required_linear_history');
    expect(contributing).toContain('does not require linear history');
    expect(JSON.stringify(rules)).not.toContain('required_linear_history');
  });

  it('carries the documentation obligation, and nothing about a command that does not exist', () => {
    expect(contributing).toContain('A change is not finished until its page is');
    expect(contributing).toContain('docs/documentation/README.md');
    // `docs:impact` is the lead's, added with the documentation system. This page
    // may name it only once the script exists.
    expect(contributing.includes('docs:impact') ? 'docs:impact' in scripts : true, 'CONTRIBUTING.md names docs:impact, but app/package.json has no such script').toBe(true);
    for (const page of ['PUBLIC-CLAIMS-APPROVAL-REGISTER.md', 'docs/FEATURE-TRUTH-TABLE.md', 'docs/DEFINITION-OF-DONE.md', '.github/pull_request_template.md']) {
      expect(existsSync(at(page)), page).toBe(true);
    }
    const template = read('.github/pull_request_template.md');
    for (const gate of ['`npx tsc -b`', '`npm run lint`', '`npm test`', '`npm run test:shuffle`', '`npm run build`']) expect(template, gate).toContain(gate);
  });
});
