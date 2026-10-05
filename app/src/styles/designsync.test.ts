import { afterAll, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * The design-sync tooling is held to what it says, and to the real tree.
 *
 * `scripts/design-system-audit.mjs` fails on a colour literal that is not on its
 * ledger, a `var(--x)` that names nothing, and a Figma mapping row that does not
 * resolve; `design-system-report.mjs` prints the same figures. A rule nothing
 * has ever failed is not known to be a rule, so each is driven here against a
 * tree built to break it, and against a tree built not to — the second is the
 * control: a probe that flags everything is also what a broken probe does.
 *
 * Run as processes, because the commands are what CI and a person run, and
 * because plain `node` cannot import `lib/look.ts`: the scripts read the
 * committed export, which `lib/tokenexport.test.ts` holds to the code.
 */

const here = new URL('.', import.meta.url).pathname; // app/src/styles/
const APP = join(here, '..', '..');
const ROOT = join(APP, '..');
const AUDIT = join(APP, 'scripts', 'design-system-audit.mjs');
const REPORT = join(APP, 'scripts', 'design-system-report.mjs');

const run = (script: string, args: string[]) => {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const audit = (args: string[]) => {
  const r = run(AUDIT, [...args, '--json']);
  return { code: r.code, result: JSON.parse(r.out) as { findings: Array<{ severity: string; check: string; found: string }>; stats: any; failing: unknown[] } };
};
const checks = (args: string[]) => audit(args).result.findings.map((f) => f.check);

// Each case starts a Node process, and the ones on the real tree read every source file.
vi.setConfig({ testTimeout: 30_000 });

const memo = <T,>(f: () => T) => {
  let v: T | undefined;
  return () => (v ??= f());
};
const realAudit = memo(() => audit([]));
const bareAudit = memo(() => audit(['--ledger', 'none']));
const realReport = memo(() => run(REPORT, []));

const scratch: string[] = [];
afterAll(() => scratch.forEach((d) => rmSync(d, { recursive: true, force: true })));

const EXPORT = {
  $schema: 'semester.tokens/1',
  collections: { ground: { modes: ['ink'], default: 'ink', variables: 1 } },
  primitive: { 'app-panel': { $type: 'color', $value: '#000', $extensions: { semester: { varies: ['ground'] } } } },
  semantic: { 'surface-base': { $type: 'reference', $value: '{primitive.app-panel}', $extensions: { semester: { css: 'var(--app-panel)' } } } },
};

const MAPPING = [
  '| Figma variable | Exported path | CSS custom property | Parity |',
  '| --- | --- | --- | --- |',
  '| `Ground/app-panel` | `primitive.app-panel` | `--app-panel` | Planned |',
  '| `Semantic/surface/base` | `semantic.surface-base` | `--surface-base` | Planned |',
].join('\n');

/** A small app tree that is valid: no literal, every var() defined, every row resolving. */
function tree(over: { files?: Record<string, string>; mapping?: string | null; exported?: unknown } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dsync-'));
  scratch.push(dir);
  const put = (rel: string, text: string) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  };
  put('app/design-tokens/semester.tokens.json', JSON.stringify(over.exported ?? EXPORT));
  put('app/src/styles/tokens.css', ':root {\n  --surface-base: var(--app-panel);\n}\n');
  put('app/src/styles/app.css', '.card { background: var(--surface-base); border: 1px solid var(--app-panel); }\n');
  put('app/src/screens/Home.tsx', "export const Home = () => <div style={{ background: 'var(--surface-base)' }} />;\n");
  for (const [rel, text] of Object.entries(over.files ?? {})) put(`app/src/${rel}`, text);
  if (over.mapping !== null) put('docs/FIGMA-MAPPING.md', over.mapping ?? MAPPING);
  return { app: join(dir, 'app'), dir, args: ['--app', join(dir, 'app'), '--ledger', 'none'] };
}

describe('the audit, against trees built to break each rule', () => {
  it('passes a valid tree — the control: it does not flag everything', () => {
    const t = tree();
    const { code, result } = audit(t.args);
    expect(result.findings).toEqual([]);
    expect(code).toBe(0);
    expect(run(AUDIT, t.args).out).toContain('design-system ok');
  });

  it('counts colour literals in declaration bodies and nothing else', () => {
    const css = [
      '/* #ff0000 rgba(0,0,0,.5) in a comment is not a colour */',
      '#abc { color: var(--app-fg); }', // an id selector that reads as hex
      '.a { fill: url(#grad); }', // a fragment, not a colour
      '.b { color: #fff; background: #1a2b3c; border-color: #abcd; }', // three
      '.c { box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2), 0 1px hsl(10 20% 30%); }', // two
      '@media (min-width: 700px) { .d { color: oklch(0.5 0.1 200); } }', // one, inside a media block
      '.e { color: var(--app-fg, #123456); }', // a literal in a fallback is still a literal: one
    ].join('\n');
    const { result } = audit(tree({ files: { 'styles/extra.css': css } }).args);
    expect(result.stats.colours['styles/extra.css']).toBe(7);
  });

  it('flags a colour literal in a stylesheet, naming file and line', () => {
    const t = tree({ files: { 'styles/features.css': '.x {\n  color: #fff;\n}\n' } });
    const { code, result } = audit(t.args);
    expect(code).toBe(1);
    const f = result.findings.find((x) => x.check === 'raw-colour')!;
    expect(f).toMatchObject({ severity: 'major', file: 'src/styles/features.css', line: 2 });
  });

  it('flags a functional colour in a string in a .tsx, and not one in a comment', () => {
    const bad = tree({ files: { 'components/Bad.tsx': "export const s = { boxShadow: '0 1px 2px rgba(0,0,0,.3)' };\n" } });
    expect(checks(bad.args)).toContain('raw-colour');
    const fine = tree({ files: { 'components/Fine.tsx': "// rgba(0,0,0,.3) is how it used to look\nexport const s = { color: 'var(--surface-base)' };\n" } });
    expect(checks(fine.args)).toEqual([]);
  });

  it('flags a var() that names nothing, and reads a fallback, a React-set key and a css definition as defined', () => {
    const t = tree({
      files: {
        'styles/x.css': '.a { border: 1px solid var(--app-border); }\n.b { color: var(--nope, red); }\n.c { width: var(--made-here); --made-here: 3px; }\n',
        'components/Band.tsx': "export const B = () => <div style={{ ['--band-cols' as string]: '3' }} />;\n",
        'styles/band.css': '.d { grid-template-columns: repeat(var(--band-cols), 1fr); }\n',
      },
    });
    const { result } = audit(t.args);
    const undef = result.findings.filter((f) => f.check === 'undefined-var');
    expect(undef.map((f) => f.found)).toEqual([expect.stringContaining('var(--app-border)')]);
  });

  it('fails a mapping row whose path is not in the export, and says blocker', () => {
    const t = tree({ mapping: MAPPING.replace('semantic.surface-base', 'semantic.surface-gone') });
    const { result } = audit(t.args);
    expect(result.findings).toEqual([expect.objectContaining({ severity: 'blocker', check: 'figma-mapping', found: expect.stringContaining('surface-gone') })]);
  });

  it('fails a CSS cell that is not the path, a repeated Figma name, and an unknown parity', () => {
    const rows = [
      '| `Ground/app-panel` | `primitive.app-panel` | `--panel` | Planned |',
      '| `Semantic/surface/base` | `semantic.surface-base` | `--surface-base` | Maybe |',
      '| `Semantic/surface/base` | `semantic.surface-base` | `--surface-base` | Planned |',
    ];
    const t = tree({ mapping: ['| Figma variable | Exported path | CSS custom property | Parity |', '| --- | --- | --- | --- |', ...rows].join('\n') });
    const found = audit(t.args).result.findings.map((f) => f.found).join('\n');
    expect(found).toContain('the CSS cell says --panel');
    expect(found).toContain('parity "Maybe"');
    expect(found).toContain('is mapped twice');
  });

  it('fails when the mapping file or the export is missing, or the schema is not the exporter’s', () => {
    expect(checks(tree({ mapping: null }).args)).toContain('figma-mapping');
    const noExport = tree();
    rmSync(join(noExport.app, 'design-tokens'), { recursive: true });
    expect(audit(noExport.args).result.findings[0]).toMatchObject({ severity: 'blocker', check: 'export' });
    const wrong = tree({ exported: { ...EXPORT, $schema: 'tokens/9' } });
    expect(audit(wrong.args).result.findings[0]).toMatchObject({ severity: 'blocker', check: 'export' });
  });

  it('reports a semantic token with no row without failing', () => {
    const only = ['| Figma variable | Exported path | CSS custom property | Parity |', '| --- | --- | --- | --- |', '| `Ground/app-panel` | `primitive.app-panel` | `--app-panel` | Planned |'].join('\n');
    const { code, result } = audit(tree({ mapping: only }).args);
    expect(code).toBe(0);
    expect(result.stats.mapping).toMatchObject({ semanticMapped: 0, semanticTotal: 1, unmapped: ['surface-base'] });
  });
});

describe('the ledger only shrinks', () => {
  const ledger = (n: number) => {
    const f = join(mkdtempSync(join(tmpdir(), 'dsync-ledger-')), 'ledger.json');
    scratch.push(dirname(f));
    writeFileSync(f, JSON.stringify({ colour: { 'styles/old.css': [n, 'owed'] } }));
    return f;
  };
  const two = '.a { color: #111; }\n.b { color: #222; }\n';

  it('passes at the listed count, fails above it, and fails below it', () => {
    const t = tree({ files: { 'styles/old.css': two } });
    const at = (n: number) => audit(['--app', t.app, '--ledger', ledger(n)]);
    expect(at(2).result.findings).toEqual([]);
    expect(at(1).result.findings.map((f) => f.check)).toEqual(['raw-colour']);
    expect(at(3).result.findings.map((f) => f.check)).toEqual(['ledger']);
  });

  it('lists the same file at zero as a file that is not listed', () => {
    const t = tree({ files: { 'styles/old.css': two } });
    expect(audit(['--app', t.app, '--ledger', ledger(0)]).code).toBe(1);
  });
});

describe('the real tree', () => {
  it('passes, with the figures the ledgers hold', () => {
    const { code, result } = realAudit();
    expect(result.findings).toEqual([]);
    expect(code).toBe(0);
    expect(result.stats.exported.semantic).toBeGreaterThan(100);
  });

  it('measures real debt when the ledger is taken away — so a pass above is not vacuous', () => {
    const { code, result } = bareAudit();
    expect(code).toBe(1);
    const owed = new Set(result.findings.map((f) => f.check));
    expect(owed).toContain('raw-colour');
    expect(owed).toContain('undefined-var');
    expect(result.findings.some((f) => f.found.includes('var(--app-border)'))).toBe(true);
  });

  it('resolves every Figma row against the committed export', () => {
    const { result } = realAudit();
    expect(result.findings.filter((f) => f.check === 'figma-mapping')).toEqual([]);
    expect(result.stats.mapping.rows).toBeGreaterThan(100);
  });

  it('fails when one real row is pointed at a token that does not exist — a control on the real file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsync-map-'));
    scratch.push(dir);
    const broken = join(dir, 'FIGMA-MAPPING.md');
    const text = readFileSync(join(ROOT, 'docs', 'FIGMA-MAPPING.md'), 'utf8');
    expect(text).toContain('`semantic.surface-base`');
    writeFileSync(broken, text.replace('`semantic.surface-base`', '`semantic.surface-nowhere`'));
    const { code, result } = audit(['--mapping', broken]);
    expect(code).toBe(1);
    expect(result.findings).toEqual([expect.objectContaining({ severity: 'blocker', found: expect.stringContaining('surface-nowhere') })]);
  });

  it('exports every semantic token the stylesheet defines — the sync the mapping stands on', () => {
    const exported = JSON.parse(readFileSync(join(APP, 'design-tokens', 'semester.tokens.json'), 'utf8'));
    const css = readFileSync(join(here, 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const block = /:root\s*\{([\s\S]*?)\n\}/.exec(css)![1];
    const names = [...block.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]).sort();
    expect(Object.keys(exported.semantic).sort()).toEqual(names);
  });
});

describe('the report', () => {
  it('passes a valid tree and says strong', () => {
    const r = run(REPORT, tree().args);
    expect(r.code).toBe(0);
    expect(r.out).toContain('# Semester design-system report');
    expect(r.out).toContain('Alignment: **strong**');
  });

  it('shows a violation and still exits 0, until --strict asks it not to', () => {
    const t = tree({ files: { 'styles/features.css': '.x { color: #fff; }\n' } });
    const lax = run(REPORT, t.args);
    expect(lax.code).toBe(0);
    expect(lax.out).toContain('src/styles/features.css:1');
    expect(lax.out).toContain('Alignment: **weak**');
    expect(run(REPORT, [...t.args, '--strict']).code).toBe(1);
  });

  it('calls a broken mapping critical, and --strict fails on it', () => {
    const t = tree({ mapping: MAPPING.replace('primitive.app-panel', 'primitive.app-gone') });
    expect(run(REPORT, t.args).out).toContain('critical drift');
    expect(run(REPORT, [...t.args, '--strict']).code).toBe(1);
  });

  it('escapes a backslash before the pipe in a table cell, so a value cannot swallow its own escape', () => {
    // The file holds `a\|b rgba(1,1,1,1)`; the finding quotes it, and the report writes it into a cell.
    const t = tree({ files: { 'components/Esc.tsx': "export const s = 'a\\|b rgba(1,1,1,1)';\n" } });
    const out = run(REPORT, t.args).out;
    expect(out).toContain('a\\\\\\|b'); // a, two backslashes, then the escaped pipe
    expect(out).not.toMatch(/a\\\\\|b/); // not the pipe-only escaping, where one backslash survives to eat the next
  });

  it('appends to --out, so it can write to an Actions step summary', () => {
    const t = tree();
    const out = join(t.dir, 'summary.md');
    appendFileSync(out, 'earlier step\n');
    run(REPORT, [...t.args, '--out', out]);
    const text = readFileSync(out, 'utf8');
    expect(text.startsWith('earlier step')).toBe(true);
    expect(text).toContain('# Semester design-system report');
  });

  it('reports the real tree from the same figures the audit holds', () => {
    const r = realReport();
    expect(r.code).toBe(0);
    expect(r.out).toContain('Raw colour literals');
    expect(r.out).toContain('`--app-border`');
  });
});

describe('the wiring', () => {
  const pkg = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')) as { scripts: Record<string, string> };

  it('has the three scripts, and check runs the audit and the tests that hold the export', () => {
    expect(pkg.scripts['design-system:audit']).toBe('node scripts/design-system-audit.mjs');
    expect(pkg.scripts['design-system:report']).toBe('node scripts/design-system-report.mjs');
    const check = pkg.scripts['design-system:check'];
    for (const part of ['design-system-audit.mjs', 'tokenexport.test.ts', 'tokens.test.ts', 'hex.test.ts', 'designsync.test.ts']) expect(check, part).toContain(part);
  });

  it('declares the Figma server over http, with no credential in the file', () => {
    const text = readFileSync(join(ROOT, '.mcp.json'), 'utf8');
    const mcp = JSON.parse(text);
    expect(mcp.mcpServers.figma).toEqual({ type: 'http', url: 'https://mcp.figma.com/mcp' });
    expect(text).not.toMatch(/token|secret|authorization|bearer|api[_-]?key|headers/i);
  });

  it('ships both skills with a name that matches the folder', () => {
    for (const name of ['audit-semester-design-sync', 'build-semester-ui']) {
      const file = join(ROOT, '.claude', 'skills', name, 'SKILL.md');
      expect(existsSync(file), name).toBe(true);
      const head = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'))![1];
      expect(head).toMatch(new RegExp(`^name: ${name}$`, 'm'));
      expect(head).toMatch(/^description: .{40,}/m);
    }
  });
});
