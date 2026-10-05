import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTokenExport, serialise } from '../lib/tokenexport';
import {
  ALLOWED_RAW, AXES, escapeCell, MAPPING_SCHEMA, existsIn, findings, ledgerOf, overLedger, renderLedger, renderReport,
  resolves, scan, scanCss, scanTsx, totals, validateMapping, type ReportInput, type TokenFile,
} from './designsystem';
import { sources } from './rules';
import { RAW_BUDGET } from './rawbudget';

/**
 * The design-system toolkit, held to the proof standard `CLAUDE.md` sets.
 *
 * Every guard here has a control: a fixture the check must convict next to the
 * one it must pass, because a scan that finds nothing is also what a scan
 * looking in the wrong place finds. That is not hypothetical — the first
 * version of the CSS scan read nothing at all (its declaration pattern wanted a
 * leading dash), the tree walk said "clean", and only a comparison against an
 * independent `grep` of the same tree showed it. `reads the tree` below is that
 * comparison, kept.
 */

const SRC = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const ROOT = join(SRC, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const TOKENS = JSON.parse(read('app/design-tokens/semester.tokens.json')) as TokenFile;

describe('the raw-value rules', () => {
  const css = (decl: string) => scanCss('styles/probe.css', `.x {\n  ${decl}\n}`);
  const tsx = (expr: string) => scanTsx('screens/Probe.tsx', `const s = { ${expr} };`);

  it('convicts a raw value on each axis and passes the token that replaces it', () => {
    const cases: Array<[string, string, string]> = [
      ['color', 'color: #14161b;', 'color: var(--text-primary);'],
      ['color', 'border-color: rgba(236, 238, 242, 0.24);', 'border-color: var(--border-default);'],
      ['layer', 'z-index: 40;', 'z-index: var(--layer-overlay);'],
      ['elevation', 'box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);', 'box-shadow: var(--elevation-modal);'],
      ['motion', 'transition: opacity 200ms ease;', 'transition: opacity var(--motion-save);'],
      ['motion', 'animation: rise 1s cubic-bezier(0.1, 0.2, 0.3, 0.4);', 'animation: rise var(--duration-slow) var(--ease-standard);'],
      ['space', 'padding: 14px 20px;', 'padding: var(--sp-6) var(--sp-7);'],
      ['type', 'font-size: 13px;', 'font-size: var(--type-sm);'],
    ];
    for (const [rule, bad, good] of cases) {
      expect(css(bad).map((h) => h.rule), bad).toContain(rule);
      expect(css(good), good).toEqual([]);
    }
  });

  it('convicts a raw value in a style object and passes the token', () => {
    const cases: Array<[string, string, string]> = [
      ['color', "color: 'rgb(12, 14, 16)'", "color: 'var(--text-primary)'"],
      ['layer', 'zIndex: 40', "zIndex: 'var(--layer-overlay)'"],
      ['elevation', "boxShadow: '0 8px 24px rgba(0,0,0,.4)'", "boxShadow: 'var(--elevation-floating)'"],
      ['radius', 'borderRadius: 14', "borderRadius: 'var(--shape-card)'"],
      ['radius', "borderRadius: '12px'", 'borderRadius: 999'],
      ['motion', "transition: 'opacity 200ms ease'", "transition: 'opacity var(--motion-save)'"],
    ];
    for (const [rule, bad, good] of cases) {
      expect(tsx(bad).map((h) => h.rule), bad).toContain(rule);
      expect(tsx(good), good).toEqual([]);
    }
  });

  it('suggests the token that already names the value', () => {
    expect(css('z-index: 80;')[0].says).toContain('var(--layer-overlay)');
    expect(css('transition: opacity 130ms;')[0].says).toContain('--duration-fast');
    expect(css('padding: 8px;')[0].says).toContain('var(--sp-4)');
    expect(tsx('borderRadius: 6')[0].says).toContain('--r-md');
  });

  it('does not count a token definition, a hairline, a local layer, a url fragment or a comment', () => {
    expect(scanCss('styles/tokens.css', ':root {\n  --duration-fast: 130ms;\n  --app-bg: #090a0e;\n  --layer-menu: 90;\n}')).toEqual([]);
    expect(css('border: 1px solid var(--border-subtle);')).toEqual([]);
    expect(css('padding: 2px;')).toEqual([]);
    expect(css('z-index: 1;')).toEqual([]);
    expect(css('fill: url(#clip);')).toEqual([]);
    expect(scanCss('styles/probe.css', '/* z-index: 40; color: #fff; */ .x { color: var(--text-primary); }')).toEqual([]);
    expect(css('padding: calc(14px * var(--density, 1));')).toEqual([]);
    expect(css('font-size: calc(13px * var(--text-scale, 1));')).toEqual([]);
    // Hex in `.tsx` is hex.test.ts's, on its own ledger; counting it twice would put two ledgers on one number.
    expect(tsx("color: '#14161b'")).toEqual([]);
  });

  it('allows the reduced-motion clamp, with the reason on the allowlist', () => {
    const clamp = 'animation-duration: 0.001ms !important;';
    expect(scanCss('styles/app.css', `.x {\n  ${clamp}\n}`)).toEqual([]);
    // The exemption is for that file only: the same line elsewhere is a duration.
    expect(scanCss('styles/features.css', `.x {\n  ${clamp}\n}`).map((h) => h.rule)).toEqual(['motion']);
    for (const a of ALLOWED_RAW) expect(a.why.trim().length, a.file).toBeGreaterThan(30);
  });

  it('reports file, line, rule, the matched value and a suggestion', () => {
    const [h] = scanCss('styles/probe.css', '.a {\n  color: var(--text-primary);\n}\n.b {\n  z-index: 100;\n}');
    expect(h).toMatchObject({ file: 'styles/probe.css', line: 5, rule: 'layer', value: '100' });
    expect(h.found).toBe('z-index: 100');
    expect(h.says).toContain('--layer-skip');
  });
});

describe('the ledger', () => {
  it('reads the tree — checked against a grep that shares no code with it', () => {
    // The CSS and TSX walks are the ones that said "clean" while reading nothing.
    const hits = scan(SRC);
    expect(hits.some((h) => h.file.endsWith('.css'))).toBe(true);
    expect(hits.some((h) => h.file.endsWith('.tsx'))).toBe(true);
    const zTsx = readdirSyncDeep(SRC)
      .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
      .reduce((n, f) => n + [...readFileSync(f, 'utf8').matchAll(/zIndex:\s*(-?\d+)\b/g)].filter((m) => !['0', '1', '-1'].includes(m[1])).length, 0);
    // Comments are stripped by the scan and not by this, so the scan may count fewer, never more.
    const counted = hits.filter((h) => h.rule === 'layer' && h.file.endsWith('.tsx')).length;
    expect(counted).toBeGreaterThan(0);
    expect(counted).toBeLessThanOrEqual(zTsx);
    expect(zTsx - counted).toBeLessThanOrEqual(2);
  });

  it('is what the tree holds now — the valid case', () => {
    expect(overLedger(scan(SRC), RAW_BUDGET)).toEqual([]);
  });

  it('fails when a clean file gains a raw value, and when a ledgered file gains one more', () => {
    const base = ledgerOf(scan(SRC));
    const extra = scanTsx('screens/Brand.tsx', 'const s = { zIndex: 777 };');
    const grew = overLedger([...scan(SRC), ...extra], RAW_BUDGET);
    expect(grew).toHaveLength(1);
    expect(grew[0]).toMatchObject({ kind: 'grew', rule: 'layer', file: 'screens/Brand.tsx' });
    expect(grew[0].says).toContain('--layer');
    // A file that already owes something: one more is still growth.
    const [file] = Object.keys(base).filter((f) => base[f].layer && f.endsWith('.tsx'));
    const more = scanTsx(file, 'const s = { zIndex: 778 };');
    expect(overLedger([...scan(SRC), ...more], RAW_BUDGET).map((d) => `${d.kind}:${d.file}`)).toEqual([`grew:${file}`]);
  });

  it('says so when a file got cleaner, and says how to record it', () => {
    const [file] = Object.keys(RAW_BUDGET).filter((f) => f.endsWith('.tsx'));
    const without = scan(SRC).filter((h) => h.file !== file);
    const drift = overLedger(without, RAW_BUDGET);
    expect(drift.length).toBeGreaterThan(0);
    expect(drift.every((d) => d.kind === 'shrank')).toBe(true);
    expect(drift[0].says).toContain('design-system:audit -- --fix');
  });

  it('renders a ledger that round-trips to the committed file', () => {
    expect(renderLedger(RAW_BUDGET)).toBe(readFileSync(join(SRC, 'styles', 'rawbudget.ts'), 'utf8'));
  });

  it('fails on a tree it cannot read rather than passing it', () => {
    const empty = mkdtempSync(join(tmpdir(), 'ds-empty-'));
    try {
      expect(() => scan(empty)).toThrow(/no \.tsx/);
      expect(() => sources(empty)).toThrow();
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('carries no entry for a file that no longer exists', () => {
    for (const file of Object.keys(RAW_BUDGET)) expect(existsSync(join(SRC, file)), file).toBe(true);
    expect(AXES.every((a) => totals(RAW_BUDGET)[a] >= 0)).toBe(true);
  });
});

describe('token export drift', () => {
  const css = readFileSync(join(SRC, 'styles', 'tokens.css'), 'utf8');
  const app = readFileSync(join(SRC, 'styles', 'app.css'), 'utf8');
  const committed = readFileSync(join(ROOT, 'app', 'design-tokens', 'semester.tokens.json'), 'utf8');

  it('control: the sources produce exactly the committed file', () => {
    expect(serialise(buildTokenExport(css, app))).toBe(committed);
  });

  it('notices a token added to tokens.css and not exported', () => {
    const drifted = css.replace(':root {', ':root {\n  --surface-probe: var(--app-bg);');
    expect(serialise(buildTokenExport(drifted, app))).not.toBe(committed);
  });

  it('notices a token value changed in tokens.css', () => {
    const drifted = css.replace('--target-primary: 44px;', '--target-primary: 48px;');
    expect(drifted).not.toBe(css);
    expect(serialise(buildTokenExport(drifted, app))).not.toBe(committed);
  });

  it('notices a hand edit to the generated file', () => {
    const edited = committed.replace('"$value": "44px"', '"$value": "45px"');
    expect(edited).not.toBe(committed);
    expect(serialise(buildTokenExport(css, app))).not.toBe(edited);
  });

  it('says in the file itself that it is generated', () => {
    expect(JSON.parse(committed).$description).toMatch(/Do not edit by hand/);
  });
});

describe('the Figma mapping', () => {
  const real = (p: string) => existsIn(ROOT)(p);
  const manifest = (over: Record<string, unknown> = {}) => ({
    $schema: MAPPING_SCHEMA, figma: { fileUrl: null, fileKey: null, lastSynced: null },
    requiredTokens: [], variables: [], components: [], ...over,
  });
  const variable = (over: Record<string, unknown> = {}) => ({
    figmaCollection: 'Probe', figmaVariable: 'Surface / Base', tokenPath: 'semantic.surface-base', cssVariable: '--surface-base', status: 'mapped', ...over,
  });
  const blockers = (r: ReturnType<typeof validateMapping>) => r.findings.filter((f) => f.severity !== 'minor');

  it('accepts the committed manifest against the committed export', () => {
    const r = validateMapping(JSON.parse(read('docs/design-system/figma-mapping.json')), TOKENS, real);
    expect(blockers(r)).toEqual([]);
    expect(r.unmappedCandidates).toBe(Object.keys(TOKENS.semantic).length);
  });

  it('accepts a mapping to a token that exists, and counts it as valid', () => {
    const r = validateMapping(manifest({ variables: [variable()] }), TOKENS, real);
    expect(blockers(r)).toEqual([]);
    expect(r.valid).toHaveLength(1);
    expect(r.unmappedCandidates).toBe(Object.keys(TOKENS.semantic).length - 1);
  });

  it('fails a mapping to a token that does not exist', () => {
    const r = validateMapping(manifest({ variables: [variable({ tokenPath: 'semantic.surface-nowhere', cssVariable: '--surface-nowhere' })] }), TOKENS, real);
    expect(r.missingCodeToken).toHaveLength(1);
    expect(r.valid).toEqual([]);
    expect(blockers(r)[0]).toMatchObject({ severity: 'blocker' });
    expect(blockers(r)[0].what).toContain('tokens:export');
  });

  it('fails a wrong CSS variable, a malformed path and a malformed row', () => {
    expect(blockers(validateMapping(manifest({ variables: [variable({ cssVariable: '--surface-plain' })] }), TOKENS, real))).toHaveLength(1);
    expect(blockers(validateMapping(manifest({ variables: [variable({ tokenPath: 'surface-base' })] }), TOKENS, real))).toHaveLength(1);
    expect(blockers(validateMapping(manifest({ variables: [{ figmaVariable: 'x' }] }), TOKENS, real))).toHaveLength(1);
    expect(blockers(validateMapping({ variables: [] }, TOKENS, real))).toHaveLength(1);
  });

  it('separates the four buckets', () => {
    const r = validateMapping(
      manifest({
        variables: [
          variable(),
          variable({ figmaVariable: 'Gone', tokenPath: 'semantic.removed-token', cssVariable: '--removed-token', status: 'obsolete' }),
          variable({ figmaVariable: 'Not yet', tokenPath: null, cssVariable: null, status: 'unresolved' }),
          variable({ figmaVariable: 'Typo', tokenPath: 'semantic.nope', cssVariable: '--nope' }),
        ],
      }),
      TOKENS,
      real,
    );
    expect([r.valid.length, r.obsolete.length, r.unresolvedInFigma.length, r.missingCodeToken.length]).toEqual([1, 1, 1, 1]);
    expect(r.unmappedCandidates).toBeGreaterThan(0);
  });

  it('flags an obsolete mapping whose token still exists, and a required token nobody maps', () => {
    const r = validateMapping(manifest({ variables: [variable({ status: 'obsolete' })], requiredTokens: ['semantic.text-primary'] }), TOKENS, real);
    expect(r.findings.map((f) => f.severity).sort()).toEqual(['major', 'minor']);
  });

  it('checks that a mapped component points at code that exists', () => {
    const ok = validateMapping(manifest({ components: [{ figmaComponent: 'Page', codePattern: ['app/src/components/Page.tsx'], status: 'mapped' }] }), TOKENS, real);
    expect(blockers(ok)).toEqual([]);
    expect(ok.components.valid).toHaveLength(1);
    const gone = validateMapping(manifest({ components: [{ figmaComponent: 'Ghost', codePattern: ['app/src/components/Ghost.tsx'], status: 'mapped' }] }), TOKENS, real);
    expect(gone.components.missingPattern).toHaveLength(1);
    expect(blockers(gone)).toHaveLength(1);
    expect(blockers(validateMapping(manifest({ components: [{ figmaComponent: 'None', codePattern: [], status: 'mapped' }] }), TOKENS, real))).toHaveLength(1);
    // An unresolved component is a recorded gap, not a failure.
    expect(blockers(validateMapping(manifest({ components: [{ figmaComponent: 'New', codePattern: [], status: 'unresolved' }] }), TOKENS, real))).toEqual([]);
  });

  it('will not look outside the repository', () => {
    expect(existsIn(ROOT)('../../etc/passwd')).toBe(false);
    expect(existsIn(ROOT)('/etc/passwd')).toBe(false);
    expect(existsIn(ROOT)('app/package.json')).toBe(true);
  });

  it('resolves paths against the export it was given', () => {
    expect(resolves(TOKENS, 'semantic.surface-base')).toBe(true);
    expect(resolves(TOKENS, 'primitive.app-panel')).toBe(true);
    expect(resolves(TOKENS, 'semantic.constructor')).toBe(false);
    expect(resolves(TOKENS, 'surface-base')).toBe(false);
  });
});

describe('the report', () => {
  const input = (over: Partial<ReportInput> = {}): ReportInput => ({
    tokenExport: { ok: true, passed: 9, failed: 0, failures: [] },
    contracts: [{ file: 'src/styles/tokens.test.ts', passed: 8, failed: 0 }],
    hits: scan(SRC),
    ledger: RAW_BUDGET,
    mapping: validateMapping(JSON.parse(read('docs/design-system/figma-mapping.json')), TOKENS, existsIn(ROOT)),
    ...over,
  });

  it('passes on the committed tree, and is the same bytes twice', () => {
    expect(findings(input())).toEqual([]);
    expect(renderReport(input())).toContain('**PASS**');
    expect(renderReport(input())).toBe(renderReport(input()));
  });

  it('does not depend on the order test files finished in', () => {
    const a = { file: 'src/a11y/focus.test.ts', passed: 3, failed: 0 };
    const b = { file: 'src/styles/tokens.test.ts', passed: 8, failed: 0 };
    expect(renderReport(input({ contracts: [a, b] }))).toBe(renderReport(input({ contracts: [b, a] })));
  });

  it('escapes a backslash before a pipe, so a cell cannot be split by its own content', () => {
    expect(escapeCell('a|b')).toBe('a\\|b');
    // Pipe-only escaping turns `\|` into `\\|`, which closes the escape and leaves the pipe live.
    expect(escapeCell('a\\|b')).toBe('a\\\\\\|b');
    expect(escapeCell('line\nbreak')).toBe('line break');
    const text = renderReport(input({ mapping: { ...input().mapping, findings: [{ severity: 'minor', where: 'x\\|y', what: 'z' }] } }));
    const row = text.split('\n').find((l) => l.includes('x\\\\\\|y'))!;
    expect(row.split(/(?<!\\)\|/).length).toBe(6);
  });

  it('carries no clock and no absolute path', () => {
    const text = renderReport(input());
    expect(text).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
    expect(text).not.toContain(ROOT);
  });

  it('ranks drift: export and contract failures block, growth is major, a stale ledger is minor', () => {
    const grew = scanTsx('screens/Brand.tsx', 'const s = { zIndex: 777 };');
    const f = findings(
      input({
        tokenExport: { ok: false, passed: 8, failed: 1, failures: ['the token export matches the committed file'] },
        contracts: [{ file: 'src/styles/tokens.test.ts', passed: 7, failed: 1 }],
        hits: [...scan(SRC), ...grew],
      }),
    );
    expect(f.map((x) => x.severity)).toEqual(['blocker', 'blocker', 'major']);
    expect(renderReport(input({ tokenExport: { ok: false, passed: 8, failed: 1, failures: ['x'] } }))).toContain('**FAIL**');
    const stale = findings(input({ hits: scan(SRC).filter((h) => h.file !== Object.keys(RAW_BUDGET)[0]) }));
    expect(stale.length).toBeGreaterThan(0);
    expect(new Set(stale.map((x) => x.severity))).toEqual(new Set(['minor']));
  });
});

describe('the command, end to end', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('is wired to scripts that exist, and CI runs them', () => {
    const scripts = JSON.parse(read('app/package.json')).scripts as Record<string, string>;
    for (const name of ['tokens:check', 'design-system:audit', 'design-system:report', 'design-system:check']) {
      expect(scripts[name], name).toMatch(/^node scripts\/design-system\.mjs /);
    }
    expect(existsSync(join(ROOT, 'app', 'scripts', 'design-system.mjs'))).toBe(true);
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('npm run design-system:check');
    expect(ci).toContain('npm run design-system:report');
    expect(ci).toMatch(/upload-artifact@[0-9a-f]{40}/);
    // Nothing in the workflow hands Figma a credential.
    expect(ci).not.toMatch(/FIGMA_|secrets\.\w*FIGMA/i);
  });

  it('keeps the report out of git', () => {
    expect(read('app/.gitignore')).toMatch(/^reports\/$/m);
  });

  it('plants a violation in a copy of the tree and the audit names it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-tree-'));
    dirs.push(dir);
    // Paths are reported relative to `src/`, as in the real tree.
    const src = join(dir, 'src');
    mkdirSync(join(src, 'screens'), { recursive: true });
    writeFileSync(join(src, 'screens', 'Clean.tsx'), "export const A = () => <div style={{ color: 'var(--text-primary)' }} />;\n");
    expect(overLedger(scan(src), {})).toEqual([]);
    writeFileSync(join(src, 'screens', 'Dirty.tsx'), "export const B = () => <div style={{ zIndex: 500, boxShadow: '0 4px 12px rgba(0,0,0,.3)' }} />;\n");
    const drift = overLedger(scan(src), {});
    // The shadow's rgba is part of the shadow, not a second finding.
    expect(drift.map((d) => `${d.file} ${d.rule}`).sort()).toEqual(['screens/Dirty.tsx elevation', 'screens/Dirty.tsx layer']);
    expect(drift[0].line).toBe(1);
  });
});

// ── Claude configuration and docs name only what exists ──────────────────────

describe('what the Claude configuration points at', () => {
  const FILES = [
    'CLAUDE.md',
    '.claude/skills/build-semester-ui/SKILL.md',
    '.claude/skills/audit-semester-design-sync/SKILL.md',
    '.claude/skills/create-semester-component/SKILL.md',
    'docs/design-system/README.md',
    'docs/design-system/FIGMA-MAPPING.md',
  ];
  const scripts = JSON.parse(read('app/package.json')).scripts as Record<string, string>;

  /** Backticked repository paths and `npm run` scripts, with the line that holds each. */
  function refs(text: string) {
    const paths: string[] = [];
    const npm: string[] = [];
    for (const m of text.matchAll(/`([^`\n]+)`/g)) {
      const t = m[1].trim();
      const run = /^npm run ([a-z0-9:-]+)/.exec(t);
      if (run) npm.push(run[1]);
      if (/[*<>{}$|\s]/.test(t) && !run) continue;
      const base = t.replace(/[:#].*$/, '').replace(/\/$/, '');
      if (/^(?:app|docs|\.claude|\.github|packages)\/[\w./-]+$/.test(base) || /^\.mcp\.json$/.test(base)) paths.push(base);
      else if (/^(?:src|scripts)\/[\w./-]+\.\w+$/.test(base)) paths.push(`app/${base}`);
    }
    return { paths: [...new Set(paths)], npm: [...new Set(npm)] };
  }

  it('control: the reader finds references in a file that has them, and misses none of a planted one', () => {
    const r = refs('See `app/src/styles/tokens.css` and `npm run tokens:export` and `src/lib/look.ts` and `npm run nope:nope`.');
    expect(r.paths).toEqual(['app/src/styles/tokens.css', 'app/src/lib/look.ts']);
    expect(r.npm).toEqual(['tokens:export', 'nope:nope']);
  });

  for (const file of FILES) {
    it(`${file} names only paths and npm scripts that exist`, () => {
      const r = refs(read(file));
      expect(r.paths.length + r.npm.length, 'it should reference something').toBeGreaterThan(0);
      // The report is regenerated and git-ignored, so it is rightly absent from a clean checkout.
      expect(r.paths.filter((p) => !p.startsWith('app/reports/') && !existsSync(join(ROOT, p))), 'missing paths').toEqual([]);
      expect(r.npm.filter((n) => !scripts[n]), 'missing scripts').toEqual([]);
    });
  }

  it('the skills have frontmatter in the repository convention', () => {
    for (const name of ['build-semester-ui', 'audit-semester-design-sync', 'create-semester-component']) {
      const text = read(`.claude/skills/${name}/SKILL.md`);
      const front = /^---\nname: (.+)\ndescription: (.+)\n(?:.*\n)*?---\n/.exec(text);
      expect(front, name).not.toBeNull();
      expect(front![1]).toBe(name);
      expect(front![2].length).toBeGreaterThan(40);
    }
  });

  it('the audit skill is read-only: it grants no edit tool and no Figma write tool', () => {
    const text = read('.claude/skills/audit-semester-design-sync/SKILL.md');
    const tools = /^allowed-tools: (.+)$/m.exec(text)![1].split(',').map((t) => t.trim());
    for (const t of tools) expect(t, t).not.toMatch(/^(?:Edit|Write|NotebookEdit)$|use_figma|generate_figma|upload_assets|create_new_file|add_code_connect|send_code_connect/);
    expect(tools).toContain('Read');
  });

  it('nothing refers to a package, framework or tool this repository does not have', () => {
    const none = /@semester\/(?:ui|tokens|icons)|packages\/(?:ui|tokens|icons)|\.storybook|tailwind\.config|pnpm-workspace/;
    for (const file of FILES) expect(read(file), file).not.toMatch(none);
    // The names may appear only to say there are none.
    for (const file of FILES) {
      for (const line of read(file).split('\n').filter((l) => /tailwind|storybook|pnpm/i.test(l))) {
        expect(line, `${file}: ${line}`).toMatch(/\b(?:no|not|never|none|without|nor)\b/i);
      }
    }
    expect(existsSync(join(ROOT, 'pnpm-workspace.yaml'))).toBe(false);
    expect(existsSync(join(ROOT, 'packages', 'ui'))).toBe(false);
  });

  it('CLAUDE.md states what is generated and what wins', () => {
    const text = read('CLAUDE.md');
    expect(text).toMatch(/semester\.tokens\.json` is \*\*generated\. Never edit it\.\*\*/);
    for (const f of ['app/src/styles/tokens.css', 'app/src/lib/tokenexport.ts', 'app/src/lib/look.ts']) expect(text, f).toContain(f);
  });
});

describe('the Figma MCP configuration', () => {
  const cfg = JSON.parse(read('.mcp.json'));

  it('names the remote Figma server and nothing else', () => {
    expect(cfg).toEqual({ mcpServers: { figma: { type: 'http', url: 'https://mcp.figma.com/mcp' } } });
  });

  it('carries no credential, header, environment or local path', () => {
    const raw = read('.mcp.json');
    expect(raw).not.toMatch(/token|secret|key|cookie|authorization|bearer|headers|env|\/home\/|\/Users\//i);
  });

  it('documents the one command and the interactive sign-in, and does not claim it was done', () => {
    const doc = read('docs/design-system/FIGMA-MAPPING.md');
    expect(doc).toContain('claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp');
    expect(doc).toContain('/mcp');
    expect(doc).not.toMatch(/authenticated successfully|already authenticated/i);
  });
});

function readdirSyncDeep(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? readdirSyncDeep(join(dir, e.name)) : [join(dir, e.name)]));
}
