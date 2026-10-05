import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTokenExport, serialise } from './tokenexport';

/**
 * What surrounds the design-system audit: the instructions Claude reads, the
 * skills, the Figma MCP entry and the CI wiring name only what exists, and the
 * token export is shown to notice drift.
 *
 * `designsystem.test.ts` holds the audit and the real tree; `styles/rawvalues.test.ts`
 * holds the stylesheet ledger. Each guard here has a control — a fixture it must
 * convict beside the file it must pass.
 */

const ROOT = join(import.meta.dirname, '../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const scripts = JSON.parse(read('app/package.json')).scripts as Record<string, string>;

describe('token export drift', () => {
  const css = read('app/src/styles/tokens.css');
  const app = read('app/src/styles/app.css');
  const committed = read('app/design-tokens/semester.tokens.json');

  it('control: the sources produce exactly the committed file', () => {
    expect(serialise(buildTokenExport(css, app))).toBe(committed);
  });

  it('notices a token added to tokens.css and not exported', () => {
    const drifted = css.replace(':root {', ':root {\n  --surface-probe: var(--app-bg);');
    expect(drifted).not.toBe(css);
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

describe('what the Claude configuration points at', () => {
  const FILES = [
    'CLAUDE.md',
    '.claude/skills/build-semester-ui/SKILL.md',
    '.claude/skills/audit-semester-design-sync/SKILL.md',
    '.claude/skills/create-semester-component/SKILL.md',
    'docs/design-system/README.md',
    'docs/design-system/FIGMA-MAPPING.md',
  ];

  /** Backticked repository paths and `npm run` scripts. */
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

  it('control: the reader finds references, and misses none of a planted one', () => {
    const r = refs('See `app/src/styles/tokens.css` and `npm run tokens:export` and `src/lib/look.ts` and `npm run nope:nope`.');
    expect(r.paths).toEqual(['app/src/styles/tokens.css', 'app/src/lib/look.ts']);
    expect(r.npm).toEqual(['tokens:export', 'nope:nope']);
  });

  for (const file of FILES) {
    it(`${file} names only paths and npm scripts that exist`, () => {
      const r = refs(read(file));
      expect(r.paths.length + r.npm.length, 'it should reference something').toBeGreaterThan(0);
      // The report is regenerated and git-ignored, so it is rightly absent from a clean checkout.
      expect(r.paths.filter((p) => !/^app\/reports(?:\/|$)/.test(p) && !existsSync(join(ROOT, p))), 'missing paths').toEqual([]);
      expect(r.npm.filter((n) => !scripts[n]), 'missing scripts').toEqual([]);
    });
  }

  it('the skills have frontmatter in the repository convention', () => {
    for (const name of ['build-semester-ui', 'audit-semester-design-sync', 'create-semester-component']) {
      const front = /^---\nname: (.+)\ndescription: (.+)\n(?:.*\n)*?---\n/.exec(read(`.claude/skills/${name}/SKILL.md`));
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
  it('names the remote Figma server and nothing else', () => {
    expect(JSON.parse(read('.mcp.json'))).toEqual({ mcpServers: { figma: { type: 'http', url: 'https://mcp.figma.com/mcp' } } });
  });

  it('carries no credential, header, environment or local path', () => {
    expect(read('.mcp.json')).not.toMatch(/token|secret|key|cookie|authorization|bearer|headers|env|\/home\/|\/Users\//i);
  });

  it('documents the one command and the interactive sign-in, and does not claim it was done', () => {
    const doc = read('docs/design-system/README.md');
    expect(doc).toContain('claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp');
    expect(doc).toContain('/mcp');
    expect(doc).not.toMatch(/authenticated successfully|already authenticated/i);
  });
});

describe('the scripts and CI', () => {
  it('check runs the audit, the stylesheet ledger and the tests that hold them', () => {
    const check = scripts['design-system:check'];
    for (const part of ['npm run tokens:check', 'design-system-audit.mjs', 'design-system-css.mjs', 'src/styles/rawvalues.test.ts', 'src/lib/designtooling.test.ts']) {
      expect(check, part).toContain(part);
    }
    expect(scripts['design-system:css']).toBe('node scripts/design-system-css.mjs');
    for (const f of ['app/scripts/design-system-css.mjs', 'app/scripts/design-system-audit.mjs', 'app/src/lib/designtooling.test.ts']) expect(existsSync(join(ROOT, f)), f).toBe(true);
  });

  it('CI runs the check, then writes the report and keeps it, with no Figma credential', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('npm run design-system:check');
    expect(ci).toContain('npm run design-system:report');
    expect(ci).toMatch(/upload-artifact@[0-9a-f]{40}/);
    expect(ci).not.toMatch(/FIGMA_|secrets\.\w*FIGMA/i);
  });

  it('keeps the report out of git', () => {
    expect(read('.gitignore')).toMatch(/^app\/reports\/$/m);
  });
});
