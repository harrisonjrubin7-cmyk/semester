import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/*
 * `npm ci` run inside a workspace member installs only that member.
 *
 * `app/` and `packages/*` are npm workspaces with one root lockfile, so `npm ci`
 * in `app/` finds nothing wrong with the path and installs `app/`'s own
 * dependencies, skipping the `@semester/*` links; `npm sbom` and the build then
 * fail on them as missing. `supply-chain.yml` was written that way.
 *
 * `workflowpaths.test.ts` asks whether the paths a workflow names exist, which
 * is what stopped `supply-chain.yml` in `setup-node`. It cannot ask this: the
 * path exists, and it is the wrong place to install from. Run against that
 * regression it passes, and this fails (checked when this was written).
 *
 * So the one question here: does every `npm ci` run in a directory that has its
 * own lockfile, and not in a workspace member?
 */
const root = resolve(__dirname, '../../../..');
const exists = (p: string) => existsSync(join(root, p));

const workspaces = (): string[] => {
  const members = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).workspaces ?? []) as string[];
  const out: string[] = [];
  for (const w of members) {
    if (w.endsWith('/*')) {
      const dir = w.slice(0, -2);
      for (const e of readdirSync(join(root, dir), { withFileTypes: true })) if (e.isDirectory()) out.push(`${dir}/${e.name}`);
    } else out.push(w);
  }
  return out;
};

export function problems(name: string, text: string, has: (p: string) => boolean, members: readonly string[]): string[] {
  const out: string[] = [];
  const lines = text.split('\n');

  // A step is the lines from one `- ` at step indentation to the next.
  const starts: number[] = [];
  lines.forEach((l, i) => { if (/^\s*- (name|uses|id|run|if):/.test(l)) starts.push(i); });
  starts.forEach((s, k) => {
    const block = lines.slice(s, starts[k + 1] ?? lines.length);
    const installs = block.some((l) => !l.trim().startsWith('#') && /\bnpm ci\b/.test(l));
    if (!installs) return;
    const wd = block.map((l) => l.match(/^\s*working-directory:\s*(\S+)\s*$/)?.[1]).find(Boolean) ?? '.';
    if (wd.includes('${{')) return;
    const dir = wd.replace(/\/$/, '');
    if (members.includes(dir)) out.push(`${name}:${s + 1}: npm ci in workspace member ${dir}; install from the repository root`);
    else if (!has(dir === '.' ? 'package-lock.json' : `${dir}/package-lock.json`)) out.push(`${name}:${s + 1}: npm ci in ${dir}, which has no package-lock.json`);
  });
  return out;
}

const workflows = readdirSync(join(root, '.github/workflows')).filter((f) => f.endsWith('.yml'));
const text = (f: string) => readFileSync(join(root, '.github/workflows', f), 'utf8');

describe('workflows install from a directory with its own lockfile', () => {
  it('every npm ci in every workflow runs at the root or in a directory with its own lockfile', () => {
    const members = workspaces();
    expect(members, 'the root manifest lists the workspaces').toContain('app');
    const all = workflows.flatMap((f) => problems(f, text(f), exists, members));
    expect(all).toEqual([]);
  });

  it('the scan sees real installs (a probe that finds nothing proves nothing)', () => {
    const seen = workflows.filter((f) => /\bnpm ci\b/.test(text(f).replace(/^\s*#.*$/gm, '')));
    expect(seen.length, 'workflows that run npm ci').toBeGreaterThanOrEqual(5);
    expect(seen).toContain('supply-chain.yml');
    expect(seen).toContain('ci.yml');
  });

  it('the one non-workspace install, video/, is recognised as having its own lockfile', () => {
    expect(workspaces()).not.toContain('video');
    expect(exists('video/package-lock.json')).toBe(true);
    expect(problems('ci.yml', text('ci.yml'), exists, workspaces())).toEqual([]);
  });
});

describe('the probe fails on the defect it was written for (control)', () => {
  // The install step as supply-chain.yml first had it.
  const broken = `
    steps:
      - name: Install (exactly the lockfile)
        working-directory: app
        run: npm ci
`;

  it('flags the install in a workspace member, whose path exists', () => {
    expect(exists('app')).toBe(true);
    const found = problems('broken.yml', broken, exists, workspaces());
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/npm ci in workspace member app/);
  });

  it('accepts the same step from the root, as ci.yml and pages.yml run it', () => {
    const fixed = broken.replace('        working-directory: app\n', '');
    expect(problems('fixed.yml', fixed, exists, workspaces())).toEqual([]);
  });

  it('ignores npm ci in a comment, and a directory chosen at run time', () => {
    const t = `
      # \`npm ci\` rather than \`npm install\`
      - name: x
        working-directory: infra/\${{ matrix.root }}
        run: npm ci
`;
    expect(problems('c.yml', t, exists, workspaces())).toEqual([]);
  });

  it('flags an install in a directory with no lockfile at all', () => {
    const t = `
      - name: x
        working-directory: nowhere
        run: npm ci
`;
    expect(problems('n.yml', t, exists, workspaces())[0]).toMatch(/nowhere, which has no package-lock\.json/);
  });
});
